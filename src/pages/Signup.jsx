import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Logo from '../components/Logo'
import { MailIcon, LockIcon, UserIcon } from '../components/Icons'

export default function Signup() {
  const { signup } = useAuth()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await signup(email, password, name)
      navigate('/pair')
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
        <h1>Blessuth</h1>
        <p>Two phones, one relationship.</p>
      </div>

      <div className="auth-card">
        <h2 className="auth-card-title">Create your account</h2>
        <form onSubmit={handleSubmit} className="auth-form">
          <div className="auth-input-group">
            <UserIcon size={18} className="auth-input-icon" />
            <input
              type="text"
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
            />
          </div>
          <div className="auth-input-group">
            <MailIcon size={18} className="auth-input-icon" />
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </div>
          <div className="auth-input-group">
            <LockIcon size={18} className="auth-input-icon" />
            <input
              type="password"
              placeholder="Password (6+ characters)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              required
              minLength={6}
            />
          </div>
          {error && <p className="error">{error}</p>}
          <button type="submit" disabled={busy}>
            {busy ? 'Creating…' : 'Sign up'}
          </button>
        </form>
        <p className="auth-switch">
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </div>
    </div>
  )
}
