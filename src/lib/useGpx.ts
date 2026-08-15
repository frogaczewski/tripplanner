import { useEffect, useState } from 'react'
import { parseGpx, type Track } from './gpx'

/** Parsed tracks are immutable for the life of the page, so cache by URL. */
const cache = new Map<string, Promise<Track>>()

export function loadTrack(url: string): Promise<Track> {
  let pending = cache.get(url)
  if (!pending) {
    pending = fetch(url)
      .then(async (res) => {
        if (!res.ok) throw new Error(`Could not load ${url} (HTTP ${res.status})`)
        return parseGpx(await res.text())
      })
      .catch((err) => {
        cache.delete(url)
        throw err
      })
    cache.set(url, pending)
  }
  return pending
}

export interface AsyncTrack {
  track: Track | null
  error: string | null
  loading: boolean
}

export function useTrack(url: string | undefined): AsyncTrack {
  const [state, setState] = useState<AsyncTrack>({
    track: null,
    error: null,
    loading: Boolean(url),
  })

  useEffect(() => {
    if (!url) {
      setState({ track: null, error: null, loading: false })
      return
    }
    let active = true
    setState({ track: null, error: null, loading: true })
    loadTrack(url)
      .then((track) => {
        if (active) setState({ track, error: null, loading: false })
      })
      .catch((err: Error) => {
        if (active) setState({ track: null, error: err.message, loading: false })
      })
    return () => {
      active = false
    }
  }, [url])

  return state
}

/** Loads every day's track for a trip, keyed by GPX url. */
export function useTracks(urls: string[]): {
  tracks: Map<string, Track>
  loading: boolean
} {
  const key = urls.join('|')
  const [tracks, setTracks] = useState<Map<string, Track>>(new Map())
  const [loading, setLoading] = useState(urls.length > 0)

  useEffect(() => {
    let active = true
    const list = key ? key.split('|') : []
    if (list.length === 0) {
      setTracks(new Map())
      setLoading(false)
      return
    }
    setLoading(true)
    Promise.all(
      list.map((url) =>
        loadTrack(url)
          .then((track) => [url, track] as const)
          .catch(() => null),
      ),
    ).then((entries) => {
      if (!active) return
      setTracks(new Map(entries.filter((e): e is readonly [string, Track] => e !== null)))
      setLoading(false)
    })
    return () => {
      active = false
    }
  }, [key])

  return { tracks, loading }
}
