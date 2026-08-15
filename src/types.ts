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
