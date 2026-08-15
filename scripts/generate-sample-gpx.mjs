#!/usr/bin/env node
/**
 * Generates the sample GPX tracks that ship with the repo.
 *
 * Real trips get their GPX committed by hand into `public/gpx/<tripId>/<dayId>.gpx`;
 * this script only exists so the demo trips in `src/data/trips.json` have tracks,
 * and so the expected file shape is documented somewhere executable.
 *
 *   npm run gpx:sample
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outRoot = join(root, 'public', 'gpx')

/** Anchors are [lat, lon, elevation-in-metres] along the real-world route. */
const TRACKS = [
  {
    trip: 'tatry-2026',
    day: 'day-1',
    name: 'Kuźnice → Hala Gąsienicowa',
    start: '2026-09-05T07:40:00Z',
    kmh: 2.6,
    anchors: [
      [49.2717, 19.98, 1010],
      [49.2668, 19.9871, 1105],
      [49.257, 19.995, 1210],
      [49.2497, 20.0022, 1348],
      [49.2441, 20.0074, 1452],
      [49.241, 20.011, 1500],
    ],
  },
  {
    trip: 'tatry-2026',
    day: 'day-2',
    name: 'Hala Gąsienicowa → Zawrat → Dolina Pięciu Stawów',
    start: '2026-09-06T06:50:00Z',
    kmh: 2.1,
    anchors: [
      [49.241, 20.011, 1500],
      [49.2338, 20.0122, 1620],
      [49.2286, 20.0139, 1800],
      [49.2249, 20.0161, 2010],
      [49.223, 20.017, 2159],
      [49.2216, 20.0248, 1950],
      [49.2205, 20.0331, 1760],
      [49.22, 20.04, 1670],
    ],
  },
  {
    trip: 'tatry-2026',
    day: 'day-3',
    name: 'Pięć Stawów → Morskie Oko → Rysy → Morskie Oko',
    start: '2026-09-07T05:30:00Z',
    kmh: 1.9,
    anchors: [
      [49.22, 20.04, 1670],
      [49.2118, 20.0524, 1520],
      [49.201, 20.07, 1395],
      [49.1926, 20.0771, 1650],
      [49.1861, 20.0829, 2050],
      [49.1795, 20.088, 2499],
      [49.1861, 20.0829, 2050],
      [49.1926, 20.0771, 1650],
      [49.201, 20.07, 1395],
    ],
  },
  {
    trip: 'tatry-2026',
    day: 'day-4',
    name: 'Morskie Oko → Palenica Białczańska',
    start: '2026-09-08T09:00:00Z',
    kmh: 4.4,
    anchors: [
      [49.201, 20.07, 1395],
      [49.2109, 20.0782, 1230],
      [49.2231, 20.0861, 1080],
      [49.236, 20.093, 980],
    ],
  },
  {
    trip: 'dolomites-alta-via-1',
    day: 'day-1',
    name: 'Lago di Braies → Rifugio Sennes',
    start: '2025-07-12T07:10:00Z',
    kmh: 2.4,
    anchors: [
      [46.6947, 12.085, 1496],
      [46.6861, 12.0932, 1780],
      [46.6772, 12.1004, 2090],
      [46.67, 12.105, 2327],
      [46.6631, 12.0971, 2210],
      [46.655, 12.09, 2126],
    ],
  },
  {
    trip: 'dolomites-alta-via-1',
    day: 'day-2',
    name: 'Rifugio Sennes → Rifugio Lagazuoi',
    start: '2025-07-13T06:30:00Z',
    kmh: 2.2,
    anchors: [
      [46.655, 12.09, 2126],
      [46.6421, 12.0702, 2040],
      [46.63, 12.05, 2060],
      [46.5901, 12.0301, 2180],
      [46.5502, 12.011, 2420],
      [46.52, 12.0, 2752],
    ],
  },
  {
    trip: 'dolomites-alta-via-1',
    day: 'day-3',
    name: 'Rifugio Lagazuoi → Rifugio Nuvolau',
    start: '2025-07-14T07:00:00Z',
    kmh: 2.3,
    anchors: [
      [46.52, 12.0, 2752],
      [46.5148, 12.0102, 2480],
      [46.5108, 12.0201, 2380],
      [46.51, 12.03, 2575],
    ],
  },
]

const EARTH_RADIUS_M = 6371000

function haversine(a, b) {
  const toRad = (d) => (d * Math.PI) / 180
  const dLat = toRad(b[0] - a[0])
  const dLon = toRad(b[1] - a[1])
  const lat1 = toRad(a[0])
  const lat2 = toRad(b[0])
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2)
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h))
}

/** Deterministic jitter so regenerating the samples does not churn the diff. */
function pseudoRandom(seed) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296 - 0.5
  }
}

function buildPoints(track, seed) {
  const rand = pseudoRandom(seed)
  const points = []
  for (let i = 0; i < track.anchors.length - 1; i++) {
    const from = track.anchors[i]
    const to = track.anchors[i + 1]
    const steps = Math.max(12, Math.round(haversine(from, to) / 45))
    for (let s = 0; s < steps; s++) {
      const t = s / steps
      const wobble = Math.sin(t * Math.PI * 3) * 0.00035
      points.push([
        from[0] + (to[0] - from[0]) * t + wobble * rand(),
        from[1] + (to[1] - from[1]) * t + wobble * rand(),
        from[2] + (to[2] - from[2]) * t + rand() * 4,
      ])
    }
  }
  points.push(track.anchors[track.anchors.length - 1])
  return points
}

function toGpx(track, points) {
  const startMs = Date.parse(track.start)
  let elapsedS = 0
  const rows = points.map((p, i) => {
    if (i > 0) {
      const flat = haversine(points[i - 1], p)
      const climb = Math.max(0, p[2] - points[i - 1][2])
      // Naismith-ish: horizontal distance at the day's pace + 10 min per 100 m of ascent.
      elapsedS += (flat / 1000 / track.kmh) * 3600 + climb * 6
    }
    const time = new Date(startMs + elapsedS * 1000).toISOString().replace(/\.\d{3}Z$/, 'Z')
    return `      <trkpt lat="${p[0].toFixed(6)}" lon="${p[1].toFixed(6)}"><ele>${p[2].toFixed(
      1,
    )}</ele><time>${time}</time></trkpt>`
  })

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="tripplanner sample generator" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${track.name}</name>
    <time>${track.start}</time>
  </metadata>
  <trk>
    <name>${track.name}</name>
    <trkseg>
${rows.join('\n')}
    </trkseg>
  </trk>
</gpx>
`
}

for (const [index, track] of TRACKS.entries()) {
  const points = buildPoints(track, 7919 + index * 104729)
  const dir = join(outRoot, track.trip)
  await mkdir(dir, { recursive: true })
  const file = join(dir, `${track.day}.gpx`)
  await writeFile(file, toGpx(track, points), 'utf8')
  console.log(`wrote ${file} (${points.length} points)`)
}
