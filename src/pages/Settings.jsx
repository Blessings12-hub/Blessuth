import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../supabase/config'
import Logo from '../components/Logo'
import { pushSupported, getPushSubscriptionState, enablePush, disablePush } from '../push'
import { isSpotifyConfigured, isSpotifyConnected, connectSpotify, disconnectSpotify } from '../spotifyAuth'

export default function Settings() {
  const { user, couple, profile, partnerName, logout, unpairCouple } = useAuth()
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState(profile?.display_name || '')
  const [nameSaving, setNameSaving] = useState(false)

  useEffect(() => {
    setNameInput(profile?.display_name || '')
  }, [profile?.display_name])

  async function saveName() {
    const value = nameInput.trim()
    if (!value || value === profile?.display_name) {
      setEditingName(false)
      return
    }
    setNameSaving(true)
    await supabase.from('profiles').update({ display_name: value }).eq('id', user.id)
    setNameSaving(false)
    setEditingName(false)
  }

  const [pushState, setPushState] = useState({ supported: false, permission: 'default', subscribed: false })
  const [pushBusy, setPushBusy] = useState(false)
  const [pushError, setPushError] = useState('')

  const [spotifyConnected, setSpotifyConnected] = useState(isSpotifyConnected())
  const [spotifyError, setSpotifyError] = useState('')

  useEffect(() => {
    if (!pushSupported()) {
      setPushState({ supported: false, permission: 'unsupported', subscribed: false })
      return
    }
    getPushSubscriptionState().then(setPushState).catch(() => {})
  }, [])

  async function togglePush() {
    setPushBusy(true)
    setPushError('')
    try {
      if (pushState.subscribed) {
        await disablePush()
      } else {
        await enablePush(user, couple)
      }
      const next = await getPushSubscriptionState()
      setPushState(next)
    } catch (err) {
      setPushError(err.message)
    } finally {
      setPushBusy(false)
    }
  }

  async function toggleSpotify() {
    setSpotifyError('')
    if (spotifyConnected) {
      disconnectSpotify()
      setSpotifyConnected(false)
      return
    }
    try {
      await connectSpotify()
    } catch (err) {
      setSpotifyError(err.message)
    }
  }

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
          <span>Your name</span>
          {editingName ? (
            <span className="inline-edit-row">
              <input
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && saveName()}
                autoFocus
              />
              <button className="link-btn small" onClick={saveName} disabled={nameSaving}>
                {nameSaving ? 'Saving…' : 'Save'}
              </button>
            </span>
          ) : (
            <button className="link-btn small" onClick={() => setEditingName(true)}>
              {profile?.display_name} · edit
            </button>
          )}
        </div>
        <div className="settings-row">
          <span>Your code</span>
          <strong>{profile?.pair_code}</strong>
        </div>
        <div className="settings-row">
          <span>Paired with</span>
          <strong>{partnerName || '—'}</strong>
        </div>
      </div>

      <div className="settings-section">
        <h3>Notifications</h3>
        {!pushState.supported ? (
          <p className="subtitle">
            Push notifications aren't supported in this browser. On iPhone, add Blescy to your Home
            Screen first (Share → Add to Home Screen), then open it from there.
          </p>
        ) : (
          <>
            <p className="subtitle">
              Get notified when {partnerName || 'your partner'} sends a message or a note, even when
              the app is closed.
            </p>
            <button className="toggle-row" onClick={togglePush} disabled={pushBusy}>
              <span>{pushState.subscribed ? 'Notifications on' : 'Turn on notifications'}</span>
              <span className={'toggle-switch' + (pushState.subscribed ? ' on' : '')}>
                <span className="toggle-knob" />
              </span>
            </button>
            {pushState.permission === 'denied' && (
              <p className="error">
                Notifications are blocked for this site in your browser settings — you'll need to
                allow them there first.
              </p>
            )}
          </>
        )}
        {pushError && <p className="error">{pushError}</p>}
      </div>

      {isSpotifyConfigured() && (
        <div className="settings-section">
          <h3>Spotify</h3>
          <p className="subtitle">
            Connect your own Premium account to play full songs on the Music page instead of
            30-second previews, and use "Listen together" to sync a track with{' '}
            {partnerName || 'your partner'}.
          </p>
          <button className="toggle-row" onClick={toggleSpotify}>
            <span>{spotifyConnected ? 'Spotify connected' : 'Connect Spotify'}</span>
            <span className={'toggle-switch' + (spotifyConnected ? ' on' : '')}>
              <span className="toggle-knob" />
            </span>
          </button>
          <p className="subtitle small-note">
            Needs a standard Spotify Premium plan (not the mobile-only plan) on both accounts.
            Playback happens in this browser tab and will pause if you lock your phone or switch
            apps — that's a Spotify/iOS limitation, not something the app can work around.
          </p>
          {spotifyError && <p className="error">{spotifyError}</p>}
        </div>
      )}

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
