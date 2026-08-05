import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Logo from '../components/Logo'

export default function Pair() {
  const { profile, pairWithCode, logout } = useAuth()
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const navigate = useNavigate()

  if (profile?.couple_id) return <Navigate to="/" replace />

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await pairWithCode(code)
      navigate('/')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-hero">
        <Logo size={68} stacked />
        <h1>Pair up</h1>
        <p>Share your code with your partner, or enter theirs below.</p>
      </div>

      <div className="auth-card">
        <div className="pair-code-box">
          <p>Your code</p>
          <div className="pair-code">{profile?.pair_code || '……'}</div>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="auth-input-group no-icon">
            <input
              type="text"
              placeholder="Enter partner's code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              maxLength={6}
              required
            />
          </div>
          {error && <p className="error">{error}</p>}
          <button type="submit" disabled={busy}>
            {busy ? 'Pairing…' : 'Pair up'}
          </button>
        </form>
        <button className="link-btn auth-switch-btn" onClick={logout}>
          Log out
        </button>
      </div>
    </div>
  )
}
