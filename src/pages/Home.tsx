import { Link } from 'react-router-dom'
import { trips } from '../data/trips'
import { useTracks } from '../lib/useGpx'
import { formatDistance } from '../lib/gpx'
import type { Trip } from '../types'

function dateRange(trip: Trip): string {
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }
  const start = new Date(trip.startDate)
  const end = new Date(trip.endDate)
  const year = end.getFullYear()
  return `${start.toLocaleDateString(undefined, opts)} – ${end.toLocaleDateString(
    undefined,
    opts,
  )} ${year}`
}

export default function Home() {
  const { tracks } = useTracks(trips.flatMap((t) => t.days.map((d) => d.gpx)))

  return (
    <div className="page">
      <header className="hero">
        <h1>Trip Planner</h1>
        <p>
          Routes, day-by-day GPX detail, and a place to argue about the plan before anyone
          books anything.
        </p>
      </header>

      <section>
        <h2 className="section-title">Trips</h2>
        <ul className="trip-grid">
          {trips.map((trip) => {
            const loaded = trip.days
              .map((d) => tracks.get(d.gpx))
              .filter((t): t is NonNullable<typeof t> => Boolean(t))
            const distance = loaded.reduce((sum, t) => sum + t.stats.distanceM, 0)
            const ascent = loaded.reduce((sum, t) => sum + t.stats.ascentM, 0)

            return (
              <li key={trip.id}>
                <Link to={`/trips/${trip.id}`} className="trip-card">
                  <div className="trip-card-head">
                    <span className={`badge badge-${trip.status}`}>{trip.status}</span>
                    <span className="muted">{dateRange(trip)}</span>
                  </div>
                  <h3>{trip.title}</h3>
                  <p className="muted">{trip.region}</p>
                  <p className="trip-card-summary">{trip.summary}</p>
                  <dl className="stat-row">
                    <div>
                      <dt>Days</dt>
                      <dd>{trip.days.length}</dd>
                    </div>
                    <div>
                      <dt>Distance</dt>
                      <dd>
                        {loaded.length === trip.days.length
                          ? formatDistance(distance)
                          : '…'}
                      </dd>
                    </div>
                    <div>
                      <dt>Ascent</dt>
                      <dd>
                        {loaded.length === trip.days.length
                          ? `${ascent.toLocaleString()} m`
                          : '…'}
                      </dd>
                    </div>
                  </dl>
                </Link>
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}
