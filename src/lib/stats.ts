import type { Track } from './gpx'
import type { Trip, TripDay } from '../types'

/**
 * What a page should actually show for a day.
 *
 * Recorded trips measure everything from the GPX. Planning routes carry only
 * via-points, so the straight lines between them understate distance badly (as
 * little as 40% of the real road distance) and the handful of via-point
 * elevations say nothing useful about climbing. For those, distance and ascent
 * come from the itinerary and the rest is `null` rather than a wrong number.
 */
export interface DisplayStats {
  distanceM: number | null
  ascentM: number | null
  descentM: number | null
  minEleM: number | null
  maxEleM: number | null
  durationS: number | null
  movingS: number | null
  /** True when the figures are itinerary estimates, not measurements. */
  estimated: boolean
}

const EMPTY: DisplayStats = {
  distanceM: null,
  ascentM: null,
  descentM: null,
  minEleM: null,
  maxEleM: null,
  durationS: null,
  movingS: null,
  estimated: false,
}

export function isPlanned(trip: Trip): boolean {
  return trip.routeQuality === 'planned-waypoints'
}

export function dayStats(
  trip: Trip,
  day: TripDay,
  track: Track | null | undefined,
): DisplayStats {
  if (isPlanned(trip)) {
    return {
      ...EMPTY,
      distanceM: day.plannedDistanceKm != null ? day.plannedDistanceKm * 1000 : null,
      ascentM: day.plannedAscentM ?? null,
      estimated: true,
    }
  }
  if (!track) return EMPTY
  return { ...track.stats, estimated: false }
}

/** Trip totals. Returns nulls while the recorded tracks are still loading. */
export function tripTotals(
  trip: Trip,
  tracks: Map<string, Track>,
): Pick<DisplayStats, 'distanceM' | 'ascentM' | 'descentM' | 'estimated'> {
  if (isPlanned(trip)) {
    const sum = (pick: (d: TripDay) => number | undefined) =>
      trip.days.reduce((total, d) => total + (pick(d) ?? 0), 0)
    return {
      distanceM: sum((d) => d.plannedDistanceKm) * 1000,
      ascentM: sum((d) => d.plannedAscentM),
      descentM: null,
      estimated: true,
    }
  }

  const loaded = trip.days
    .map((d) => tracks.get(d.gpx))
    .filter((t): t is Track => Boolean(t))
  if (loaded.length < trip.days.length) {
    return { distanceM: null, ascentM: null, descentM: null, estimated: false }
  }
  return {
    distanceM: loaded.reduce((s, t) => s + t.stats.distanceM, 0),
    ascentM: loaded.reduce((s, t) => s + t.stats.ascentM, 0),
    descentM: loaded.reduce((s, t) => s + t.stats.descentM, 0),
    estimated: false,
  }
}
