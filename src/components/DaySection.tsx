import { useState } from 'react'
import { Link } from 'react-router-dom'
import ElevationProfile from './ElevationProfile'
import MapView from './MapView'
import { formatDistance, formatDuration, formatElevation, type Track } from '../lib/gpx'
import type { Trip, TripDay } from '../types'

interface Props {
  trip: Trip
  day: TripDay
  index: number
  color: string
  track: Track | undefined
  /** Lets the trip's overview map pick this day out while it is hovered. */
  onHover?: (dayId: string | null) => void
}

/**
 * A whole day laid out inline on the trip page — description, its own map,
 * profile and stats — so the trip reads top to bottom without clicking through.
 */
export default function DaySection({ trip, day, index, color, track, onHover }: Props) {
  const [hoverDistance, setHoverDistance] = useState<number | null>(null)

  return (
    <section
      className="day-section"
      id={day.id}
      onMouseEnter={() => onHover?.(day.id)}
      onMouseLeave={() => onHover?.(null)}
    >
      <div className="day-section-head">
        <span className="day-swatch" style={{ background: color }} aria-hidden="true" />
        <div>
          <h3>
            Day {index + 1} · {day.title}
          </h3>
          <p className="muted day-section-date">
            <time dateTime={day.date}>
              {new Date(day.date).toLocaleDateString(undefined, {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </time>
            {day.stayingAt && <> · Staying at {day.stayingAt}</>}
          </p>
        </div>
      </div>

      <p className="day-section-summary">{day.summary}</p>

      {day.highlights && day.highlights.length > 0 && (
        <ul className="chips">
          {day.highlights.map((h) => (
            <li key={h}>{h}</li>
          ))}
        </ul>
      )}

      {track ? (
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
            {track.stats.movingS !== null && (
              <div>
                <dt>Moving</dt>
                <dd>{formatDuration(track.stats.movingS)}</dd>
              </div>
            )}
          </dl>

          <div className="day-section-grid">
            <MapView
              layers={[{ key: day.id, track, color }]}
              fitKey={`${trip.id}/${day.id}/inline`}
              height={300}
              markerAtDistance={hoverDistance}
            />
            <ElevationProfile
              track={track}
              color={color}
              onHoverDistance={setHoverDistance}
            />
          </div>
        </>
      ) : (
        <p className="muted">Loading this day&rsquo;s track…</p>
      )}

      <p className="muted day-section-links">
        <Link to={`/trips/${trip.id}/days/${day.id}`}>Open day {index + 1}</Link> to comment
        {' · '}
        <a href={day.gpx} download>
          Download GPX
        </a>
      </p>
    </section>
  )
}
