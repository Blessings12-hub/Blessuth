import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Nav from './components/Nav'
import InAppAlerts from './components/InAppAlerts'
import WelcomeSurprise from './components/WelcomeSurprise'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Pair from './pages/Pair'
import Dashboard from './pages/Dashboard'
import Canvas from './pages/Canvas'
import Photos from './pages/Photos'
import Play from './pages/Play'
import Music from './pages/Music'
import Notes from './pages/Notes'
import Settings from './pages/Settings'
import Chat from './pages/Chat'
import Wishlist from './pages/Wishlist'
import BibleStudy from './pages/BibleStudy'

function Gate({ children }) {
  const { user, profile, loading } = useAuth()
  if (loading)
    return (
      <div className="loading-screen">
        <img src="/loading-photo.jpg" alt="" className="loading-screen-photo" />
        <div className="loading-screen-overlay">
          <span className="loading-screen-text">Loading…</span>
        </div>
      </div>
    )
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
      <Route path="/quizzes" element={<Navigate to="/play" replace />} />
      <Route
        path="/play"
        element={
          <Gate>
            <Play />
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
        path="/chat"
        element={
          <Gate>
            <Chat />
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
      <Route
        path="/settings"
        element={
          <Gate>
            <Settings />
          </Gate>
        }
      />
      <Route
        path="/wishlist"
        element={
          <Gate>
            <Wishlist />
          </Gate>
        }
      />
      <Route
        path="/bible"
        element={
          <Gate>
            <BibleStudy />
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
          <InAppAlerts />
          <WelcomeSurprise />
          <AppRoutes />
          <Nav />
        </div>
      </HashRouter>
    </AuthProvider>
  )
}
