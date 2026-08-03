import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabase/config'
import { useAuth } from '../context/AuthContext'

function daysUntil(dateStr) {
  if (!dateStr) return null
  const target = new Date(dateStr + 'T00:00:00')
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const diff = Math.ceil((target - now) / (1000 * 60 * 60 * 24))
  return diff
}

export default function Dashboard() {
  const { user, profile, couple, partnerName, logout } = useAuth()
  const [editingDate, setEditingDate] = useState(false)
  const [dateInput, setDateInput] = useState(couple?.next_visit_date || '')

  const days = daysUntil(couple?.next_visit_date)

  async function saveDate(e) {
    e.preventDefault()
    if (!couple) return
    await supabase
      .from('couples')
      .update({ next_visit_date: dateInput || null })
      .eq('id', couple.id)
    setEditingDate(false)
  }

  const tiles = [
    { to: '/canvas', label: 'Shared Canvas', icon: '🎨', desc: 'Doodle together, live' },
    { to: '/photos', label: 'Photo Memories', icon: '📸', desc: 'Your shared album' },
    { to: '/quizzes', label: 'Couple Quiz', icon: '💭', desc: 'How well do you know each other?' },
    { to: '/location', label: 'Where you both are', icon: '📍', desc: 'Distance between you' },
    { to: '/music', label: 'Mood & Music', icon: '🎧', desc: "What you're feeling / playing" },
    { to: '/notes', label: 'Love Notes', icon: '💌', desc: 'Little messages, anytime' },
  ]

  return (
    <div className="screen with-nav">
      <header className="dash-header">
        <div>
          <h1>Hi {profile?.display_name} 👋</h1>
          <p className="subtitle">
            {partnerName ? `Connected with ${partnerName}` : 'Waiting to connect…'}
          </p>
        </div>
        <button className="icon-btn" onClick={logout} title="Log out">
          ⏻
        </button>
      </header>

      <div className="countdown-card">
        {editingDate ? (
          <form onSubmit={saveDate} className="countdown-form">
            <label>Next time you'll see each other:</label>
            <input
              type="date"
              value={dateInput}
              onChange={(e) => setDateInput(e.target.value)}
            />
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
                <div className="countdown-number">
                  {days > 0 ? days : days === 0 ? '🎉' : '—'}
                </div>
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
