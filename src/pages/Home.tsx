import { Link } from 'react-router-dom'
import { homeEntries } from '../data/trips'
import { formatDistance } from '../lib/gpx'
import { staticTripTotals } from '../lib/stats'
import type { Trip } from '../types'

function dateRange(startDate: string, endDate: string): string {
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }
  const start = new Date(startDate)
  const end = new Date(endDate)
  return `${start.toLocaleDateString(undefined, opts)} – ${end.toLocaleDateString(
    undefined,
    opts,
  )} ${end.getFullYear()}`
}

/** Shortest and longest option, so a plan card still says something concrete. */
function optionSpread(options: Trip[]): string {
  const days = options.map((o) => o.days.length)
  return Math.min(...days) === Math.max(...days)
    ? `${days[0]} days`
    : `${Math.min(...days)}–${Math.max(...days)} days`
}

export default function Home() {
  const entries = homeEntries()

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
          {entries.map((entry) => {
            if (entry.kind === 'plan') {
              const { plan, options } = entry
              return (
                <li key={plan.id}>
                  <Link to={`/plans/${plan.id}`} className="trip-card">
                    <div className="trip-card-head">
                      <span className="badge badge-planned">planned</span>
                      <span className="muted">
                        {new Date(plan.startDate).toLocaleDateString(undefined, {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </span>
                    </div>
                    <h3>{plan.title}</h3>
                    <p className="muted">{plan.region}</p>
                    <p className="trip-card-summary">{plan.summary}</p>
                    <dl className="stat-row">
                      <div>
                        <dt>Options</dt>
                        <dd>{options.length}</dd>
                      </div>
                      <div>
                        <dt>Range</dt>
                        <dd>{optionSpread(options)}</dd>
                      </div>
                    </dl>
                  </Link>
                </li>
              )
            }

            const trip = entry.trip
            const totals = staticTripTotals(trip)
            return (
              <li key={trip.id}>
                <Link to={`/trips/${trip.id}`} className="trip-card">
                  <div className="trip-card-head">
                    <span className={`badge badge-${trip.status}`}>{trip.status}</span>
                    <span className="muted">{dateRange(trip.startDate, trip.endDate)}</span>
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
                      <dd>{formatDistance(totals.distanceM)}</dd>
                    </div>
                    <div>
                      <dt>Ascent</dt>
                      <dd>{totals.ascentM.toLocaleString()} m</dd>
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
