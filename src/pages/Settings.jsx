import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Logo from '../components/Logo'

export default function Settings() {
  const { profile, partnerName, logout, unpairCouple } = useAuth()
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  async function handleDisconnect() {
    setBusy(true)
    setError('')
    try {
      await unpairCouple()
      navigate('/pair')
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <div className="screen with-nav">
      <Link className="link-btn" to="/">
        ← Back
      </Link>

      <div className="brand-row">
        <Logo size={26} withWordmark />
      </div>

      <h2>Settings</h2>

      <div className="settings-section">
        <div className="settings-row">
          <span>Your code</span>
          <strong>{profile?.pair_code}</strong>
        </div>
        <div className="settings-row">
          <span>Paired with</span>
          <strong>{partnerName || '—'}</strong>
        </div>
      </div>

      <div className="settings-section danger">
        <h3>Disconnect</h3>
        <p className="subtitle">
          This unpairs you from {partnerName || 'your partner'} and permanently deletes your shared
          canvas, photos, quiz answers, location, mood, and notes. You can each pair with someone new
          afterward.
        </p>

        {!confirming ? (
          <button className="danger-btn" onClick={() => setConfirming(true)}>
            Disconnect from {partnerName || 'partner'}
          </button>
        ) : (
          <div className="confirm-box">
            <p>Are you sure? This can't be undone.</p>
            <div className="row">
              <button className="danger-btn" onClick={handleDisconnect} disabled={busy}>
                {busy ? 'Disconnecting…' : 'Yes, disconnect'}
              </button>
              <button type="button" onClick={() => setConfirming(false)} disabled={busy}>
                Cancel
              </button>
            </div>
          </div>
        )}
        {error && <p className="error">{error}</p>}
      </div>

      <button className="link-btn" onClick={logout}>
        Log out
      </button>
    </div>
  )
}
