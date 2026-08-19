import gpxStats from '../data/gpx-stats.json'
import type { TrackStats } from './gpx'
import type { Track } from './gpx'
import type { Trip, TripDay } from '../types'

const STATS = gpxStats as Record<string, TrackStats & { points: number }>

/**
 * Stats precomputed from the committed GPX by `npm run gpx:stats`.
 *
 * Summary views use these so they can render immediately; pages that draw a
 * map still parse the real file, and both use identical maths.
 */
export function staticDayStats(day: TripDay): (TrackStats & { points: number }) | undefined {
  return STATS[day.gpx]
}

export function staticTripTotals(trip: Trip): {
  distanceM: number
  ascentM: number
  descentM: number
} {
  return trip.days.reduce(
    (acc, day) => {
      const s = STATS[day.gpx]
      if (!s) return acc
      return {
        distanceM: acc.distanceM + s.distanceM,
        ascentM: acc.ascentM + s.ascentM,
        descentM: acc.descentM + s.descentM,
      }
    },
    { distanceM: 0, ascentM: 0, descentM: 0 },
  )
}

/** True when the route was drawn or routed rather than ridden. */
export function isPlannedRoute(trip: Trip): boolean {
  return trip.routeQuality === 'planned-routed' || trip.routeQuality === 'planned-sketch'
}

/** True when the line is a sketch, so its numbers are estimates, not measurements. */
export function isSketchRoute(trip: Trip): boolean {
  return trip.routeQuality === 'planned-sketch'
}

/** Trip totals, or nulls while the tracks are still loading. */
export function tripTotals(
  trip: Trip,
  tracks: Map<string, Track>,
): { distanceM: number | null; ascentM: number | null; descentM: number | null } {
  const loaded = trip.days
    .map((d) => tracks.get(d.gpx))
    .filter((t): t is Track => Boolean(t))
  if (loaded.length < trip.days.length) {
    return { distanceM: null, ascentM: null, descentM: null }
  }
  return {
    distanceM: loaded.reduce((s, t) => s + t.stats.distanceM, 0),
    ascentM: loaded.reduce((s, t) => s + t.stats.ascentM, 0),
    descentM: loaded.reduce((s, t) => s + t.stats.descentM, 0),
  }
}
