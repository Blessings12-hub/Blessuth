import { useEffect, useState } from 'react'
import { supabase } from '../supabase/config'
import { useAuth } from '../context/AuthContext'
import { resizeImage } from '../imageResize'
import PageIntro from '../components/PageIntro'

const SIGNED_URL_TTL = 60 * 60

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result.split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

function formatRemindAt(iso) {
  const d = new Date(iso)
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export default function BibleStudy() {
  const { couple, user, profile } = useAuth()
  const [tab, setTab] = useState('verses')

  // ---------- Verses ----------
  const [verses, setVerses] = useState([])
  const [textInput, setTextInput] = useState('')
  const [photoFile, setPhotoFile] = useState(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [verseError, setVerseError] = useState('')
  const [confirmDeleteVerseId, setConfirmDeleteVerseId] = useState(null)
  const [lightboxUrl, setLightboxUrl] = useState(null)

  async function loadVerses() {
    if (!couple) return
    const { data } = await supabase
      .from('bible_verses')
      .select('*')
      .eq('couple_id', couple.id)
      .order('created_at', { ascending: false })
    const rows = data || []
    const withUrls = await Promise.all(
      rows.map(async (v) => {
        if (!v.image_path) return v
        const { data: signed } = await supabase.storage.from('photos').createSignedUrl(v.image_path, SIGNED_URL_TTL)
        return signed?.signedUrl ? { ...v, displayUrl: signed.signedUrl } : v
      })
    )
    setVerses(withUrls)
  }

  // ---------- Reminders ----------
  const [reminders, setReminders] = useState([])
  const [reminderTitle, setReminderTitle] = useState('')
  const [reminderWhen, setReminderWhen] = useState('')
  const [reminderRecurrence, setReminderRecurrence] = useState('none')
  const [addingReminder, setAddingReminder] = useState(false)
  const [confirmDeleteReminderId, setConfirmDeleteReminderId] = useState(null)

  async function loadReminders() {
    if (!couple) return
    const { data } = await supabase
      .from('bible_reminders')
      .select('*')
      .eq('couple_id', couple.id)
      .order('remind_at', { ascending: true })
    setReminders(data || [])
  }

  useEffect(() => {
    if (!couple) return
    loadVerses()
    loadReminders()

    const channel = supabase
      .channel(`bible-study-${couple.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bible_verses', filter: `couple_id=eq.${couple.id}` },
        loadVerses
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bible_reminders', filter: `couple_id=eq.${couple.id}` },
        loadReminders
      )
      .subscribe()

    return () => supabase.removeChannel(channel)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [couple?.id])

  async function analyzeAndSave() {
    if (!textInput.trim() && !photoFile) return
    setAnalyzing(true)
    setVerseError('')
    try {
      let body
      let imagePath = null

      if (photoFile) {
        const resized = await resizeImage(photoFile, 1200, 0.85)
        const base64 = await blobToBase64(resized)
        body = { imageBase64: base64, imageMediaType: 'image/jpeg' }

        imagePath = `${couple.id}/bible/${Date.now()}_${photoFile.name}`
        const { error: uploadError } = await supabase.storage.from('photos').upload(imagePath, resized)
        if (uploadError) throw uploadError
      } else {
        body = { text: textInput.trim() }
      }

      const res = await fetch('/api/analyze-verse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)

      await supabase.from('bible_verses').insert({
        couple_id: couple.id,
        user_id: user.id,
        user_name: profile?.display_name || 'You',
        reference: data.reference,
        verse_text: data.verseText,
        image_path: imagePath,
        prayer_points: data.prayerPoints || [],
        verse_source: data.verseSource || null,
      })

      setTextInput('')
      setPhotoFile(null)
    } catch (err) {
      setVerseError(err.message || 'Could not save that verse — try again in a moment.')
    } finally {
      setAnalyzing(false)
    }
  }

  async function confirmDeleteVerse(verse) {
    if (verse.image_path) await supabase.storage.from('photos').remove([verse.image_path])
    await supabase.from('bible_verses').delete().eq('id', verse.id)
    setConfirmDeleteVerseId(null)
  }

  async function addReminder() {
    if (!reminderTitle.trim() || !reminderWhen) return
    setAddingReminder(true)
    await supabase.from('bible_reminders').insert({
      couple_id: couple.id,
      created_by: user.id,
      title: reminderTitle.trim(),
      remind_at: new Date(reminderWhen).toISOString(),
      recurrence: reminderRecurrence,
    })
    setReminderTitle('')
    setReminderWhen('')
    setReminderRecurrence('none')
    setAddingReminder(false)
  }

  async function confirmDeleteReminder(reminder) {
    await supabase.from('bible_reminders').delete().eq('id', reminder.id)
    setConfirmDeleteReminderId(null)
  }

  const now = new Date()

  return (
    <div className="screen with-nav">
      <PageIntro eyebrow="Grow together" title="Bible Study" description="Share verses together, with a few prayer points to get you started." />

      <div className="play-tabs">
        <button
          type="button"
          className={'play-tab' + (tab === 'verses' ? ' active' : '')}
          onClick={() => setTab('verses')}
          aria-selected={tab === 'verses'}
          role="tab"
        >
          Verses
        </button>
        <button
          type="button"
          className={'play-tab' + (tab === 'reminders' ? ' active' : '')}
          onClick={() => setTab('reminders')}
          aria-selected={tab === 'reminders'}
          role="tab"
        >
          Reminders
        </button>
      </div>

      {tab === 'verses' && (
        <>
          <div className="wishlist-form" style={{ marginBottom: 16 }}>
            <textarea
              className="surprise-textarea"
              rows={3}
              placeholder="Paste or type a verse — a reference alone works too, e.g. 'Philippians 4:6-7'"
              value={textInput}
              onChange={(e) => {
                setTextInput(e.target.value)
                if (e.target.value) setPhotoFile(null)
              }}
              disabled={analyzing}
            />
            <p className="subtitle small-note">— or —</p>
            <label className="upload-btn">
              {photoFile ? photoFile.name : '+ Add a screenshot or photo'}
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  setPhotoFile(e.target.files[0] || null)
                  if (e.target.files[0]) setTextInput('')
                }}
                disabled={analyzing}
                hidden
              />
            </label>
            {verseError && <p className="error">{verseError}</p>}
            <button
              className="primary-btn"
              onClick={analyzeAndSave}
              disabled={analyzing || (!textInput.trim() && !photoFile)}
              style={{ marginTop: 10 }}
            >
              {analyzing ? 'Reading it and writing prayer points…' : 'Save & get prayer points'}
            </button>
          </div>

          {verses.map((v) => (
            <div key={v.id} className="wishlist-card" style={{ marginBottom: 14, breakInside: 'avoid' }}>
              {v.displayUrl && (
                <img
                  src={v.displayUrl}
                  alt=""
                  className="wishlist-card-img"
                  onClick={() => setLightboxUrl(v.displayUrl)}
                  style={{ cursor: 'zoom-in' }}
                />
              )}
              <div className="wishlist-card-body">
                {v.reference && (
                  <p className="wishlist-card-title">
                    {v.reference}
                    {v.verse_source && (
                      <span
                        style={{
                          marginLeft: 8,
                          fontSize: '0.65rem',
                          fontWeight: 700,
                          color: 'var(--teal)',
                          background: '#e4f3ee',
                          borderRadius: 999,
                          padding: '2px 8px',
                          verticalAlign: 'middle',
                        }}
                      >
                        {v.verse_source}
                      </span>
                    )}
                  </p>
                )}
                {v.verse_text && (
                  <p className="wishlist-card-note" style={{ fontStyle: 'italic' }}>
                    "{v.verse_text}"
                  </p>
                )}
                {v.prayer_points?.length > 0 && (
                  <ul style={{ margin: '8px 0', paddingLeft: 18, fontSize: '0.85rem' }}>
                    {v.prayer_points.map((p, i) => (
                      <li key={i} style={{ marginBottom: 4 }}>
                        {p}
                      </li>
                    ))}
                  </ul>
                )}
                <p className="subtitle small-note" style={{ margin: '4px 0 8px' }}>
                  shared by {v.user_id === user.id ? 'you' : v.user_name || 'your partner'}
                </p>

                {confirmDeleteVerseId === v.id ? (
                  <div className="confirm-box">
                    <p>Remove this verse?</p>
                    <div className="row">
                      <button className="danger-btn" onClick={() => confirmDeleteVerse(v)}>
                        Yes, remove
                      </button>
                      <button type="button" onClick={() => setConfirmDeleteVerseId(null)}>
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button className="link-btn small" onClick={() => setConfirmDeleteVerseId(v.id)}>
                    remove
                  </button>
                )}
              </div>
            </div>
          ))}
          {verses.length === 0 && <p className="empty-state">No verses shared yet — add your first one above.</p>}
        </>
      )}

      {tab === 'reminders' && (
        <>
          <div className="wishlist-form" style={{ marginBottom: 16 }}>
            <input
              type="text"
              placeholder="What's the reminder?"
              value={reminderTitle}
              onChange={(e) => setReminderTitle(e.target.value)}
              className="word-input pictionary-guess-input"
            />
            <input
              type="datetime-local"
              value={reminderWhen}
              onChange={(e) => setReminderWhen(e.target.value)}
              className="word-input pictionary-guess-input"
              style={{ textTransform: 'none' }}
            />
            <select
              value={reminderRecurrence}
              onChange={(e) => setReminderRecurrence(e.target.value)}
              style={{
                border: '1px solid var(--border)',
                borderRadius: 12,
                padding: '10px 12px',
                background: 'var(--surface)',
                color: 'var(--ink)',
                fontSize: '0.9rem',
              }}
            >
              <option value="none">Doesn't repeat</option>
              <option value="daily">Repeats daily</option>
              <option value="weekly">Repeats weekly</option>
            </select>
            <button
              className="primary-btn"
              onClick={addReminder}
              disabled={addingReminder || !reminderTitle.trim() || !reminderWhen}
              style={{ marginTop: 10 }}
            >
              {addingReminder ? 'Adding…' : 'Add reminder'}
            </button>
          </div>

          {reminders.map((r) => {
            const due = new Date(r.remind_at) <= now
            return (
              <div
                key={r.id}
                className="wishlist-card"
                style={{ marginBottom: 10, padding: '12px 14px', borderColor: due ? 'var(--sunset)' : undefined }}
              >
                <p className="wishlist-card-title">{r.title}</p>
                <p className="subtitle small-note" style={{ margin: '2px 0 8px' }}>
                  {due ? 'Due now' : formatRemindAt(r.remind_at)}
                  {r.recurrence !== 'none' && ` · repeats ${r.recurrence}`}
                </p>
                {confirmDeleteReminderId === r.id ? (
                  <div className="confirm-box">
                    <p>Remove this reminder?</p>
                    <div className="row">
                      <button className="danger-btn" onClick={() => confirmDeleteReminder(r)}>
                        Yes, remove
                      </button>
                      <button type="button" onClick={() => setConfirmDeleteReminderId(null)}>
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button className="link-btn small" onClick={() => setConfirmDeleteReminderId(r.id)}>
                    remove
                  </button>
                )}
              </div>
            )
          })}
          {reminders.length === 0 && <p className="empty-state">No reminders yet — add one above.</p>}
        </>
      )}

      {lightboxUrl && (
        <div
          onClick={() => setLightboxUrl(null)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 200,
            background: 'rgba(0, 0, 0, 0.9)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
            cursor: 'zoom-out',
          }}
        >
          <img
            src={lightboxUrl}
            alt=""
            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: 8 }}
          />
        </div>
      )}
    </div>
  )
}
