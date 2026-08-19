#!/usr/bin/env node
/**
 * Builds the GPX for the Taurus options from `scripts/taurus-route.json`.
 *
 * Two modes:
 *
 *   node scripts/build-taurus-gpx.mjs              sketch  (what is committed today)
 *   node scripts/build-taurus-gpx.mjs --brouter    routed over OpenStreetMap
 *
 * The sketch mode exists because the session that researched these routes had no
 * egress to a routing engine. It densifies the researched control-point chain,
 * bends it with a switchback-scale meander until the line is as long as the
 * researched road distance, and ripples the interpolated elevation until the
 * climbing matches the researched figure. The corridor, the passes, the towns and
 * the day splits are real; the line between two named points is drawn rather than
 * surveyed, so the numbers are calibrated estimates, not measurements.
 *
 * `--brouter` replaces all of that with a real route over OSM ways and is what
 * should be committed as soon as brouter.de is reachable: same control points,
 * same day splits, measured geometry. It rewrites the same files, so the only
 * follow-up is `npm run gpx:stats`.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const routePath = join(root, 'scripts', 'taurus-route.json')
const gpxRoot = join(root, 'public', 'gpx')

const EARTH_RADIUS_M = 6371000
const ELEVATION_THRESHOLD_M = 3
/** Point spacing of the densified skeleton. */
const STEP_M = 40
/**
 * Wavelengths to try for the meander and the elevation ripple, longest first.
 * A leg whose road is much longer than the straight line between its control
 * points needs a bigger amplitude at a given wavelength, and a wide meander
 * wanders visibly off the corridor on the map — so drop to a tighter wavelength
 * (more, smaller switchbacks) until the amplitude stays inside the cap.
 */
const MEANDER_WAVELENGTHS_M = [900, 600, 400, 260, 170]
const MEANDER_AMPLITUDE_CAP_M = 220
const RIPPLE_WAVELENGTHS_M = [1600, 1000, 640, 400, 260]
const RIPPLE_AMPLITUDE_CAP_M = 22

const BROUTER_URL = 'https://brouter.de/brouter'
const BROUTER_PROFILE = process.env.BROUTER_PROFILE ?? 'trekking'

const toRad = (d) => (d * Math.PI) / 180

function haversine(a, b) {
  const dLat = toRad(b.lat - a.lat)
  const dLon = toRad(b.lon - a.lon)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLon / 2) ** 2 * Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat))
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h))
}

function pathLength(points) {
  let total = 0
  for (let i = 1; i < points.length; i += 1) total += haversine(points[i - 1], points[i])
  return total
}

/** Ascent exactly as src/lib/gpx.ts and build-gpx-stats.mjs compute it. */
function ascentOf(points) {
  let ascent = 0
  let reference = null
  for (const p of points) {
    if (p.ele == null) continue
    if (reference === null) {
      reference = p.ele
      continue
    }
    const delta = p.ele - reference
    if (delta >= ELEVATION_THRESHOLD_M) {
      ascent += delta
      reference = p.ele
    } else if (delta <= -ELEVATION_THRESHOLD_M) {
      reference = p.ele
    }
  }
  return ascent
}

/**
 * Straight-segment skeleton through the control points, sampled every STEP_M.
 * Each sample carries the fraction along its segment so the meander and the
 * ripple can be tapered to nothing at the named places themselves.
 */
function densify(control) {
  const out = []
  for (let i = 1; i < control.length; i += 1) {
    const a = control[i - 1]
    const b = control[i]
    const segment = haversine(a, b)
    const steps = Math.max(2, Math.round(segment / STEP_M))
    for (let s = i === 1 ? 0 : 1; s <= steps; s += 1) {
      const u = s / steps
      out.push({
        lat: a.lat + (b.lat - a.lat) * u,
        lon: a.lon + (b.lon - a.lon) * u,
        ele: a.ele + (b.ele - a.ele) * u,
        taper: Math.sin(Math.PI * u),
      })
    }
  }
  let run = 0
  out[0].s = 0
  for (let i = 1; i < out.length; i += 1) {
    run += haversine(out[i - 1], out[i])
    out[i].s = run
  }
  return out
}

