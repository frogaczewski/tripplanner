export interface Env {
  DB: D1Database
  /**
   * Optional. When set, /api/export requires `Authorization: Bearer <token>`
   * so the LLM-facing dump is not world-readable.
   */
  EXPORT_TOKEN?: string
}

export interface CommentRow {
  id: string
  trip_id: string
  day_id: string | null
  kind: string
  author: string
  body: string
  created_at: string
  user_id: string | null
  user_email: string | null
  metadata: string | null
  llm_processed_at: string | null
  llm_result: string | null
}

export const MAX_BODY_CHARS = 4000
export const MAX_AUTHOR_CHARS = 60
export const MAX_ID_CHARS = 100

export function json(data: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...(init.headers ?? {}),
    },
  })
}

export function error(status: number, message: string): Response {
  return json({ error: message }, { status })
}

/** Ids come from the repo's trips.json, so keep them to a slug-ish shape. */
export function isValidId(value: string): boolean {
  return value.length > 0 && value.length <= MAX_ID_CHARS && /^[A-Za-z0-9._-]+$/.test(value)
}

export function serialiseComment(row: CommentRow) {
  return {
    id: row.id,
    tripId: row.trip_id,
    dayId: row.day_id,
    kind: row.kind,
    author: row.author,
    body: row.body,
    createdAt: row.created_at,
  }
}
