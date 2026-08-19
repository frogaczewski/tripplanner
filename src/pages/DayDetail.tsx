import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Comments from '../components/Comments'
import ElevationProfile from '../components/ElevationProfile'
import MapView, { type MapLayer } from '../components/MapView'
import { getDay } from '../data/trips'
import { DAY_COLORS } from '../lib/colors'
import { formatDistance, formatDuration, formatElevation } from '../lib/gpx'
import { isPlannedRoute, isSketchRoute } from '../lib/stats'
import { useTrack, useTracks } from '../lib/useGpx'
import NotFound from './NotFound'

export default function DayDetail() {
  const { tripId, dayId } = useParams()
  const found = getDay(tripId, dayId)
  const [hoverDistance, setHoverDistance] = useState<number | null>(null)

  const { track, error, loading } = useTrack(found?.day.gpx)
  // Neighbouring days are drawn faintly so a single day still reads in context.
  const { tracks: contextTracks } = useTracks(
    found ? found.trip.days.filter((d) => d.id !== found.day.id).map((d) => d.gpx) : [],
  )

  const layers = useMemo<MapLayer[]>(() => {
    if (!found) return []
    const result: MapLayer[] = []
    for (const [i, d] of found.trip.days.entries()) {
      const isCurrent = d.id === found.day.id
      const t = isCurrent ? track : contextTracks.get(d.gpx)
      if (!t) continue
      result.push({
        key: d.id,
        track: t,
        color: DAY_COLORS[i % DAY_COLORS.length],
        label: `Day ${i + 1} — ${d.title}`,
        dimmed: !isCurrent,
      })
    }
    return result
  }, [found, track, contextTracks])

  if (!found) return <NotFound />
  const planned = isPlannedRoute(found.trip)
  const sketch = isSketchRoute(found.trip)
  const { trip, day, index } = found
  const color = DAY_COLORS[index % DAY_COLORS.length]
  const prev = index > 0 ? trip.days[index - 1] : null
  const next = index < trip.days.length - 1 ? trip.days[index + 1] : null

  return (
    <div className="page">
      <nav className="breadcrumb">
        <Link to="/">Trips</Link> <span aria-hidden="true">/</span>{' '}
        <Link to={`/trips/${trip.id}`}>{trip.title}</Link> <span aria-hidden="true">/</span>{' '}
        Day {index + 1}
      </nav>

      <header className="day-header">
        <span className="day-swatch" style={{ background: color }} aria-hidden="true" />
        <div>
          <p className="muted">
            Day {index + 1} of {trip.days.length} ·{' '}
            <time dateTime={day.date}>
              {new Date(day.date).toLocaleDateString(undefined, {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </time>
          </p>
          <h1>{day.title}</h1>
          <p>{day.summary}</p>
          {day.stayingAt && (
            <p className="muted">
              <strong>Staying at:</strong> {day.stayingAt}
            </p>
          )}
          {day.highlights && day.highlights.length > 0 && (
            <ul className="chips">
              {day.highlights.map((h) => (
                <li key={h}>{h}</li>
              ))}
            </ul>
          )}
        </div>
      </header>

      {loading && <p className="muted">Loading GPX…</p>}
      {error && <p className="error">Could not load the GPX for this day: {error}</p>}

      {track && (
        <>
          <dl className="stat-row stat-row-large">
            <div>
              <dt>Distance</dt>
              <dd>{formatDistance(track.stats.distanceM)}</dd>
            </div>
            <div>
              <dt>Ascent</dt>
              <dd>{track.stats.ascentM.toLocaleString()} m</dd>
            </div>
            <div>
              <dt>Descent</dt>
              <dd>{track.stats.descentM.toLocaleString()} m</dd>
            </div>
            <div>
              <dt>High point</dt>
              <dd>{formatElevation(track.stats.maxEleM)}</dd>
            </div>
            <div>
              <dt>Low point</dt>
              <dd>{formatElevation(track.stats.minEleM)}</dd>
            </div>
            <div>
              <dt>Elapsed</dt>
              <dd>{formatDuration(track.stats.durationS)}</dd>
            </div>
            <div>
              <dt>Moving</dt>
              <dd>{formatDuration(track.stats.movingS)}</dd>
            </div>
            <div>
              <dt>Points</dt>
              <dd>{track.points.length.toLocaleString()}</dd>
            </div>
          </dl>

          {planned && !sketch && (
            <p className="route-note">
              <strong>Routed plan, not yet ridden.</strong> Everything below is measured
              from a line routed over OpenStreetMap, so there is no elapsed or moving
              time — nobody has ridden it yet.
            </p>
          )}

          {sketch && (
            <p className="route-note">
              <strong>Sketch line, not a routed track.</strong> The places this day
              strings together are researched; the line between them was drawn and then
              calibrated to the road distance and climbing the day is known to carry. The
              figures are planning estimates, and there is no elapsed or moving time
              because nobody has ridden it.
            </p>
          )}

          <section>
            <h2 className="section-title">Route</h2>
            <MapView
              layers={layers}
              fitKey={`${trip.id}/${day.id}`}
              height={420}
              markerAtDistance={hoverDistance}
            />
          </section>

          <section>
            <h2 className="section-title">Elevation</h2>
            <ElevationProfile
              track={track}
              color={color}
              onHoverDistance={setHoverDistance}
            />
          </section>

          <p className="muted">
            <a href={day.gpx} download>
              Download {day.gpx.split('/').pop()}
            </a>
            {track.name && <> · Track name: {track.name}</>}
          </p>
        </>
      )}

      <nav className="day-nav">
        {prev ? (
          <Link to={`/trips/${trip.id}/days/${prev.id}`}>← Day {index} · {prev.title}</Link>
        ) : (
          <span />
        )}
        {next ? (
          <Link to={`/trips/${trip.id}/days/${next.id}`}>
            Day {index + 2} · {next.title} →
          </Link>
        ) : (
          <span />
        )}
      </nav>

      <Comments
        tripId={trip.id}
        dayId={day.id}
        title={`Comments & notes — day ${index + 1}`}
        hint="Saved against this specific day."
      />
    </div>
  )
}
