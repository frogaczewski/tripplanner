import raw from './trips.json'
import rawPlans from './plans.json'
import type { Plan, Trip, TripDay } from '../types'

export const trips = raw as Trip[]
export const plans = rawPlans as Plan[]

export function getTrip(tripId: string | undefined): Trip | undefined {
  return trips.find((t) => t.id === tripId)
}

export function getPlan(planId: string | undefined): Plan | undefined {
  return plans.find((p) => p.id === planId)
}

/** The candidate itineraries belonging to a plan, in the order they are listed. */
export function planOptions(planId: string): Trip[] {
  return trips.filter((t) => t.planId === planId)
}

/**
 * What the home page lists: one entry per plan (however many options it holds)
 * plus every trip that is not an option of one.
 */
export type HomeEntry =
  | { kind: 'plan'; plan: Plan; options: Trip[] }
  | { kind: 'trip'; trip: Trip }

export function homeEntries(): HomeEntry[] {
  const entries: HomeEntry[] = []
  const seen = new Set<string>()

  for (const trip of trips) {
    if (!trip.planId) {
      entries.push({ kind: 'trip', trip })
      continue
    }
    if (seen.has(trip.planId)) continue
    seen.add(trip.planId)
    const plan = getPlan(trip.planId)
    if (plan) entries.push({ kind: 'plan', plan, options: planOptions(trip.planId) })
  }

  return entries
}

export function getDay(
  tripId: string | undefined,
  dayId: string | undefined,
): { trip: Trip; day: TripDay; index: number } | undefined {
  const trip = getTrip(tripId)
  if (!trip) return undefined
  const index = trip.days.findIndex((d) => d.id === dayId)
  if (index === -1) return undefined
  return { trip, day: trip.days[index], index }
}
