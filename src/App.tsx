import { Link, Route, Routes } from 'react-router-dom'
import DayDetail from './pages/DayDetail'
import Home from './pages/Home'
import NotFound from './pages/NotFound'
import PlanDetail from './pages/PlanDetail'
import TripDetail from './pages/TripDetail'

export default function App() {
  return (
    <>
      <header className="site-header">
        <Link to="/" className="site-title">
          🗺️ Trip Planner
        </Link>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/plans/:planId" element={<PlanDetail />} />
          <Route path="/trips/:tripId" element={<TripDetail />} />
          <Route path="/trips/:tripId/days/:dayId" element={<DayDetail />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <footer className="site-footer">
        <p className="muted">
          Map data © OpenStreetMap contributors · GPX files are committed under{' '}
          <code>public/gpx/</code>
        </p>
      </footer>
    </>
  )
}
