import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { HomeIcon, CanvasIcon, PhotoIcon, QuizIcon, MapPinIcon, HeadphonesIcon, MailIcon } from './Icons'

const items = [
  { to: '/', label: 'Home', Icon: HomeIcon },
  { to: '/canvas', label: 'Canvas', Icon: CanvasIcon },
  { to: '/photos', label: 'Photos', Icon: PhotoIcon },
  { to: '/quizzes', label: 'Quiz', Icon: QuizIcon },
  { to: '/location', label: 'Map', Icon: MapPinIcon },
  { to: '/music', label: 'Mood', Icon: HeadphonesIcon },
  { to: '/notes', label: 'Notes', Icon: MailIcon },
]

export default function Nav() {
  const { user, profile } = useAuth()
  const location = useLocation()
  const hideOn = ['/login', '/signup', '/pair']
  if (!user || !profile?.couple_id || hideOn.includes(location.pathname)) {
    return null
  }
  return (
    <nav className="bottom-nav">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) =>
            'nav-item' + (isActive ? ' active' : '')
          }
        >
          <span className="nav-icon">
            <item.Icon size={20} />
          </span>
          <span className="nav-label">{item.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
