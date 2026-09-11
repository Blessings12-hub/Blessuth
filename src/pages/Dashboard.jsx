import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabase/config'
import { useAuth } from '../context/AuthContext'
import Logo from '../components/Logo'
import DailyQuestion from '../components/DailyQuestion'
import OnThisDay from '../components/OnThisDay'
import DistanceWidget from '../components/DistanceWidget'
import {
  SettingsIcon,
  LogoutIcon,
  ClockIcon,
  HeartIcon,
  CakeIcon,
  MessageIcon,
  MailIcon,
  CanvasIcon,
  PhotoIcon,
  QuizIcon,
  HeadphonesIcon,
  GiftIcon,
  BookIcon,
} from '../components/Icons'

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

function daysUntilBirthday(dateStr) {
  if (!dateStr) return null
  const bday = new Date(dateStr + 'T00:00:00')
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  let next = new Date(now.getFullYear(), bday.getMonth(), bday.getDate())
  if (next < now) next = new Date(now.getFullYear() + 1, bday.getMonth(), bday.getDate())
  return Math.round((next - now) / (1000 * 60 * 60 * 24))
}

function yearsTogether(dateStr) {
  if (!dateStr) return null
  const start = new Date(dateStr + 'T00:00:00')
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  let years = now.getFullYear() - start.getFullYear()
  const hadAnniversaryThisYear =
    now.getMonth() > start.getMonth() ||
    (now.getMonth() === start.getMonth() && now.getDate() >= start.getDate())
  if (!hadAnniversaryThisYear) years -= 1
  return years
}

