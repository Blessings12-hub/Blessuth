import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Pair() {
  const { profile, pairWithCode, logout } = useAuth()
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const navigate = useNavigate()

  if (profile?.coupleId) return <Navigate to="/" replace />

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
    <div className="auth-screen">
      <h1>💞 Pair up</h1>
      <p className="subtitle">Share your code with your partner, or enter theirs below.</p>

      <div className="pair-code-box">
        <p>Your code</p>
        <div className="pair-code">{profile?.pairCode || '……'}</div>
      </div>

      <form onSubmit={handleSubmit} className="auth-form">
        <input
          type="text"
          placeholder="Enter partner's code"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          maxLength={6}
          required
        />
        {error && <p className="error">{error}</p>}
        <button type="submit" disabled={busy}>
          {busy ? 'Pairing…' : 'Pair up'}
        </button>
      </form>
      <button className="link-btn" onClick={logout}>
        Log out
      </button>
    </div>
  )
}
