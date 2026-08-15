import { useCallback, useEffect, useState } from 'react'
import { createComment, fetchComments } from '../lib/api'
import type { Comment, CommentKind } from '../types'

interface Props {
  tripId: string
  dayId?: string
  title?: string
  /** Copy explaining what this thread is for. */
  hint?: string
}

const AUTHOR_STORAGE_KEY = 'tripplanner.author'

function formatTimestamp(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

export default function Comments({ tripId, dayId, title = 'Comments & notes', hint }: Props) {
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [author, setAuthor] = useState(
    () => localStorage.getItem(AUTHOR_STORAGE_KEY) ?? '',
  )
  const [body, setBody] = useState('')
  const [kind, setKind] = useState<CommentKind>('comment')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const load = useCallback(() => {
    let active = true
    setLoading(true)
    fetchComments(tripId, dayId ? { dayId } : {})
      .then((list) => {
        if (!active) return
        setComments(list)
        setLoadError(null)
      })
      .catch((err: Error) => {
        if (active) setLoadError(err.message)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [tripId, dayId])

  useEffect(() => load(), [load])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (body.trim() === '' || submitting) return

    setSubmitting(true)
    setSubmitError(null)
    try {
      const created = await createComment({
        tripId,
        dayId: dayId ?? null,
        kind,
        author: author.trim() || 'anonymous',
        body: body.trim(),
      })
      setComments((prev) => [...prev, created])
      setBody('')
      if (author.trim()) localStorage.setItem(AUTHOR_STORAGE_KEY, author.trim())
    } catch (err) {
      setSubmitError((err as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="comments">
      <h2>{title}</h2>
      {hint && <p className="muted">{hint}</p>}

      <form className="comment-form" onSubmit={handleSubmit}>
        <div className="comment-form-row">
          <input
            type="text"
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            placeholder="Your name (optional)"
            maxLength={60}
            aria-label="Your name"
          />
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as CommentKind)}
            aria-label="Entry type"
          >
            <option value="comment">Comment</option>
            <option value="note">Note</option>
          </select>
        </div>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={
            dayId
              ? 'Anything about this day — timings, bail-outs, gear, doubts…'
              : 'Anything about this trip as a whole…'
          }
          rows={4}
          maxLength={4000}
          required
        />
        <div className="comment-form-actions">
          <span className="muted">{body.length}/4000</span>
          <button type="submit" disabled={submitting || body.trim() === ''}>
            {submitting ? 'Saving…' : 'Post'}
          </button>
        </div>
        {submitError && <p className="error">{submitError}</p>}
      </form>

      {loading && <p className="muted">Loading comments…</p>}
      {loadError && (
        <p className="error">
          Could not load comments: {loadError}{' '}
          <button type="button" className="link-button" onClick={() => load()}>
            Retry
          </button>
        </p>
      )}
      {!loading && !loadError && comments.length === 0 && (
        <p className="muted">Nothing here yet — be the first.</p>
      )}

      <ul className="comment-list">
        {comments.map((comment) => (
          <li key={comment.id} className={`comment comment-${comment.kind}`}>
            <div className="comment-meta">
              <strong>{comment.author}</strong>
              <span className={`badge badge-${comment.kind}`}>{comment.kind}</span>
              <time dateTime={comment.createdAt}>{formatTimestamp(comment.createdAt)}</time>
            </div>
            <p className="comment-body">{comment.body}</p>
          </li>
        ))}
      </ul>
    </section>
  )
}
