import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useInAppAlerts } from '../hooks/useInAppAlerts'

const MUTE_KEY = 'blessuth-alerts-muted'
const MUTE_CHANGE_EVENT = 'blessuth-alerts-muted-changed'

export function alertsMuted() {
  return localStorage.getItem(MUTE_KEY) === '1'
}

// Settings.jsx calls this when the person flips the toggle. It dispatches a
// same-tab event too, since the 'storage' event only fires in *other* tabs.
export function setAlertsMuted(muted) {
  localStorage.setItem(MUTE_KEY, muted ? '1' : '0')
  window.dispatchEvent(new Event(MUTE_CHANGE_EVENT))
}

export default function InAppAlerts() {
  const { user, couple, partnerUid, partnerName } = useAuth()
  const navigate = useNavigate()
  const [muted, setMuted] = useState(alertsMuted)

  useEffect(() => {
    const sync = () => setMuted(alertsMuted())
    window.addEventListener(MUTE_CHANGE_EVENT, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(MUTE_CHANGE_EVENT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [])

  const { alerts, dismiss } = useInAppAlerts({
    coupleId: couple?.id || null,
    userId: user?.id || null,
    partnerUid,
    partnerName,
    muted,
  })

  if (!couple || alerts.length === 0) return null

  return (
    <div className="alert-stack">
      {alerts.map((a) => (
        <div
          key={a.id}
          className="alert-toast"
          onClick={() => {
            navigate(a.url)
            dismiss(a.id)
          }}
        >
          <div className="alert-toast-text">
            <strong>{a.title}</strong>
            <span>{a.body}</span>
          </div>
          <button
            type="button"
            className="alert-toast-close"
            onClick={(e) => {
              e.stopPropagation()
              dismiss(a.id)
            }}
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  )
}
