import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="page">
      <h1>Not found</h1>
      <p className="muted">That trip or day does not exist.</p>
      <p>
        <Link to="/">Back to all trips</Link>
      </p>
    </div>
  )
}
