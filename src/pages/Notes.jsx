import { useEffect, useRef, useState } from 'react'
import { supabase } from '../supabase/config'
import { useAuth } from '../context/AuthContext'
import { useVoiceRecorder } from '../hooks/useVoiceRecorder'
import VoiceNotePlayer from '../components/VoiceNotePlayer'
import PageIntro from '../components/PageIntro'

const QUICK_REACTIONS = ['❤️', '😂', '😮', '😢', '👍', '🔥']

export default function Notes() {
  const { couple, user, profile } = useAuth()
  const [notes, setNotes] = useState([])
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [activeId, setActiveId] = useState(null)
  const [reactions, setReactions] = useState({}) // { [noteId]: { [userId]: emoji } }
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)
  const pressTimer = useRef(null)

  const { recording, error: micError, start: startRecording, stop: stopRecording, cancel: cancelRecording } =
    useVoiceRecorder()

  function startPress(id) {
    cancelPress()
    pressTimer.current = setTimeout(() => {
      setActiveId(id)
      pressTimer.current = null
    }, 450)
  }

  function cancelPress() {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current)
      pressTimer.current = null
    }
  }

  async function loadNotes() {
    const { data } = await supabase
      .from('notes')
      .select('*')
      .eq('couple_id', couple.id)
      .order('created_at', { ascending: false })
    setNotes(data || [])
  }

  async function loadReactions() {
    if (!couple) return
    const { data } = await supabase.from('note_reactions').select('*').eq('couple_id', couple.id)
    const map = {}
    ;(data || []).forEach((r) => {
      map[r.note_id] = { ...(map[r.note_id] || {}), [r.user_id]: r.emoji }
    })
    setReactions(map)
  }

  function upsertReactionLocal(row) {
    setReactions((prev) => ({
      ...prev,
      [row.note_id]: { ...(prev[row.note_id] || {}), [row.user_id]: row.emoji },
    }))
  }

  function removeReactionLocal(row) {
    setReactions((prev) => {
      const forNote = { ...(prev[row.note_id] || {}) }
      delete forNote[row.user_id]
      return { ...prev, [row.note_id]: forNote }
    })
  }

  // Marks any of your partner's notes you haven't seen yet — mirrors the
  // same read_at pattern Chat already uses, just under the name Notes
  // already talks about itself with.
  async function markSeen() {
    if (!couple || !user) return
    await supabase
      .from('notes')
      .update({ seen_at: new Date().toISOString() })
      .eq('couple_id', couple.id)
      .neq('from_uid', user.id)
      .is('seen_at', null)
  }

  useEffect(() => {
    if (!couple) return
    loadNotes()
    loadReactions()
    markSeen()

    const channel = supabase
      .channel(`notes-${couple.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notes', filter: `couple_id=eq.${couple.id}` },
        (payload) => {
          loadNotes()
          if (payload.eventType === 'INSERT' && payload.new.from_uid !== user.id) markSeen()
        }
      )
      .subscribe()
    const reactionsChannel = supabase
      .channel(`note-reactions-${couple.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'note_reactions', filter: `couple_id=eq.${couple.id}` },
        (payload) => upsertReactionLocal(payload.new)
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'note_reactions', filter: `couple_id=eq.${couple.id}` },
        (payload) => upsertReactionLocal(payload.new)
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'note_reactions', filter: `couple_id=eq.${couple.id}` },
        (payload) => removeReactionLocal(payload.old)
      )
      .subscribe()

    function onVisible() {
      if (document.visibilityState === 'visible') {
        loadNotes()
        loadReactions()
        markSeen()
      }
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      supabase.removeChannel(channel)
      supabase.removeChannel(reactionsChannel)
      document.removeEventListener('visibilitychange', onVisible)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [couple?.id])

  async function send(e) {
    e.preventDefault()
    if (!text.trim()) return
    await supabase.from('notes').insert({
      couple_id: couple.id,
      text: text.trim(),
      from_name: profile?.display_name || 'Me',
      from_uid: user.id,
    })
    setText('')
  }

  async function sendVoiceNote(blob) {
    if (!blob || !couple) return
    if (!navigator.onLine) {
      setError('You need to be online to send a voice note.')
      return
    }
    setSending(true)
    setError('')
    try {
      const path = `${couple.id}/notes/${Date.now()}_voice.webm`
      const { error: uploadError } = await supabase.storage.from('photos').upload(path, blob)
      if (uploadError) throw uploadError
      const { error: err } = await supabase.from('notes').insert({
        couple_id: couple.id,
        text: null,
        from_name: profile?.display_name || 'Me',
        from_uid: user.id,
        audio_path: path,
      })
      if (err) throw err
    } catch (err) {
      setError(err.message)
    } finally {
      setSending(false)
    }
  }

  async function handleMicTap() {
    if (recording) {
      const blob = await stopRecording()
      if (blob) sendVoiceNote(blob)
    } else {
      startRecording()
    }
  }

  async function remove(id) {
    await supabase.from('notes').delete().eq('id', id)
    setActiveId(null)
    setConfirmDeleteId(null)
  }

  async function react(noteId, emoji) {
    const existing = reactions[noteId]?.[user.id]
    if (existing === emoji) {
      await supabase.from('note_reactions').delete().eq('note_id', noteId).eq('user_id', user.id)
    } else {
      await supabase
        .from('note_reactions')
        .upsert({ note_id: noteId, couple_id: couple.id, user_id: user.id, emoji }, { onConflict: 'note_id,user_id' })
    }
    setActiveId(null)
  }

  // Notes list newest-first, so the "latest note" is whichever is first —
  // if that one's mine, this is where a "Seen" indicator belongs.
  const latestNote = notes[0]

  return (
    <div className="screen with-nav">
      <PageIntro eyebrow="Small reminders" title="Love Notes" description="Little messages for each other, anytime. Press and hold one to react." />

      <form onSubmit={send} className="note-form">
        <input
          type="text"
          placeholder="Write a little note…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={recording}
        />
        <button
          type="button"
          className={'chat-attach-btn' + (recording ? ' recording' : '')}
          title={recording ? 'Stop and send' : 'Record a voice note'}
          aria-label={recording ? 'Stop and send voice note' : 'Record a voice note'}
          onClick={handleMicTap}
          disabled={sending}
        >
          {recording ? '⏹️' : '🎤'}
        </button>
        <button type="submit" className="chat-send-btn" disabled={recording || !text.trim()}>
          Send
        </button>
      </form>
      {recording && (
        <button className="link-btn small" onClick={cancelRecording}>
          Cancel recording
        </button>
      )}
      {error && <p className="error">{error}</p>}
      {micError && <p className="error">{micError}</p>}

      <div className="notes-list">
        {notes.map((n) => {
          const mine = n.from_uid === user.id
          return (
            <div
              key={n.id}
              className={'note-card' + (mine ? ' mine' : '')}
              onClick={() => {
                if (activeId === n.id) {
                  setActiveId(null)
                  setConfirmDeleteId(null)
                }
              }}
              onTouchStart={() => startPress(n.id)}
              onTouchEnd={cancelPress}
              onTouchMove={cancelPress}
              onMouseDown={() => startPress(n.id)}
              onMouseUp={cancelPress}
              onMouseLeave={cancelPress}
              onContextMenu={(e) => e.preventDefault()}
            >
              {n.audio_path && <VoiceNotePlayer path={n.audio_path} />}
              {n.text && <div className="note-text">{n.text}</div>}
              <div className="note-meta">
                <span>{n.from_name}</span>
                {mine && n.id === latestNote?.id && (
                  <span className="subtitle small-note" style={{ marginLeft: 6 }}>
                    {n.seen_at ? '· Seen' : '· Delivered'}
                  </span>
                )}
              </div>

              {Object.keys(reactions[n.id] || {}).length > 0 && (
                <div className={'chat-bubble-reactions' + (mine ? ' mine' : '')}>
                  {Object.entries(reactions[n.id]).map(([uid, emoji]) => (
                    <span key={uid} className="reaction-chip">
                      {emoji}
                    </span>
                  ))}
                </div>
              )}

              {activeId === n.id && (
                <div className="chat-bubble-actions" onClick={(e) => e.stopPropagation()}>
                  <div className="reaction-picker">
                    {QUICK_REACTIONS.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        className={reactions[n.id]?.[user.id] === emoji ? 'active' : ''}
                        onClick={() => react(n.id, emoji)}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                  {mine && (
                    <div className="chat-bubble-actions-row">
                      {confirmDeleteId === n.id ? (
                        <>
                          <button type="button" onClick={() => remove(n.id)}>
                            Confirm delete
                          </button>
                          <button type="button" onClick={() => setConfirmDeleteId(null)}>
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button type="button" onClick={() => setConfirmDeleteId(n.id)}>
                          Delete
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
        {notes.length === 0 && <p className="empty-state">No notes yet — send the first one</p>}
      </div>
    </div>
  )
}
