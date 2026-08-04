import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Nav from './components/Nav'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Pair from './pages/Pair'
import Dashboard from './pages/Dashboard'
import Canvas from './pages/Canvas'
import Photos from './pages/Photos'
import Quizzes from './pages/Quizzes'
import LocationPage from './pages/LocationPage'
import Music from './pages/Music'
import Notes from './pages/Notes'

function Gate({ children }) {
  const { user, profile, loading } = useAuth()
  if (loading) return <div className="center-screen">Loading…</div>
  if (!user) return <Navigate to="/login" replace />
  if (!profile?.couple_id) return <Navigate to="/pair" replace />
  return children
}

function AppRoutes() {
  const { user } = useAuth()
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route
        path="/pair"
        element={user ? <Pair /> : <Navigate to="/login" replace />}
      />
      <Route
        path="/"
        element={
          <Gate>
            <Dashboard />
          </Gate>
        }
      />
      <Route
        path="/canvas"
        element={
          <Gate>
            <Canvas />
          </Gate>
        }
      />
      <Route
        path="/photos"
        element={
          <Gate>
            <Photos />
          </Gate>
        }
      />
      <Route
        path="/quizzes"
        element={
          <Gate>
            <Quizzes />
          </Gate>
        }
      />
      <Route
        path="/location"
        element={
          <Gate>
            <LocationPage />
          </Gate>
        }
      />
      <Route
        path="/music"
        element={
          <Gate>
            <Music />
          </Gate>
        }
      />
      <Route
        path="/notes"
        element={
          <Gate>
            <Notes />
          </Gate>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <div className="app-shell">
          <AppRoutes />
          <Nav />
        </div>
      </HashRouter>
    </AuthProvider>
  )
}