/** Offsets every sample sideways by `amplitude · sin(2πs/λ)`, tapered per segment. */
function meander(skeleton, amplitudeM, wavelengthM) {
  const mPerDegLat = 111320
  return skeleton.map((p, i) => {
    const prev = skeleton[Math.max(0, i - 1)]
    const next = skeleton[Math.min(skeleton.length - 1, i + 1)]
    const mPerDegLon = mPerDegLat * Math.cos(toRad(p.lat))
    const dx = (next.lon - prev.lon) * mPerDegLon
    const dy = (next.lat - prev.lat) * mPerDegLat
    const len = Math.hypot(dx, dy) || 1
    // Left-hand normal of the direction of travel.
    const nx = -dy / len
    const ny = dx / len
    const offset = amplitudeM * p.taper * Math.sin((2 * Math.PI * p.s) / wavelengthM)
    return {
      ...p,
      lat: p.lat + (offset * ny) / mPerDegLat,
      lon: p.lon + (offset * nx) / mPerDegLon,
    }
  })
}

/**
 * Adds `amplitude · sin(2πs/λ)` to the interpolated elevation, tapered per
 * segment, with a floor at 1 m so a coastal day never dips below the sea. The
 * floor is applied here rather than afterwards so the solver sees the ascent the
 * clamped profile actually has.
 */
function ripple(points, amplitudeM, wavelengthM) {
  return points.map((p) => ({
    ...p,
    ele: Math.max(1, p.ele + amplitudeM * p.taper * Math.sin((2 * Math.PI * p.s) / wavelengthM)),
  }))
}

