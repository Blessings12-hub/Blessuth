import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabase/config'
import { useAuth } from '../context/AuthContext'
import Logo from '../components/Logo'
import DailyQuestion from '../components/DailyQuestion'
import DistanceWidget from '../components/DistanceWidget'

function daysUntil(dateStr) {
  if (!dateStr) return null
  const target = new Date(dateStr + 'T00:00:00')
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  return Math.ceil((target - now) / (1000 * 60 * 60 * 24))
}

function daysSince(dateStr) {
  if (!dateStr) return null
  const start = new Date(dateStr + 'T00:00:00')
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  return Math.floor((now - start) / (1000 * 60 * 60 * 24))
}

function haversineKm(a, b) {
  const R = 6371
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const lat1 = (a.lat * Math.PI) / 180
  const lat2 = (b.lat * Math.PI) / 180
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

// Only write a new location if we've moved meaningfully or enough time passed —
// keeps the widget "live" without hammering the database on every GPS tick.
const MIN_MOVE_KM = 0.5
const MIN_INTERVAL_MS = 5 * 60 * 1000

export default function Dashboard() {
  const { user, profile, couple, partnerName, partnerTimezone, logout } = useAuth()
  const [editingDate, setEditingDate] = useState(false)
  const [dateInput, setDateInput] = useState(couple?.next_visit_date || '')
  const [editingSince, setEditingSince] = useState(false)
  const [sinceInput, setSinceInput] = useState(couple?.together_since || '')
  const [now, setNow] = useState(new Date())
  const [pingSent, setPingSent] = useState(false)
  const lastWrite = useRef({ coords: null, at: 0 })

  const days = daysUntil(couple?.next_visit_date)
  const togetherDays = daysSince(couple?.together_since)

  // Live-updating clock (for partner's local time)
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000)
    return () => clearInterval(t)
  }, [])

  // Background location tracking — keeps the distance widget "live" while the
  // app is open, without needing to visit a separate screen or tap a button.
  useEffect(() => {
    if (!couple || !navigator.geolocation) return
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        const last = lastWrite.current
        const elapsed = Date.now() - last.at
        const moved = last.coords ? haversineKm(last.coords, coords) : Infinity
        if (elapsed < MIN_INTERVAL_MS && moved < MIN_MOVE_KM) return
        lastWrite.current = { coords, at: Date.now() }
        supabase.from('locations').upsert({
          couple_id: couple.id,
          user_id: user.id,
          lat: coords.lat,
          lng: coords.lng,
          label: profile?.display_name || 'Me',
          updated_at: new Date().toISOString(),
        })
      },
      () => {
        /* silently ignore — user may have denied permission; they can still
           share manually from the Map tab */
      },
      { enableHighAccuracy: false, maximumAge: 60000 }
    )
    return () => navigator.geolocation.clearWatch(watchId)
  }, [couple?.id, user?.id, profile?.display_name])

  const partnerTime = partnerTimezone
    ? now.toLocaleTimeString('en-US', {
        timeZone: partnerTimezone,
        hour: 'numeric',
        minute: '2-digit',
      })
    : null

  async function saveDate(e) {
    e.preventDefault()
    if (!couple) return
    await supabase.from('couples').update({ next_visit_date: dateInput || null }).eq('id', couple.id)
    setEditingDate(false)
  }

  async function saveSince(e) {
    e.preventDefault()
    if (!couple) return
    await supabase.from('couples').update({ together_since: sinceInput || null }).eq('id', couple.id)
    setEditingSince(false)
  }

  async function sendPing() {
    if (!couple) return
    await supabase.from('notes').insert({
      couple_id: couple.id,
      text: '💭 Thinking of you right now',
      from_name: profile?.display_name || 'Me',
      from_uid: user.id,
    })
    setPingSent(true)
    setTimeout(() => setPingSent(false), 2500)
  }

  const tiles = [
    { to: '/canvas', label: 'Shared Canvas', icon: '🎨', desc: 'Doodle together, live' },
    { to: '/photos', label: 'Photo Memories', icon: '📸', desc: 'Your shared album' },
    { to: '/quizzes', label: 'Couple Quiz', icon: '💭', desc: 'How well do you know each other?' },
    { to: '/location', label: 'Full Map', icon: '📍', desc: 'See it on the map' },
    { to: '/music', label: 'Mood & Music', icon: '🎧', desc: "What you're feeling / playing" },
    { to: '/notes', label: 'Love Notes', icon: '💌', desc: 'Little messages, anytime' },
  ]

  return (
    <div className="screen with-nav">
      <div className="brand-row">
        <Logo size={26} withWordmark />
      </div>

      <header className="dash-header">
        <div className="dash-header-left">
          <div className="couple-avatars">
            <span className="avatar mine">{(profile?.display_name || '?')[0].toUpperCase()}</span>
            <span className="avatar theirs">{(partnerName || '?')[0].toUpperCase()}</span>
          </div>
          <div>
            <h1>Hi {profile?.display_name} 👋</h1>
            <p className="subtitle">
              {partnerName ? `Connected with ${partnerName}` : 'Waiting to connect…'}
            </p>
          </div>
        </div>
        <button className="icon-btn" onClick={logout} title="Log out">
          ⏻
        </button>
      </header>

      <DailyQuestion />

      <DistanceWidget />

      {/* Live widgets */}
      <div className="widget-grid">
        <div className="widget-card">
          <div className="widget-icon">🕐</div>
          {partnerTime ? (
            <>
              <div className="widget-value">{partnerTime}</div>
              <div className="widget-label">{partnerName || 'Partner'}'s time</div>
            </>
          ) : (
            <div className="widget-label">Partner's time unknown yet</div>
          )}
        </div>

        <div className="widget-card" onClick={() => setEditingSince(true)}>
          <div className="widget-icon">💞</div>
          {togetherDays !== null ? (
            <>
              <div className="widget-value">{togetherDays}</div>
              <div className="widget-label">days together</div>
            </>
          ) : (
            <div className="widget-label">Tap to set your start date</div>
          )}
        </div>

        <button className="widget-card ping-card" onClick={sendPing}>
          <div className="widget-icon">{pingSent ? '💌' : '💭'}</div>
          <div className="widget-label">{pingSent ? 'Sent!' : 'Thinking of you'}</div>
        </button>
      </div>

      {editingSince && (
        <form onSubmit={saveSince} className="inline-edit-form">
          <label>When did you get together?</label>
          <input type="date" value={sinceInput} onChange={(e) => setSinceInput(e.target.value)} />
          <div className="row">
            <button type="submit">Save</button>
            <button type="button" onClick={() => setEditingSince(false)}>
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="countdown-card">
        {editingDate ? (
          <form onSubmit={saveDate} className="countdown-form">
            <label>Next time you'll see each other:</label>
            <input type="date" value={dateInput} onChange={(e) => setDateInput(e.target.value)} />
            <div className="row">
              <button type="submit">Save</button>
              <button type="button" onClick={() => setEditingDate(false)}>
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <div onClick={() => setEditingDate(true)} className="countdown-display">
            {couple?.next_visit_date ? (
              <>
                <div className="countdown-number">{days > 0 ? days : days === 0 ? '🎉' : '—'}</div>
                <div className="countdown-label">
                  {days > 0
                    ? `day${days === 1 ? '' : 's'} until you're together`
                    : days === 0
                    ? "It's today!"
                    : 'Update your next visit'}
                </div>
              </>
            ) : (
              <div className="countdown-label">Tap to set your next visit date 📅</div>
            )}
          </div>
        )}
      </div>

      <div className="tile-grid">
        {tiles.map((t) => (
          <Link to={t.to} key={t.to} className="tile">
            <div className="tile-icon">{t.icon}</div>
            <div className="tile-label">{t.label}</div>
            <div className="tile-desc">{t.desc}</div>
          </Link>
        ))}
      </div>
    </div>
  )
}
