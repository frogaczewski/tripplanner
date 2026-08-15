import raw from './trips.json'
import type { Trip, TripDay } from '../types'

export const trips = raw as Trip[]

export function getTrip(tripId: string | undefined): Trip | undefined {
  return trips.find((t) => t.id === tripId)
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
