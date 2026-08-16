import type { Track } from './gpx'
import type { Trip } from '../types'

/** True when the route was produced by a router rather than ridden. */
export function isPlannedRoute(trip: Trip): boolean {
  return trip.routeQuality === 'planned-routed'
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
