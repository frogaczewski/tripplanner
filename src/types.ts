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
  /** Optional YouTube (or other) video for this day. */
  videoUrl?: string
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
   * `recorded` (the default) means the GPX came off a device. `planned-routed`
   * means the line was produced by a router over OSM ways — the distances and
   * climbs are real measurements of that line, but nobody has ridden it yet, so
   * surfaces and passability are only as good as OSM. `planned-sketch` is a rung
   * below: the towns and passes it strings together were researched, but the line
   * between them was drawn rather than routed, so its distances and climbs are
   * calibrated estimates and not measurements of anything.
   */
  routeQuality?: 'recorded' | 'planned-routed' | 'planned-sketch'
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
  /** Video of the trip, shown on the trip page. */
  videoUrl?: string
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
