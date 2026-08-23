import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../supabase/config'
import Logo from '../components/Logo'
import { alertsMuted, setAlertsMuted } from '../components/InAppAlerts'

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

  const [alertsOn, setAlertsOn] = useState(!alertsMuted())

  function toggleAlerts() {
    const next = !alertsOn
    setAlertsMuted(!next)
    setAlertsOn(next)
  }

  const myArmedSurprise = couple?.surprise_armed_by === user?.id
  const [surpriseInput, setSurpriseInput] = useState('')
  const [surpriseBusy, setSurpriseBusy] = useState(false)
  const [surpriseSaved, setSurpriseSaved] = useState(false)

  useEffect(() => {
    setSurpriseInput(myArmedSurprise ? couple?.surprise_message || '' : '')
    setSurpriseSaved(false)
  }, [couple?.surprise_armed_at])

  const surpriseSeen =
    myArmedSurprise &&
    couple?.surprise_seen_at &&
    new Date(couple.surprise_seen_at) >= new Date(couple.surprise_armed_at)

  async function armSurprise() {
    setSurpriseBusy(true)
    try {
      await supabase
        .from('couples')
        .update({
          surprise_message: surpriseInput.trim() || null,
          surprise_armed_by: user.id,
          surprise_armed_at: new Date().toISOString(),
          surprise_seen_at: null,
        })
        .eq('id', couple.id)
      setSurpriseSaved(true)
    } finally {
      setSurpriseBusy(false)
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
        <p className="subtitle">
          You'll see a banner in-app when {partnerName || 'your partner'} sends a message, leaves a
          note, reacts, answers today's question, or finishes a quiz — as long as Blessuth is open.
          There's nothing to set up; this doesn't work when the app is fully closed or the phone is
          locked, since it isn't a push notification.
        </p>
        <button className="toggle-row" onClick={toggleAlerts}>
          <span>{alertsOn ? 'Alerts on' : 'Turn on alerts'}</span>
          <span className={'toggle-switch' + (alertsOn ? ' on' : '')}>
            <span className="toggle-knob" />
          </span>
        </button>
      </div>

      <div className="settings-section">
        <h3>Surprise {partnerName || 'them'}</h3>
        <p className="subtitle">
          Write a short message and it'll pop up as a little animated surprise the next time{' '}
          {partnerName || 'they'} open the app — once. Send it again anytime, for a birthday, an
          anniversary, or no reason at all.
        </p>
        <textarea
          className="surprise-textarea"
          rows={5}
          placeholder="Just thinking about you today..."
          value={surpriseInput}
          onChange={(e) => {
            setSurpriseInput(e.target.value)
            setSurpriseSaved(false)
          }}
        />
        <button className="link-btn small" onClick={armSurprise} disabled={surpriseBusy}>
          {surpriseBusy ? 'Sending…' : myArmedSurprise && !surpriseSeen ? 'Update surprise' : 'Send surprise'}
        </button>
        {surpriseSaved && !surpriseSeen && (
          <p className="subtitle small-note">
            Queued — {partnerName || 'they'} will see it next time they open the app.
          </p>
        )}
        {myArmedSurprise && surpriseSeen && !surpriseSaved && (
          <p className="subtitle small-note">
            {partnerName || 'They'} saw it on{' '}
            {new Date(couple.surprise_seen_at).toLocaleDateString()}.
          </p>
        )}
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
