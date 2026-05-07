import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { isAuthenticated } from './lib/api'
import Login from './pages/Login'
import EventList from './pages/EventList'
import NewEvent from './pages/NewEvent'
import EventSetup from './pages/EventSetup'
import EventAdmin from './pages/EventAdmin'
import UserAdmin from './pages/UserAdmin'
import ListPage from './pages/ListPage'

function RequireAuth({ children }: { children: React.ReactNode }) {
  return isAuthenticated() ? <>{children}</> : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<RequireAuth><EventList /></RequireAuth>} />
        <Route path="/events/new" element={<RequireAuth><NewEvent /></RequireAuth>} />
        <Route path="/events/:id/setup" element={<RequireAuth><EventSetup /></RequireAuth>} />
        <Route path="/events/:id/admin" element={<RequireAuth><EventAdmin /></RequireAuth>} />
        <Route path="/users" element={<RequireAuth><UserAdmin /></RequireAuth>} />
        <Route path="/list/:slug" element={<ListPage />} />
      </Routes>
    </BrowserRouter>
  )
}
