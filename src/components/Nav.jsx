import { useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { supabase } from '../supabase/config'
import { useAuth } from '../context/AuthContext'
import { HomeIcon, CanvasIcon, QuizIcon, HeadphonesIcon, MailIcon, MessageIcon, GiftIcon, MapPinIcon } from './Icons'

const items = [
  { to: '/', label: 'Home', Icon: HomeIcon },
  { to: '/canvas', label: 'Canvas', Icon: CanvasIcon },
  { to: '/chat', label: 'Chat', Icon: MessageIcon },
  { to: '/play', label: 'Play', Icon: QuizIcon },
  { to: '/wishlist', label: 'Wishlist', Icon: GiftIcon },
  { to: '/location', label: 'Location', Icon: MapPinIcon },
  { to: '/music', label: 'Mood', Icon: HeadphonesIcon },
  { to: '/notes', label: 'Notes', Icon: MailIcon },
]

export default function Nav() {
  const { user, profile } = useAuth()
  const location = useLocation()
  const hideOn = ['/login', '/signup', '/pair']
  const [unread, setUnread] = useState(0)

  useEffect(() => {
    if (!user || !profile?.couple_id) {
      setUnread(0)
      return
    }
    let cancelled = false

    async function loadUnread() {
      const { count } = await supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('couple_id', profile.couple_id)
        .neq('sender_id', user.id)
        .is('read_at', null)
      if (!cancelled) setUnread(count || 0)
    }

    loadUnread()
    const channel = supabase
      .channel(`nav-messages-${profile.couple_id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages', filter: `couple_id=eq.${profile.couple_id}` },
        loadUnread
      )
      .subscribe()
    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [user?.id, profile?.couple_id])

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
            {item.to === '/chat' && unread > 0 && (
              <span className="nav-badge">{unread > 9 ? '9+' : unread}</span>
            )}
          </span>
          <span className="nav-label">{item.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
