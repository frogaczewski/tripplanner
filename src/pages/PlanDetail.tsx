import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import Comments from '../components/Comments'
import MapView, { type MapLayer } from '../components/MapView'
import { getPlan, planOptions } from '../data/trips'
import { DAY_COLORS } from '../lib/colors'
import { formatDistance } from '../lib/gpx'
import { tripTotals } from '../lib/stats'
import { useTracks } from '../lib/useGpx'
import NotFound from './NotFound'

/** Side-by-side comparison of the candidate itineraries for one planned trip. */
export default function PlanDetail() {
  const { planId } = useParams()
  const navigate = useNavigate()
  const plan = getPlan(planId)
  const options = planId ? planOptions(planId) : []
  const [highlighted, setHighlighted] = useState<string | null>(null)

  const { tracks } = useTracks(options.flatMap((o) => o.days.map((d) => d.gpx)))

  // One colour per option rather than per day, so the map compares the options.
  const layers = useMemo<MapLayer[]>(() => {
    return options.flatMap((option, i) =>
      option.days.flatMap((day) => {
        const track = tracks.get(day.gpx)
        if (!track) return []
        return [
          {
            key: option.id,
            track,
            color: DAY_COLORS[i % DAY_COLORS.length],
            label: option.optionLabel ?? option.title,
            dimmed: highlighted !== null && highlighted !== option.id,
          },
        ]
      }),
    )
  }, [options, tracks, highlighted])

  if (!plan) return <NotFound />

  return (
    <div className="page">
      <nav className="breadcrumb">
        <Link to="/">Trips</Link> <span aria-hidden="true">/</span> {plan.title}
      </nav>

      <header className="trip-header">
        <div>
          <span className="badge badge-planned">planned</span>
          <h1>{plan.title}</h1>
          <p className="muted">{plan.region}</p>
          <p>{plan.summary}</p>
        </div>
        <dl className="stat-row stat-row-large">
          <div>
            <dt>Options</dt>
            <dd>{options.length}</dd>
          </div>
          <div>
            <dt>Departing</dt>
            <dd>
              {new Date(plan.startDate).toLocaleDateString(undefined, {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </dd>
          </div>
        </dl>
      </header>

      <section>
        <h2 className="section-title">All options</h2>
        {layers.length > 0 ? (
          <MapView
            layers={layers}
            fitKey={plan.id}
            height={440}
            onSelect={(id) => navigate(`/trips/${id}`)}
          />
        ) : (
          <p className="muted">Loading routes…</p>
        )}
        <p className="muted map-hint">
          Each option is one colour. Hover a card below to pick it out; click a route to
          open it.
        </p>
      </section>

      <section>
        <h2 className="section-title">Compare</h2>
        <div className="compare-scroll">
          <table className="compare-table">
            <thead>
              <tr>
                <th scope="col">Option</th>
                <th scope="col">Days</th>
                <th scope="col">Distance</th>
                <th scope="col">Ascent</th>
                <th scope="col">Per day</th>
                <th scope="col">Season</th>
              </tr>
            </thead>
            <tbody>
              {options.map((option, i) => {
                const totals = tripTotals(option, tracks)
                const perDayKm =
                  totals.distanceM === null
                    ? null
                    : totals.distanceM / 1000 / option.days.length
                const perDayM =
                  totals.ascentM === null ? null : totals.ascentM / option.days.length
                return (
                  <tr
                    key={option.id}
                    onMouseEnter={() => setHighlighted(option.id)}
                    onMouseLeave={() => setHighlighted(null)}
                  >
                    <th scope="row">
                      <span
                        className="day-swatch"
                        style={{ background: DAY_COLORS[i % DAY_COLORS.length] }}
                        aria-hidden="true"
                      />
                      <Link to={`/trips/${option.id}`}>
                        {option.optionLabel ?? option.title}
                      </Link>
                    </th>
                    <td>{option.days.length}</td>
                    <td>{totals.distanceM === null ? '…' : formatDistance(totals.distanceM)}</td>
                    <td>
                      {totals.ascentM === null ? '…' : `${totals.ascentM.toLocaleString()} m`}
                    </td>
                    <td>
                      {perDayKm === null || perDayM === null
                        ? '…'
                        : `${Math.round(perDayKm)} km · ${Math.round(perDayM).toLocaleString()} m`}
                    </td>
                    <td className="muted">{option.season ?? '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="section-title">Options</h2>
        <ul className="day-list">
          {options.map((option, i) => (
            <li
              key={option.id}
              onMouseEnter={() => setHighlighted(option.id)}
              onMouseLeave={() => setHighlighted(null)}
            >
              <Link to={`/trips/${option.id}`} className="day-card">
                <span
                  className="day-swatch"
                  style={{ background: DAY_COLORS[i % DAY_COLORS.length] }}
                  aria-hidden="true"
                />
                <div className="day-card-main">
                  <div className="day-card-head">
                    <strong>{option.optionLabel ?? option.title}</strong>
                    <span className="muted">{option.days.length} days</span>
                  </div>
                  <p className="muted">{option.summary}</p>
                </div>
                <span className="day-card-chevron" aria-hidden="true">
                  →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <Comments
        tripId={plan.id}
        title="Which one?"
        hint="Comments on the plan as a whole — argue for an option here, or leave notes on a specific day inside it."
      />
    </div>
  )
}
