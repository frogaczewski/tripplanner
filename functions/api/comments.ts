import {
  MAX_AUTHOR_CHARS,
  MAX_BODY_CHARS,
  error,
  isValidId,
  json,
  serialiseComment,
  type CommentRow,
  type Env,
} from '../_shared'

const KINDS = new Set(['comment', 'note'])

/**
 * GET /api/comments?tripId=<id>[&dayId=<id>|&scope=trip]
 *
 * Without `dayId` every comment on the trip is returned, including the ones
 * attached to individual days. `scope=trip` narrows to trip-level only.
 */
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const url = new URL(request.url)
  const tripId = url.searchParams.get('tripId')
  const dayId = url.searchParams.get('dayId')
  const scope = url.searchParams.get('scope')

  if (!tripId || !isValidId(tripId)) return error(400, 'A valid tripId is required.')
  if (dayId !== null && !isValidId(dayId)) return error(400, 'Invalid dayId.')

  let statement
  if (dayId !== null) {
    statement = env.DB.prepare(
      'SELECT * FROM comments WHERE trip_id = ? AND day_id = ? ORDER BY created_at ASC',
    ).bind(tripId, dayId)
  } else if (scope === 'trip') {
    statement = env.DB.prepare(
      'SELECT * FROM comments WHERE trip_id = ? AND day_id IS NULL ORDER BY created_at ASC',
    ).bind(tripId)
  } else {
    statement = env.DB.prepare(
      'SELECT * FROM comments WHERE trip_id = ? ORDER BY created_at ASC',
    ).bind(tripId)
  }

  const { results } = await statement.all<CommentRow>()
  return json({ comments: results.map(serialiseComment) })
}

/**
 * POST /api/comments
 * Body: { tripId, dayId?, kind?: 'comment' | 'note', author?, body }
 *
 * Deliberately unauthenticated for now — Google auth will populate user_id /
 * user_email, which already exist on the table.
 */
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  let payload: Record<string, unknown>
  try {
    payload = (await request.json()) as Record<string, unknown>
  } catch {
    return error(400, 'Request body must be JSON.')
  }

  const tripId = typeof payload.tripId === 'string' ? payload.tripId.trim() : ''
  const rawDayId = payload.dayId
  const dayId =
    rawDayId === undefined || rawDayId === null || rawDayId === ''
      ? null
      : String(rawDayId).trim()
  const kind = typeof payload.kind === 'string' ? payload.kind : 'comment'
  const author =
    typeof payload.author === 'string' && payload.author.trim() !== ''
      ? payload.author.trim().slice(0, MAX_AUTHOR_CHARS)
      : 'anonymous'
  const body = typeof payload.body === 'string' ? payload.body.trim() : ''

  if (!isValidId(tripId)) return error(400, 'A valid tripId is required.')
  if (dayId !== null && !isValidId(dayId)) return error(400, 'Invalid dayId.')
  if (!KINDS.has(kind)) return error(400, "kind must be 'comment' or 'note'.")
  if (body === '') return error(400, 'Comment body cannot be empty.')
  if (body.length > MAX_BODY_CHARS) {
    return error(400, `Comment body is limited to ${MAX_BODY_CHARS} characters.`)
  }

  const row: Pick<CommentRow, 'id' | 'created_at'> = {
    id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
  }

  await env.DB.prepare(
    `INSERT INTO comments (id, trip_id, day_id, kind, author, body, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(row.id, tripId, dayId, kind, author, body, row.created_at)
    .run()

  return json(
    {
      comment: {
        id: row.id,
        tripId,
        dayId,
        kind,
        author,
        body,
        createdAt: row.created_at,
      },
    },
    { status: 201 },
  )
}
