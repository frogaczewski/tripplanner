import { useCallback, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import Comments from '../components/Comments'
import DaySection from '../components/DaySection'
import MapView, { type MapLayer } from '../components/MapView'
import { getTrip } from '../data/trips'
import { formatDistance } from '../lib/gpx'
import { isPlannedRoute, tripTotals } from '../lib/stats'
import { useTracks } from '../lib/useGpx'
import { DAY_COLORS } from '../lib/colors'
import NotFound from './NotFound'

/** youtu.be/ID and watch?v=ID both need turning into the privacy-friendly embed URL. */
function embedUrl(url: string): string {
  const id = /youtu\.be\/([\w-]+)/.exec(url)?.[1] ?? /[?&]v=([\w-]+)/.exec(url)?.[1]
  return id ? `https://www.youtube-nocookie.com/embed/${id}` : url
}

export default function TripDetail() {
  const { tripId } = useParams()
  const navigate = useNavigate()
  const trip = getTrip(tripId)
  // The whole-route map dims other days while one inline section is hovered.
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
  const planned = isPlannedRoute(trip)
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
            <dt>Distance</dt>
            <dd>{dash(totals.distanceM === null ? null : formatDistance(totals.distanceM))}</dd>
          </div>
          <div>
            <dt>Ascent</dt>
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
          <strong>Routed plan, not yet ridden.</strong> The line follows real roads and
          tracks (routed with BRouter&rsquo;s gravel profile over OpenStreetMap), so the
          distances and climbs below are measured from it. What it cannot tell you is
          whether a piste is rideable on the day — surfaces come from OSM tags and the
          high cols hold snow well into spring.
        </p>
      )}

      {trip.videoUrl && (
        <section>
          <h2 className="section-title">Video</h2>
          <div className="video-embed">
            <iframe
              src={embedUrl(trip.videoUrl)}
              title={`${trip.title} — video`}
              allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
            />
          </div>
        </section>
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
        <h2 className="section-title">Day by day</h2>
        <div className="day-sections">
          {trip.days.map((day, i) => (
            <DaySection
              key={day.id}
              onHover={setHighlighted}
              trip={trip}
              day={day}
              index={i}
              color={DAY_COLORS[i % DAY_COLORS.length]}
              track={tracks.get(day.gpx)}
            />
          ))}
        </div>
      </section>

      <Comments
        tripId={trip.id}
        title="Trip comments & notes"
        hint="Everything posted here is saved to the trip's database and can be read back later. Day-specific feedback is better left on the day itself."
      />
    </div>
  )
}
