import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../supabase/config'
import Logo from '../components/Logo'
import { pushSupported, getPushSubscriptionState, enablePush, disablePush, sendTestPush } from '../push'

// Downscales + compresses an image client-side before upload, so profile
// photos stay small regardless of the original file size.
function resizeImage(file, maxSize = 480, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(url)
          if (blob) resolve(blob)
          else reject(new Error('Could not process that image.'))
        },
        'image/jpeg',
        quality
      )
    }
    img.onerror = () => reject(new Error('Could not read that image.'))
    img.src = url
  })
}

export default function Settings() {
  const { user, couple, profile, partnerName, logout, unpairCouple } = useAuth()
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState(profile?.display_name || '')
  const [nameSaving, setNameSaving] = useState(false)

  const fileInputRef = useRef(null)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [avatarError, setAvatarError] = useState('')

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

  async function handleAvatarFile(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setAvatarError('Please choose an image file.')
      return
    }
    setAvatarUploading(true)
    setAvatarError('')
    try {
      const blob = await resizeImage(file)
      const path = `${user.id}.jpg`
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, blob, { upsert: true, contentType: 'image/jpeg' })
      if (uploadError) throw uploadError
      const { data } = supabase.storage.from('avatars').getPublicUrl(path)
      await supabase
        .from('profiles')
        .update({ avatar_url: `${data.publicUrl}?t=${Date.now()}` })
        .eq('id', user.id)
    } catch (err) {
      setAvatarError(err.message)
    } finally {
      setAvatarUploading(false)
    }
  }

  const [pushState, setPushState] = useState({ supported: false, permission: 'default', subscribed: false })
  const [pushBusy, setPushBusy] = useState(false)
  const [pushError, setPushError] = useState('')
  const [testBusy, setTestBusy] = useState(false)
  const [testResult, setTestResult] = useState('')

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
    setTestResult('')
    try {
      if (pushState.subscribed) {
        await disablePush()
      } else {
        await enablePush(user)
      }
      const next = await getPushSubscriptionState()
      setPushState(next)
    } catch (err) {
      setPushError(err.message)
    } finally {
      setPushBusy(false)
    }
  }

  async function handleTestPush() {
    setTestBusy(true)
    setTestResult('')
    try {
      await sendTestPush(user)
      setTestResult('sent')
    } catch (err) {
      setTestResult(err.message)
    } finally {
      setTestBusy(false)
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

      <div className="settings-section avatar-section">
        <button
          type="button"
          className="avatar-upload-circle"
          onClick={() => fileInputRef.current?.click()}
          disabled={avatarUploading}
        >
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="" />
          ) : (
            <span>{(profile?.display_name || '?')[0].toUpperCase()}</span>
          )}
          <span className="avatar-upload-badge">{avatarUploading ? '…' : 'Edit'}</span>
        </button>
        <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={handleAvatarFile} />
        <p className="subtitle small-note">Tap your photo to change it.</p>
        {avatarError && <p className="error">{avatarError}</p>}
      </div>

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
            Push notifications aren't supported in this browser. On iPhone, add Blessuth to your Home
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
            {pushState.subscribed && (
              <>
                <button className="link-btn small" onClick={handleTestPush} disabled={testBusy}>
                  {testBusy ? 'Sending…' : 'Send test notification'}
                </button>
                {testResult === 'sent' && (
                  <p className="subtitle small-note">
                    Sent — if it doesn't arrive in a few seconds, push itself is blocked somewhere
                    outside the app (OS notification settings, browser site settings, or Do Not
                    Disturb).
                  </p>
                )}
                {testResult && testResult !== 'sent' && <p className="error">{testResult}</p>}
                <p className="subtitle small-note">
                  Note this only tests that OneSignal can reach this account — it won't tell you
                  whether a real message from {partnerName || 'your partner'} will trigger one. That
                  part depends on the Supabase Database Webhook pointing at <code>/api/notify</code>{' '}
                  (README step 6) being set up correctly.
                </p>
              </>
            )}
          </>
        )}
        {pushError && <p className="error">{pushError}</p>}
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
