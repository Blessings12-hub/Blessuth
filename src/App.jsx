import { lazy, Suspense } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Nav from './components/Nav'
import InAppAlerts from './components/InAppAlerts'
import WelcomeSurprise from './components/WelcomeSurprise'
import ErrorBoundary from './components/ErrorBoundary'

const Login = lazy(() => import('./pages/Login'))
const Signup = lazy(() => import('./pages/Signup'))
const Pair = lazy(() => import('./pages/Pair'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Canvas = lazy(() => import('./pages/Canvas'))
const Photos = lazy(() => import('./pages/Photos'))
const Play = lazy(() => import('./pages/Play'))
const Music = lazy(() => import('./pages/Music'))
const Notes = lazy(() => import('./pages/Notes'))
const Settings = lazy(() => import('./pages/Settings'))
const Chat = lazy(() => import('./pages/Chat'))
const Wishlist = lazy(() => import('./pages/Wishlist'))
const BibleStudy = lazy(() => import('./pages/BibleStudy'))

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
    <Suspense fallback={<div className="center-screen" role="status">Loading your space…</div>}>
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
    </Suspense>
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
