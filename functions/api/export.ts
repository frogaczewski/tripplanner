import { error, isValidId, json, type CommentRow, type Env } from '../_shared'

const MAX_LIMIT = 1000

/**
 * GET /api/export?since=<iso>&tripId=<id>&limit=<n>&unprocessed=1
 *
 * Bulk dump for downstream LLM processing. Rows include the columns an LLM pass
 * would write back to (`metadata`, `llm_processed_at`, `llm_result`) so a job can
 * pull, annotate and reconcile by id.
 *
 * Set the EXPORT_TOKEN secret to require `Authorization: Bearer <token>`.
 */
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  if (env.EXPORT_TOKEN) {
    const provided = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
    if (provided !== env.EXPORT_TOKEN) return error(401, 'Unauthorized.')
  }

  const url = new URL(request.url)
  const since = url.searchParams.get('since')
  const tripId = url.searchParams.get('tripId')
  const unprocessed = url.searchParams.get('unprocessed') === '1'
  const limitParam = Number(url.searchParams.get('limit') ?? MAX_LIMIT)
  const limit = Number.isFinite(limitParam)
    ? Math.min(Math.max(Math.trunc(limitParam), 1), MAX_LIMIT)
    : MAX_LIMIT

  if (tripId !== null && !isValidId(tripId)) return error(400, 'Invalid tripId.')
  if (since !== null && Number.isNaN(Date.parse(since))) {
    return error(400, 'since must be an ISO-8601 timestamp.')
  }

  const conditions: string[] = []
  const bindings: unknown[] = []
  if (since !== null) {
    conditions.push('created_at > ?')
    bindings.push(new Date(since).toISOString())
  }
  if (tripId !== null) {
    conditions.push('trip_id = ?')
    bindings.push(tripId)
  }
  if (unprocessed) conditions.push('llm_processed_at IS NULL')

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  const { results } = await env.DB.prepare(
    `SELECT * FROM comments ${where} ORDER BY created_at ASC LIMIT ?`,
  )
    .bind(...bindings, limit)
    .all<CommentRow>()

  return json({
    count: results.length,
    limit,
    comments: results.map((row) => ({
      id: row.id,
      tripId: row.trip_id,
      dayId: row.day_id,
      kind: row.kind,
      author: row.author,
      body: row.body,
      createdAt: row.created_at,
      userId: row.user_id,
      userEmail: row.user_email,
      metadata: row.metadata ? safeParse(row.metadata) : null,
      llmProcessedAt: row.llm_processed_at,
      llmResult: row.llm_result ? safeParse(row.llm_result) : null,
    })),
  })
}

function safeParse(value: string): unknown {
  try {
    return JSON.parse(value)
  } catch {
    return value
  }
}
