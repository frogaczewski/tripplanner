import { useMemo, useRef, useState } from 'react'
import type { Track } from '../lib/gpx'
import { formatDistance } from '../lib/gpx'

interface Props {
  track: Track
  color?: string
  height?: number
  onHoverDistance?: (distance: number | null) => void
}

const WIDTH = 1000
const PADDING = { top: 12, right: 12, bottom: 24, left: 44 }

export default function ElevationProfile({
  track,
  color = '#2563eb',
  height = 200,
  onHoverDistance,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [hover, setHover] = useState<{ x: number; distance: number; ele: number } | null>(
    null,
  )

  const model = useMemo(() => {
    const points = track.points.filter((p) => p.ele !== null)
    if (points.length < 2 || track.stats.minEleM === null || track.stats.maxEleM === null) {
      return null
    }

    const totalDistance = track.stats.distanceM || 1
    const minEle = track.stats.minEleM
    const maxEle = track.stats.maxEleM
    // Pad the vertical range so a flat track does not collapse to a single line.
    const span = Math.max(maxEle - minEle, 20)
    const plotW = WIDTH - PADDING.left - PADDING.right
    const plotH = height - PADDING.top - PADDING.bottom

    const x = (distance: number) => PADDING.left + (distance / totalDistance) * plotW
    const y = (ele: number) => PADDING.top + plotH - ((ele - minEle) / span) * plotH

    const line = points
      .map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.distance).toFixed(1)},${y(p.ele!).toFixed(1)}`)
      .join(' ')
    const area = `${line} L${x(points[points.length - 1].distance).toFixed(1)},${(
      PADDING.top + plotH
    ).toFixed(1)} L${x(points[0].distance).toFixed(1)},${(PADDING.top + plotH).toFixed(1)} Z`

    const ticks = 4
    const yTicks = Array.from({ length: ticks + 1 }, (_, i) => {
      const ele = minEle + (span * i) / ticks
      return { ele, y: y(ele) }
    })
    const xTicks = Array.from({ length: 5 }, (_, i) => {
      const distance = (totalDistance * i) / 4
      return { distance, x: x(distance) }
    })

    return { points, totalDistance, plotH, line, area, yTicks, xTicks, x }
  }, [track, height])

  if (!model) {
    return <p className="muted">This track has no elevation data.</p>
  }

  function handleMove(event: React.MouseEvent<SVGSVGElement>) {
    const svg = svgRef.current
    if (!svg || !model) return
    const rect = svg.getBoundingClientRect()
    const ratio = (event.clientX - rect.left) / rect.width
    const svgX = ratio * WIDTH
    const plotW = WIDTH - PADDING.left - PADDING.right
    const distance = Math.min(
      Math.max(((svgX - PADDING.left) / plotW) * model.totalDistance, 0),
      model.totalDistance,
    )

    let lo = 0
    let hi = model.points.length - 1
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (model.points[mid].distance < distance) lo = mid + 1
      else hi = mid
    }
    const point = model.points[lo]
    setHover({ x: model.x(point.distance), distance: point.distance, ele: point.ele! })
    onHoverDistance?.(point.distance)
  }

  function handleLeave() {
    setHover(null)
    onHoverDistance?.(null)
  }

  return (
    <figure className="elevation">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${WIDTH} ${height}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`Elevation profile, ${formatDistance(track.stats.distanceM)} long`}
        onMouseMove={handleMove}
        onMouseLeave={handleLeave}
      >
        {model.yTicks.map((tick) => (
          <g key={tick.ele}>
            <line
              x1={PADDING.left}
              x2={WIDTH - PADDING.right}
              y1={tick.y}
              y2={tick.y}
              className="grid-line"
            />
            <text x={PADDING.left - 8} y={tick.y + 4} className="axis-label" textAnchor="end">
              {Math.round(tick.ele)}
            </text>
          </g>
        ))}
        {model.xTicks.map((tick) => (
          <text
            key={tick.distance}
            x={tick.x}
            y={height - 6}
            className="axis-label"
            textAnchor="middle"
          >
            {(tick.distance / 1000).toFixed(1)} km
          </text>
        ))}

        <path d={model.area} fill={color} fillOpacity={0.16} />
        <path d={model.line} fill="none" stroke={color} strokeWidth={2.5} />

        {hover && (
          <g>
            <line
              x1={hover.x}
              x2={hover.x}
              y1={PADDING.top}
              y2={PADDING.top + model.plotH}
              className="hover-line"
            />
          </g>
        )}
      </svg>
      <figcaption className="elevation-readout">
        {hover ? (
          <>
            <strong>{formatDistance(hover.distance)}</strong> in ·{' '}
            <strong>{Math.round(hover.ele)} m</strong> elevation
          </>
        ) : (
          <span className="muted">Hover the profile to read distance and elevation.</span>
        )}
      </figcaption>
    </figure>
  )
}
