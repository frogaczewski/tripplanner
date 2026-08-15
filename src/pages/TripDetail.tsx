import { useCallback, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import Comments from '../components/Comments'
import MapView, { type MapLayer } from '../components/MapView'
import { getTrip } from '../data/trips'
import { formatDistance, formatDuration } from '../lib/gpx'
import { dayStats, isPlanned, tripTotals } from '../lib/stats'
import { useTracks } from '../lib/useGpx'
import { DAY_COLORS } from '../lib/colors'
import NotFound from './NotFound'

export default function TripDetail() {
  const { tripId } = useParams()
  const navigate = useNavigate()
  const trip = getTrip(tripId)
  const [highlighted, setHighlighted] = useState<string | null>(null)

  const { tracks, loading } = useTracks(trip ? trip.days.map((d) => d.gpx) : [])

  const openDay = useCallback(
    (dayId: string) => navigate(`/trips/${tripId}/days/${dayId}`),
    [navigate, tripId],
  )

  const layers = useMemo<MapLayer[]>(() => {
    if (!trip) return []
    return trip.days.flatMap((day, i) => {
      const track = tracks.get(day.gpx)
      if (!track) return []
      return [
        {
          key: day.id,
          track,
          color: DAY_COLORS[i % DAY_COLORS.length],
          label: `Day ${i + 1} — ${day.title}`,
          dimmed: highlighted !== null && highlighted !== day.id,
        },
      ]
    })
  }, [trip, tracks, highlighted])

  if (!trip) return <NotFound />

  const totals = tripTotals(trip, tracks)
  const planned = isPlanned(trip)
  const dash = (value: string | null) => (loading && value === null ? '…' : (value ?? '—'))

  return (
    <div className="page">
      <nav className="breadcrumb">
        <Link to="/">Trips</Link> <span aria-hidden="true">/</span> {trip.title}
      </nav>

      <header className="trip-header">
        <div>
          <span className={`badge badge-${trip.status}`}>{trip.status}</span>
          <h1>{trip.title}</h1>
          <p className="muted">{trip.region}</p>
          <p>{trip.summary}</p>
          {trip.season && (
            <p className="muted">
              <strong>Season:</strong> {trip.season}
            </p>
          )}
        </div>
        <dl className="stat-row stat-row-large">
          <div>
            <dt>Days</dt>
            <dd>{trip.days.length}</dd>
          </div>
          <div>
            <dt>{planned ? 'Distance (est.)' : 'Distance'}</dt>
            <dd>{dash(totals.distanceM === null ? null : formatDistance(totals.distanceM))}</dd>
          </div>
          <div>
            <dt>{planned ? 'Ascent (est.)' : 'Ascent'}</dt>
            <dd>{dash(totals.ascentM === null ? null : `${totals.ascentM.toLocaleString()} m`)}</dd>
          </div>
          <div>
            <dt>Descent</dt>
            <dd>{dash(totals.descentM === null ? null : `${totals.descentM.toLocaleString()} m`)}</dd>
          </div>
        </dl>
      </header>

      {planned && (
        <p className="route-note">
          <strong>Planning route.</strong> The GPX hold via-points only and are not
          snapped to roads, so the map draws straight lines between towns. Distance and
          ascent are the itinerary&rsquo;s own estimates, not measurements. Import a day
          into Komoot, RideWithGPS or Garmin Connect to get the real routed line.
        </p>
      )}

      <section>
        <h2 className="section-title">Whole route</h2>
        {layers.length > 0 ? (
          <MapView layers={layers} fitKey={trip.id} height={440} onSelect={openDay} />
        ) : (
          <p className="muted">{loading ? 'Loading tracks…' : 'No tracks available.'}</p>
        )}
        <p className="muted map-hint">
          Hover a day below to pick it out; click a track to open that day.
        </p>
      </section>

      <section>
        <h2 className="section-title">Days</h2>
        <ul className="day-list">
          {trip.days.map((day, i) => {
            const track = tracks.get(day.gpx)
            const stats = dayStats(trip, day, track)
            const color = DAY_COLORS[i % DAY_COLORS.length]
            return (
              <li
                key={day.id}
                onMouseEnter={() => setHighlighted(day.id)}
                onMouseLeave={() => setHighlighted(null)}
              >
                <Link to={`/trips/${trip.id}/days/${day.id}`} className="day-card">
                  <span className="day-swatch" style={{ background: color }} aria-hidden="true" />
                  <div className="day-card-main">
                    <div className="day-card-head">
                      <strong>
                        Day {i + 1} · {day.title}
                      </strong>
                      <time dateTime={day.date}>
                        {new Date(day.date).toLocaleDateString(undefined, {
                          weekday: 'short',
                          day: 'numeric',
                          month: 'short',
                        })}
                      </time>
                    </div>
                    <p className="muted">{day.summary}</p>
                    <dl className="stat-row stat-row-compact">
                      <div>
                        <dt>{stats.estimated ? 'Distance (est.)' : 'Distance'}</dt>
                        <dd>
                          {stats.distanceM === null
                            ? dash(null)
                            : formatDistance(stats.distanceM)}
                        </dd>
                      </div>
                      <div>
                        <dt>{stats.estimated ? 'Ascent (est.)' : 'Ascent'}</dt>
                        <dd>{stats.ascentM === null ? dash(null) : `${stats.ascentM} m`}</dd>
                      </div>
                      <div>
                        <dt>Descent</dt>
                        <dd>
                          {stats.descentM === null ? dash(null) : `${stats.descentM} m`}
                        </dd>
                      </div>
                      <div>
                        <dt>Time</dt>
                        <dd>
                          {stats.durationS === null
                            ? dash(null)
                            : formatDuration(stats.durationS)}
                        </dd>
                      </div>
                    </dl>
                  </div>
                  <span className="day-card-chevron" aria-hidden="true">
                    →
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      </section>

      <Comments
        tripId={trip.id}
        title="Trip comments & notes"
        hint="Everything posted here is saved to the trip's database and can be read back later. Day-specific feedback is better left on the day itself."
      />
    </div>
  )
}
