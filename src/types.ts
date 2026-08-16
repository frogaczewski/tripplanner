export type TripStatus = 'idea' | 'planned' | 'completed'

export interface TripDay {
  id: string
  date: string
  title: string
  summary: string
  /** Path to a GPX file committed under `public/gpx/`. */
  gpx: string
  stayingAt?: string
  highlights?: string[]
  /**
   * Itinerary figures, used instead of the GPX-derived ones when the GPX is a
   * planning route rather than a recorded track — see `Trip.routeQuality`.
   */
  plannedDistanceKm?: number
  plannedAscentM?: number
}

export interface Trip {
  id: string
  title: string
  region: string
  status: TripStatus
  startDate: string
  endDate: string
  summary: string
  days: TripDay[]
  /**
   * `recorded` (the default) means the GPX are real tracks and every figure on
   * the page is measured from them. `planned-waypoints` means the GPX hold only
   * unrouted via-points: the map line is straight between towns, so distance and
   * ascent come from the itinerary and the measured-only figures are suppressed.
   */
  routeQuality?: 'recorded' | 'planned-waypoints'
  /** Free text such as "Best Oct–Apr", shown on planned trips. */
  season?: string
  /**
   * A planned trip is usually one of several competing itineraries for the same
   * outing. Options sharing a `planId` are grouped behind a single card on the
   * home page and compared side by side on the plan page. A trip that has
   * already happened has no options, so it carries no `planId`.
   */
  planId?: string
  /** Short label for this option, e.g. "Grand Atlas Loop". Defaults to `title`. */
  optionLabel?: string
}

/** A trip being planned, with several candidate itineraries to choose between. */
export interface Plan {
  id: string
  title: string
  region: string
  summary: string
  /** Departure the options are costed against; individual options may differ. */
  startDate: string
}

export type CommentKind = 'comment' | 'note'

export interface Comment {
  id: string
  tripId: string
  dayId: string | null
  kind: CommentKind
  author: string
  body: string
  createdAt: string
}
