import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const items = [
  { to: '/', label: 'Home', icon: '🏠' },
  { to: '/canvas', label: 'Canvas', icon: '🎨' },
  { to: '/photos', label: 'Photos', icon: '📸' },
  { to: '/quizzes', label: 'Quiz', icon: '💭' },
  { to: '/location', label: 'Map', icon: '📍' },
  { to: '/music', label: 'Mood', icon: '🎧' },
  { to: '/notes', label: 'Notes', icon: '💌' },
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
          <span className="nav-icon">{item.icon}</span>
          <span className="nav-label">{item.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
