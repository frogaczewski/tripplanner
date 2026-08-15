import type { Comment, CommentKind } from '../types'

async function request<T>(input: string, init?: RequestInit): Promise<T> {
  const res = await fetch(input, init)
  const text = await res.text()
  let payload: unknown = null
  if (text) {
    try {
      payload = JSON.parse(text)
    } catch {
      payload = null
    }
  }
  if (!res.ok) {
    const message =
      payload && typeof payload === 'object' && 'error' in payload
        ? String((payload as { error: unknown }).error)
        : `Request failed (HTTP ${res.status})`
    throw new Error(message)
  }
  return payload as T
}

export function fetchComments(
  tripId: string,
  options: { dayId?: string; scope?: 'trip' } = {},
): Promise<Comment[]> {
  const params = new URLSearchParams({ tripId })
  if (options.dayId) params.set('dayId', options.dayId)
  if (options.scope) params.set('scope', options.scope)
  return request<{ comments: Comment[] }>(`/api/comments?${params}`).then(
    (r) => r.comments,
  )
}

export function createComment(input: {
  tripId: string
  dayId?: string | null
  kind: CommentKind
  author: string
  body: string
}): Promise<Comment> {
  return request<{ comment: Comment }>('/api/comments', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  }).then((r) => r.comment)
}