export default function Dashboard() {
  const { user, profile, couple, partnerName, partnerTimezone, partnerBirthday, partnerAvatarUrl, logout } = useAuth()
  const [showPhotos, setShowPhotos] = useState(false)
  const [editingDate, setEditingDate] = useState(false)
  const [dateInput, setDateInput] = useState(couple?.next_visit_date || '')
  const [editingSince, setEditingSince] = useState(false)
  const [sinceInput, setSinceInput] = useState(couple?.together_since || '')
  const [editingBirthday, setEditingBirthday] = useState(false)
  const [birthdayInput, setBirthdayInput] = useState(profile?.birthday || '')
  const [now, setNow] = useState(new Date())
  const [pingSent, setPingSent] = useState(false)
  const [actionError, setActionError] = useState('')

  const days = daysUntil(couple?.next_visit_date)
  const togetherDays = daysSince(couple?.together_since)
  const myBirthdayIn = daysUntilBirthday(profile?.birthday)
  const partnerBirthdayIn = daysUntilBirthday(partnerBirthday)
  const anniversaryIn = daysUntilBirthday(couple?.together_since)
  const yearsCount = yearsTogether(couple?.together_since)

  // Live-updating clock (for partner's local time)
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000)
    return () => clearInterval(t)
  }, [])

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
    setActionError('')
    const { error } = await supabase.from('couples').update({ next_visit_date: dateInput || null }).eq('id', couple.id)
    if (error) { setActionError('Your visit date could not be saved.'); return }
    setEditingDate(false)
  }

  async function saveSince(e) {
    e.preventDefault()
    if (!couple) return
    setActionError('')
    const { error } = await supabase.from('couples').update({ together_since: sinceInput || null }).eq('id', couple.id)
    if (error) { setActionError('Your start date could not be saved.'); return }
    setEditingSince(false)
  }

  async function saveBirthday(e) {
    e.preventDefault()
    if (!user) return
    setActionError('')
    const { error } = await supabase.from('profiles').update({ birthday: birthdayInput || null }).eq('id', user.id)
    if (error) { setActionError('Your birthday could not be saved.'); return }
    setEditingBirthday(false)
  }

  async function sendPing() {
    if (!couple) return
    setActionError('')
    const { error } = await supabase.from('notes').insert({
      couple_id: couple.id,
      text: 'Thinking of you right now',
      from_name: profile?.display_name || 'Me',
      from_uid: user.id,
    })
    if (error) { setActionError('Your note could not be sent.'); return }
    setPingSent(true)
    setTimeout(() => setPingSent(false), 2500)
  }

  const tiles = [
    { to: '/chat', label: 'Chat', Icon: MessageIcon, desc: 'A running conversation' },
    { to: '/canvas', label: 'Shared Canvas', Icon: CanvasIcon, desc: 'Doodle together, live' },
    { to: '/photos', label: 'Photo Memories', Icon: PhotoIcon, desc: 'Your shared album' },
    { to: '/wishlist', label: 'Wishlist', Icon: GiftIcon, desc: "Pin things you'd like to get" },
    { to: '/bible', label: 'Bible Study', Icon: BookIcon, desc: 'Share verses, get prayer points, set reminders' },
    { to: '/play', label: 'Quizzes & Games', Icon: QuizIcon, desc: 'How well do you know each other?' },
    { to: '/music', label: 'Mood & Music', Icon: HeadphonesIcon, desc: "What you're feeling / playing" },
    { to: '/notes', label: 'Love Notes', Icon: MailIcon, desc: 'Little messages, anytime' },
  ]

  return (
    <div className="screen with-nav">
      <div className="brand-row">
        <Logo size={26} withWordmark />
      </div>

      <header className="dash-header">
        <div className="dash-header-left">
          <button
            type="button"
            className="couple-avatars"
            onClick={() => setShowPhotos(true)}
            aria-label="View profile pictures"
          >
            <span className="avatar mine">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt={`${profile?.display_name || 'You'}'s profile picture`} />
              ) : (
                (profile?.display_name || '?')[0].toUpperCase()
              )}
            </span>
            <span className="avatar theirs">
              {partnerAvatarUrl ? (
                <img src={partnerAvatarUrl} alt={`${partnerName || 'Partner'}'s profile picture`} />
              ) : (
                (partnerName || '?')[0].toUpperCase()
              )}
            </span>
          </button>
          <div>
            <h1>Hi {profile?.display_name}</h1>
            <p className="subtitle">
              {partnerName ? `Connected with ${partnerName}` : 'Waiting to connect…'}
            </p>
          </div>
        </div>
        <div className="header-actions">
          <Link className="icon-btn" to="/settings" title="Settings">
            <SettingsIcon size={18} />
          </Link>
          <button className="icon-btn" onClick={logout} title="Log out">
            <LogoutIcon size={18} />
          </button>
        </div>
      </header>

      {(myBirthdayIn === 0 || partnerBirthdayIn === 0) && (
        <div className="birthday-banner">
          {myBirthdayIn === 0 && partnerBirthdayIn === 0
            ? "It's both your birthdays today!"
            : myBirthdayIn === 0
            ? 'Happy birthday to you!'
            : `It's ${partnerName || 'your partner'}'s birthday today!`}
        </div>
      )}

      {anniversaryIn === 0 && (
        <div className="birthday-banner">
          🎉 Happy anniversary — {yearsCount} year{yearsCount === 1 ? '' : 's'} together!
        </div>
      )}

      {actionError && <p className="error" role="alert">{actionError}</p>}

      <DailyQuestion />

      <OnThisDay />

      <DistanceWidget />

      {/* Live widgets */}
      <div className="widget-grid">
        <div className="widget-card">
          <div className="widget-icon"><ClockIcon size={20} /></div>
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
          <div className="widget-icon"><HeartIcon size={20} /></div>
          {togetherDays !== null ? (
            <>
              <div className="widget-value">{togetherDays}</div>
              <div className="widget-label">
                days together
                {anniversaryIn === 0
                  ? ` · 🎉 ${yearsCount}yr anniversary today!`
                  : anniversaryIn !== null
                  ? ` · ${anniversaryIn}d to anniversary`
                  : ''}
              </div>
            </>
          ) : (
            <div className="widget-label">Tap to set your start date</div>
          )}
        </div>

        <button className="widget-card ping-card" onClick={sendPing}>
          <div className="widget-icon">{pingSent ? <MailIcon size={20} /> : <MessageIcon size={20} />}</div>
          <div className="widget-label">{pingSent ? 'Sent!' : 'Thinking of you'}</div>
        </button>

        <div className="widget-card" onClick={() => setEditingBirthday(true)}>
          <div className="widget-icon"><CakeIcon size={20} /></div>
          {myBirthdayIn !== null ? (
            <>
              <div className="widget-value">{myBirthdayIn === 0 ? 'Today' : myBirthdayIn}</div>
              <div className="widget-label">{myBirthdayIn === 0 ? 'Today!' : 'until your birthday'}</div>
            </>
          ) : (
            <div className="widget-label">Tap to add your birthday</div>
          )}
        </div>

        <div className="widget-card">
          <div className="widget-icon"><CakeIcon size={20} /></div>
          {partnerBirthdayIn !== null ? (
            <>
              <div className="widget-value">{partnerBirthdayIn === 0 ? 'Today' : partnerBirthdayIn}</div>
              <div className="widget-label">
                {partnerBirthdayIn === 0 ? "It's today!" : `until ${partnerName || 'their'}'s birthday`}
              </div>
            </>
          ) : (
            <div className="widget-label">{partnerName || 'Partner'} hasn't added a birthday yet</div>
          )}
        </div>
      </div>

      {editingBirthday && (
        <form onSubmit={saveBirthday} className="inline-edit-form">
          <label>Your birthday</label>
          <input
            type="date"
            value={birthdayInput}
            onChange={(e) => setBirthdayInput(e.target.value)}
          />
          <div className="row">
            <button type="submit">Save</button>
            <button type="button" onClick={() => setEditingBirthday(false)}>
              Cancel
            </button>
          </div>
        </form>
      )}

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
                <div className="countdown-number">{days > 0 ? days : days === 0 ? 'Today' : '—'}</div>
                <div className="countdown-label">
                  {days > 0
                    ? `day${days === 1 ? '' : 's'} until you're together`
                    : days === 0
                    ? "It's today!"
                    : 'Update your next visit'}
                </div>
              </>
            ) : (
              <div className="countdown-label">Tap to set your next visit date</div>
            )}
          </div>
        )}
      </div>

      <div className="tile-grid">
        {tiles.map((t) => (
          <Link to={t.to} key={t.to} className="tile">
            <div className="tile-icon"><t.Icon size={22} /></div>
            <div className="tile-label">{t.label}</div>
            <div className="tile-desc">{t.desc}</div>
          </Link>
        ))}
      </div>

      {showPhotos && (
        <div className="photo-overlay" onClick={() => setShowPhotos(false)}>
          <div className="photo-overlay-card" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="photo-overlay-close"
              onClick={() => setShowPhotos(false)}
              aria-label="Close"
            >
              ×
            </button>
            <div className="photo-overlay-row">
              <div className="photo-overlay-person">
                <span className="photo-overlay-circle">
                  {profile?.avatar_url ? (
                    <img src={profile.avatar_url} alt="" />
                  ) : (
                    (profile?.display_name || '?')[0].toUpperCase()
                  )}
                </span>
                <p>{profile?.display_name || 'You'}</p>
              </div>
              <div className="photo-overlay-person">
                <span className="photo-overlay-circle">
                  {partnerAvatarUrl ? (
                    <img src={partnerAvatarUrl} alt="" />
                  ) : (
                    (partnerName || '?')[0].toUpperCase()
                  )}
                </span>
                <p>{partnerName || 'Partner'}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
