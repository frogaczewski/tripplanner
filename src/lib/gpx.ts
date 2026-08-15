export interface TrackPoint {
  lat: number
  lon: number
  /** Metres above sea level, or null when the file carries no elevation. */
  ele: number | null
  /** Epoch ms, or null when the file carries no timestamps. */
  time: number | null
  /** Cumulative distance from the start, in metres. */
  distance: number
}

export interface TrackStats {
  distanceM: number
  ascentM: number
  descentM: number
  minEleM: number | null
  maxEleM: number | null
  /** Wall-clock seconds between first and last point, null without timestamps. */
  durationS: number | null
  /** Seconds excluding stops (< 0.4 km/h between points), null without timestamps. */
  movingS: number | null
}

export interface Track {
  name: string | null
  points: TrackPoint[]
  stats: TrackStats
  bounds: [[number, number], [number, number]] | null
}

const EARTH_RADIUS_M = 6371000

export function haversine(
  aLat: number,
  aLon: number,
  bLat: number,
  bLon: number,
): number {
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(bLat - aLat)
  const dLon = toRad(bLon - aLon)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLon / 2) ** 2 * Math.cos(toRad(aLat)) * Math.cos(toRad(bLat))
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h))
}

/**
 * Elevation noise in consumer GPS traces inflates ascent badly, so only count a
 * climb once it has accumulated past this threshold.
 */
const ELEVATION_THRESHOLD_M = 3

function computeStats(points: TrackPoint[]): TrackStats {
  let ascent = 0
  let descent = 0
  let movingS = 0
  let min: number | null = null
  let max: number | null = null
  let reference: number | null = null

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

/**
 * Parses a GPX document. Track points (`trkpt`) are preferred; files that only
 * carry a route (`rtept`) fall back to that.
 */
export function parseGpx(xml: string): Track {
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  if (doc.querySelector('parsererror')) {
    throw new Error('The GPX file could not be parsed as XML.')
  }

  let nodes = Array.from(doc.getElementsByTagName('trkpt'))
  if (nodes.length === 0) nodes = Array.from(doc.getElementsByTagName('rtept'))
  if (nodes.length === 0) {
    throw new Error('The GPX file contains no track or route points.')
  }

  const points: TrackPoint[] = []
  let distance = 0

  for (const node of nodes) {
    const lat = Number(node.getAttribute('lat'))
    const lon = Number(node.getAttribute('lon'))
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue

    const eleText = node.getElementsByTagName('ele')[0]?.textContent
    const ele = eleText != null && eleText.trim() !== '' ? Number(eleText) : null
    const timeText = node.getElementsByTagName('time')[0]?.textContent
    const parsedTime = timeText ? Date.parse(timeText) : NaN

    const prev = points[points.length - 1]
    if (prev) distance += haversine(prev.lat, prev.lon, lat, lon)

    points.push({
      lat,
      lon,
      ele: ele !== null && Number.isFinite(ele) ? ele : null,
      time: Number.isFinite(parsedTime) ? parsedTime : null,
      distance,
    })
  }

  if (points.length === 0) {
    throw new Error('The GPX file contains no usable coordinates.')
  }

  const lats = points.map((p) => p.lat)
  const lons = points.map((p) => p.lon)

  return {
    name:
      doc.getElementsByTagName('trk')[0]?.getElementsByTagName('name')[0]?.textContent ??
      doc.getElementsByTagName('metadata')[0]?.getElementsByTagName('name')[0]
        ?.textContent ??
      null,
    points,
    stats: computeStats(points),
    bounds: [
      [Math.min(...lats), Math.min(...lons)],
      [Math.max(...lats), Math.max(...lons)],
    ],
  }
}

export function formatDistance(m: number): string {
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`
}

export function formatDuration(seconds: number | null): string {
  if (seconds === null) return '—'
  const total = Math.round(seconds)
  const h = Math.floor(total / 3600)
  const min = Math.round((total % 3600) / 60)
  return h > 0 ? `${h} h ${min} min` : `${min} min`
}

export function formatElevation(m: number | null): string {
  return m === null ? '—' : `${Math.round(m)} m`
}
