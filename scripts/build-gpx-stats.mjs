#!/usr/bin/env node
/**
 * Precomputes the stats for every committed GPX into `src/data/gpx-stats.json`.
 *
 * Summary views (the home cards, the plan comparison table) only need numbers,
 * not geometry. Without this they had to download every GPX of every trip —
 * about a megabyte — before they could show a single figure, so rows appeared
 * one at a time as each trip finished loading.
 *
 * The maths below deliberately mirrors `computeStats` in src/lib/gpx.ts; this
 * runs from `prebuild`, so the two cannot drift apart in a release.
 */
import { createHash } from 'node:crypto'
import { readdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const gpxRoot = join(root, 'public', 'gpx')
const outPath = join(root, 'src', 'data', 'gpx-stats.json')

const EARTH_RADIUS_M = 6371000
const ELEVATION_THRESHOLD_M = 3

function haversine(aLat, aLon, bLat, bLon) {
  const toRad = (d) => (d * Math.PI) / 180
  const dLat = toRad(bLat - aLat)
  const dLon = toRad(bLon - aLon)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLon / 2) ** 2 * Math.cos(toRad(aLat)) * Math.cos(toRad(bLat))
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h))
}

/** Pulls lat/lon/ele/time out of trkpt (preferred) or rtept elements. */
function parsePoints(xml) {
  const tag = xml.includes('<trkpt') ? 'trkpt' : 'rtept'
  const re = new RegExp(`<${tag}\\s+([^>]*?)>([\\s\\S]*?)</${tag}>|<${tag}\\s+([^>]*?)/>`, 'g')
  const points = []
  let distance = 0
  let prev = null

  for (const m of xml.matchAll(re)) {
    const attrs = m[1] ?? m[3] ?? ''
    const lat = Number(/lat="([^"]+)"/.exec(attrs)?.[1])
    const lon = Number(/lon="([^"]+)"/.exec(attrs)?.[1])
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue
    const body = m[2] ?? ''
    const eleText = /<ele>([^<]+)<\/ele>/.exec(body)?.[1]
    const timeText = /<time>([^<]+)<\/time>/.exec(body)?.[1]
    const ele = eleText != null ? Number(eleText) : null
    const parsedTime = timeText ? Date.parse(timeText) : NaN

    if (prev) distance += haversine(prev.lat, prev.lon, lat, lon)
    const point = {
      lat,
      lon,
      ele: ele !== null && Number.isFinite(ele) ? ele : null,
      time: Number.isFinite(parsedTime) ? parsedTime : null,
      distance,
    }
    points.push(point)
    prev = point
  }
  return points
}

function computeStats(points) {
  let ascent = 0
  let descent = 0
  let movingS = 0
  let min = null
  let max = null
  let reference = null

  for (const [i, p] of points.entries()) {
    if (p.ele !== null) {
      min = min === null ? p.ele : Math.min(min, p.ele)
      max = max === null ? p.ele : Math.max(max, p.ele)
      if (reference === null) {
        reference = p.ele
      } else {
        const delta = p.ele - reference
        if (delta >= ELEVATION_THRESHOLD_M) {
          ascent += delta
          reference = p.ele
        } else if (delta <= -ELEVATION_THRESHOLD_M) {
          descent += -delta
          reference = p.ele
        }
      }
    }
    if (i > 0) {
      const prev = points[i - 1]
      if (p.time !== null && prev.time !== null) {
        const dt = (p.time - prev.time) / 1000
        const dd = p.distance - prev.distance
        if (dt > 0 && dd / dt > 0.11) movingS += dt
      }
    }
  }

  const first = points[0]
  const last = points[points.length - 1]
  const durationS =
    first?.time != null && last?.time != null ? (last.time - first.time) / 1000 : null

  return {
    distanceM: last ? last.distance : 0,
    ascentM: Math.round(ascent),
    descentM: Math.round(descent),
    minEleM: min,
    maxEleM: max,
    durationS,
    movingS: durationS === null ? null : Math.round(movingS),
  }
}

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) yield* walk(path)
    else if (entry.name.endsWith('.gpx')) yield path
  }
}

const stats = {}
let count = 0
for await (const path of walk(gpxRoot)) {
  const xml = await readFile(path, 'utf8')
  const url = '/gpx/' + path.slice(gpxRoot.length + 1).split(/[\\/]/).join('/')
  const points = parsePoints(xml)
  if (points.length === 0) {
    console.warn(`build-gpx-stats: no points in ${url}`)
    continue
  }
  stats[url] = { ...computeStats(points), points: points.length }
  count += 1
}

const sorted = Object.fromEntries(Object.entries(stats).sort(([a], [b]) => a.localeCompare(b)))
const json = JSON.stringify(sorted, null, 2) + '\n'
await writeFile(outPath, json)
const hash = createHash('sha1').update(json).digest('hex').slice(0, 8)
console.log(`build-gpx-stats: ${count} tracks -> src/data/gpx-stats.json (${hash})`)
