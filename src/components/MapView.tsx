import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { Track } from '../lib/gpx'

export interface MapLayer {
  key: string
  track: Track
  color: string
  label?: string
  /** Dimmed layers stay on the map for context but do not drive the fitted bounds. */
  dimmed?: boolean
}

interface Props {
  layers: MapLayer[]
  /**
   * The map re-fits its bounds only when this value changes, so transient
   * styling changes (hover highlighting) do not move the viewport.
   */
  fitKey: string
  /** Distance in metres along the first non-dimmed track to mark with a dot. */
  markerAtDistance?: number | null
  height?: number
  onSelect?: (key: string) => void
}

const START_ICON = L.divIcon({
  className: 'map-pin map-pin-start',
  html: '<span></span>',
  iconSize: [14, 14],
})
const END_ICON = L.divIcon({
  className: 'map-pin map-pin-end',
  html: '<span></span>',
  iconSize: [14, 14],
})

/** Nearest track point at or past `distance`, found by binary search. */
function pointAtDistance(track: Track, distance: number) {
  const points = track.points
  let lo = 0
  let hi = points.length - 1
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (points[mid].distance < distance) lo = mid + 1
    else hi = mid
  }
  return points[lo]
}

export default function MapView({
  layers,
  fitKey,
  markerAtDistance,
  height = 420,
  onSelect,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const layerGroupRef = useRef<L.LayerGroup | null>(null)
  const hoverMarkerRef = useRef<L.CircleMarker | null>(null)
  const fittedKeyRef = useRef<string | null>(null)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    const map = L.map(containerRef.current, { scrollWheelZoom: false })
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map)
    layerGroupRef.current = L.layerGroup().addTo(map)
    mapRef.current = map
    return () => {
      // stop() aborts any in-flight pan/zoom animation; without it an animation
      // frame can fire against the detached container after remove().
      map.stop()
      map.remove()
      mapRef.current = null
      layerGroupRef.current = null
      hoverMarkerRef.current = null
      fittedKeyRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    const group = layerGroupRef.current
    if (!map || !group) return

    group.clearLayers()
    // The hover marker lives on the map rather than in the group, so clearing
    // the group would otherwise orphan it.
    hoverMarkerRef.current?.remove()
    hoverMarkerRef.current = null

    const focus: L.LatLngBounds[] = []

    for (const layer of layers) {
      const latlngs = layer.track.points.map((p) => [p.lat, p.lon] as [number, number])
      if (latlngs.length === 0) continue

      const line = L.polyline(latlngs, {
        color: layer.color,
        weight: layer.dimmed ? 3 : 4,
        opacity: layer.dimmed ? 0.4 : 0.95,
      })
      if (layer.label) line.bindTooltip(layer.label, { sticky: true })
      if (onSelect) line.on('click', () => onSelect(layer.key))
      line.addTo(group)

      if (!layer.dimmed) {
        focus.push(line.getBounds())
        L.marker(latlngs[0], { icon: START_ICON, title: 'Start' }).addTo(group)
        L.marker(latlngs[latlngs.length - 1], { icon: END_ICON, title: 'Finish' }).addTo(
          group,
        )
      }
    }

    if (focus.length === 0 || fittedKeyRef.current === fitKey) return
    const bounds = focus.reduce(
      (acc, b) => acc.extend(b),
      L.latLngBounds(focus[0].getSouthWest(), focus[0].getNorthEast()),
    )
    map.fitBounds(bounds, { padding: [24, 24] })
    fittedKeyRef.current = fitKey
  }, [layers, fitKey, onSelect])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const primary = layers.find((l) => !l.dimmed) ?? layers[0]

    if (markerAtDistance == null || !primary) {
      hoverMarkerRef.current?.remove()
      hoverMarkerRef.current = null
      return
    }

    const point = pointAtDistance(primary.track, markerAtDistance)
    if (!point) return
    if (hoverMarkerRef.current) {
      hoverMarkerRef.current.setLatLng([point.lat, point.lon])
    } else {
      hoverMarkerRef.current = L.circleMarker([point.lat, point.lon], {
        radius: 7,
        color: '#ffffff',
        weight: 2,
        fillColor: '#f97316',
        fillOpacity: 1,
      }).addTo(map)
    }
  }, [markerAtDistance, layers])

  // Leaflet needs an explicit pixel size, so the container is sized inline here
  // and the map re-measured whenever that height changes.
  useEffect(() => {
    mapRef.current?.invalidateSize()
  }, [height])

  return <div ref={containerRef} className="map" style={{ height }} />
}