/** Bisects `f` for the amplitude that hits `target`; f must be non-decreasing. */
function solve(f, target, hi) {
  let lo = 0
  for (let i = 0; i < 40; i += 1) {
    const mid = (lo + hi) / 2
    if (f(mid) < target) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}

/**
 * Solves for an amplitude at the longest wavelength that keeps it under `cap`,
 * falling back to the tightest wavelength on offer when none does.
 */
function solveWavelength(wavelengths, cap, apply, measure, target) {
  let last = null
  for (const wavelengthM of wavelengths) {
    const amplitudeM = solve((a) => measure(apply(a, wavelengthM)), target, wavelengthM * 4)
    last = { amplitudeM, wavelengthM }
    if (amplitudeM <= cap) break
  }
  return last
}

function sketchDay(day) {
  const control = day.points.map(([, lat, lon, ele]) => ({ lat, lon, ele }))
  const skeleton = densify(control)
  const skeletonM = pathLength(skeleton)
  const targetM = day.targetKm * 1000

  if (skeletonM > targetM) {
    throw new Error(
      `${day.id}: the straight-line skeleton is already ${(skeletonM / 1000).toFixed(1)} km, ` +
        `longer than the researched ${day.targetKm} km — fix the control points or the target.`,
    )
  }

  const bend = solveWavelength(
    MEANDER_WAVELENGTHS_M,
    MEANDER_AMPLITUDE_CAP_M,
    (a, w) => meander(skeleton, a, w),
    pathLength,
    targetM,
  )
  const bent = meander(skeleton, bend.amplitudeM, bend.wavelengthM)

  const wave = solveWavelength(
    RIPPLE_WAVELENGTHS_M,
    RIPPLE_AMPLITUDE_CAP_M,
    (a, w) => ripple(bent, a, w),
    ascentOf,
    day.targetAscentM,
  )
  const points = ripple(bent, wave.amplitudeM, wave.wavelengthM)

  return {
    points,
    diagnostics: {
      skeletonKm: skeletonM / 1000,
      meander: bend,
      ripple: wave,
    },
  }
}

async function brouterDay(day) {
  const lonlats = day.points.map(([, lat, lon]) => `${lon},${lat}`).join('|')
  const url =
    `${BROUTER_URL}?lonlats=${encodeURIComponent(lonlats)}` +
    `&profile=${BROUTER_PROFILE}&alternativeidx=0&format=gpx`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${day.id}: BRouter answered ${res.status} ${res.statusText}`)
  const xml = await res.text()
  const points = []
  for (const m of xml.matchAll(/<trkpt\s+lat="([^"]+)"\s+lon="([^"]+)"[^>]*>([\s\S]*?)<\/trkpt>/g)) {
    const ele = /<ele>([^<]+)<\/ele>/.exec(m[3])?.[1]
    points.push({ lat: Number(m[1]), lon: Number(m[2]), ele: ele == null ? null : Number(ele) })
  }
  if (points.length === 0) throw new Error(`${day.id}: BRouter returned no track points`)
  return { points, diagnostics: null }
}

const escapeXml = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

function toGpx({ optionId, day, points, routed }) {
  const km = (pathLength(points) / 1000).toFixed(1)
  const ascent = Math.round(ascentOf(points))
  const name = `${optionId} — ${day.name}`
  const desc = routed
    ? `${km} km, ${ascent} m. Routed with BRouter (${BROUTER_PROFILE}) over OpenStreetMap — a plan, nobody has ridden it.`
    : `${km} km, ${ascent} m. Sketch line through researched control points, calibrated to ` +
      `${day.targetKm} km / ${day.targetAscentM} m of road — drawn, not routed.`
  const creator = routed
    ? `tripplanner (routed with BRouter, ${BROUTER_PROFILE} profile)`
    : 'tripplanner (sketch line from researched control points)'

  const body = points
    .map(
      (p) =>
        `    <trkpt lat="${p.lat.toFixed(6)}" lon="${p.lon.toFixed(6)}">` +
        (p.ele == null ? '' : `<ele>${p.ele.toFixed(1)}</ele>`) +
        `</trkpt>`,
    )
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="${escapeXml(creator)}" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${escapeXml(name)}</name>
    <desc>${escapeXml(desc)}</desc>
  </metadata>
  <trk>
    <name>${escapeXml(name)}</name>
    <trkseg>
${body}
    </trkseg>
  </trk>
</gpx>
`
}

const routed = process.argv.includes('--brouter')
const route = JSON.parse(await readFile(routePath, 'utf8'))

for (const option of route.options) {
  await mkdir(join(gpxRoot, option.id), { recursive: true })
  for (const day of option.days) {
    let built
    try {
      built = routed ? await brouterDay(day) : sketchDay(day)
    } catch (err) {
      if (routed) {
        console.error(`\nCould not route ${option.id}/${day.id}: ${err.message}`)
        console.error(
          'If this is a proxy 403 the egress policy blocks brouter.de — report the blocked ' +
            'host rather than working around it, and leave the sketch tracks in place.',
        )
        process.exit(1)
      }
      throw err
    }
    const path = join(gpxRoot, option.id, `${day.id}.gpx`)
    await writeFile(path, toGpx({ optionId: option.id, day, points: built.points, routed }))
    const km = (pathLength(built.points) / 1000).toFixed(1)
    const ascent = Math.round(ascentOf(built.points))
    const d = built.diagnostics
    const extra = d
      ? ` (skeleton ${d.skeletonKm.toFixed(1)} km, ` +
        `meander ±${d.meander.amplitudeM.toFixed(0)} m / ${d.meander.wavelengthM} m, ` +
        `ripple ±${d.ripple.amplitudeM.toFixed(1)} m / ${d.ripple.wavelengthM} m)`
      : ''
    console.log(
      `${option.id}/${day.id}: ${km} km, ${ascent} m, ${built.points.length} points${extra}`,
    )
  }
}

console.log(`\n${routed ? 'Routed' : 'Sketched'} — now run \`npm run gpx:stats\`.`)
