import { Fragment, useEffect, useRef, useState } from 'react'
import { supabase } from '../supabase/config'
import { useAuth } from '../context/AuthContext'
import { resizeImage } from '../imageResize'
import { useVoiceRecorder } from '../hooks/useVoiceRecorder'
import VoiceNotePlayer from '../components/VoiceNotePlayer'

const PAGE_SIZE = 50
const QUICK_REACTIONS = ['❤️', '😂', '😮', '😢', '👍', '🔥']
const SIGNED_URL_TTL = 60 * 60

function dayLabel(iso) {
  const d = new Date(iso)
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)
  const sameDay = (a, b) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  if (sameDay(d, today)) return 'Today'
  if (sameDay(d, yesterday)) return 'Yesterday'
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function timeLabel(iso) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

function queueKey(coupleId) {
  return `blessuth_chat_queue_${coupleId}`
}

function loadQueuedFromStorage(coupleId) {
  try {
    return JSON.parse(localStorage.getItem(queueKey(coupleId)) || '[]')
  } catch {
    return []
  }
}

function saveQueuedToStorage(coupleId, queue) {
  try {
    localStorage.setItem(queueKey(coupleId), JSON.stringify(queue))
  } catch {
    // Storage full or unavailable — the queue just won't survive a reload,
    // which is a soft failure and not worth surfacing to the user.
  }
}

// Resolves a private-storage image path to a signed URL lazily, one per
// bubble — simpler than bulk-resolving on every page load, and images only
// ever need loading once they're actually rendered.
function ChatImage({ path, onOpen }) {
  const [url, setUrl] = useState(null)
  useEffect(() => {
    let cancelled = false
    supabase
      .storage
      .from('photos')
      .createSignedUrl(path, SIGNED_URL_TTL)
      .then(({ data }) => {
        if (!cancelled && data?.signedUrl) setUrl(data.signedUrl)
      })
    return () => {
      cancelled = true
    }
  }, [path])
  if (!url) return null
  return (
    <img
      src={url}
      alt=""
      className="chat-bubble-image"
      onClick={() => onOpen(url)}
      style={{ maxWidth: '100%', borderRadius: 12, cursor: 'zoom-in', display: 'block' }}
    />
  )
}

export default function Chat() {
  const { couple, user, partnerName, profile } = useAuth()
  const [messages, setMessages] = useState([])
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [partnerOnline, setPartnerOnline] = useState(false)
  const [partnerTyping, setPartnerTyping] = useState(false)
  const [activeId, setActiveId] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [editText, setEditText] = useState('')
  const [reactions, setReactions] = useState({}) // { [messageId]: { [userId]: emoji } }
  const [queued, setQueued] = useState([]) // messages waiting to send once back online
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)
  const [lightboxUrl, setLightboxUrl] = useState(null)

  const bottomRef = useRef(null)
  const presenceChannelRef = useRef(null)
  const typingHideRef = useRef(null)
  const myTypingResetRef = useRef(null)
  const queuedRef = useRef([]) // mirrors `queued`, so flushQueue always reads the latest list
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

  function setQueuedAndPersist(updater) {
    setQueued((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      queuedRef.current = next
      if (couple) saveQueuedToStorage(couple.id, next)
      return next
    })
  }

  async function loadInitial() {
    if (!couple) return
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('couple_id', couple.id)
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE)
    const rows = data || []
    setMessages(rows.slice().reverse())
    setHasMore(rows.length === PAGE_SIZE)
  }

  async function loadMore() {
    if (!messages.length || loadingMore) return
    setLoadingMore(true)
    const oldest = messages[0].created_at
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('couple_id', couple.id)
      .lt('created_at', oldest)
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE)
    const rows = data || []
    setMessages((prev) => [...rows.slice().reverse(), ...prev])
    setHasMore(rows.length === PAGE_SIZE)
    setLoadingMore(false)
  }

  async function loadReactions() {
    if (!couple) return
    const { data } = await supabase.from('message_reactions').select('*').eq('couple_id', couple.id)
    const map = {}
    ;(data || []).forEach((r) => {
      map[r.message_id] = { ...(map[r.message_id] || {}), [r.user_id]: r.emoji }
    })
    setReactions(map)
  }

  function upsertReactionLocal(row) {
    setReactions((prev) => ({
      ...prev,
      [row.message_id]: { ...(prev[row.message_id] || {}), [row.user_id]: row.emoji },
    }))
  }

  function removeReactionLocal(row) {
    setReactions((prev) => {
      const forMessage = { ...(prev[row.message_id] || {}) }
      delete forMessage[row.user_id]
      return { ...prev, [row.message_id]: forMessage }
    })
  }

  async function markRead() {
    if (!couple || !user) return
    await supabase
      .from('messages')
      .update({ read_at: new Date().toISOString() })
      .eq('couple_id', couple.id)
      .neq('sender_id', user.id)
      .is('read_at', null)
  }

  async function flushQueue() {
    if (!couple || !navigator.onLine) return
    const current = queuedRef.current
    if (!current.length) return
    for (const item of current) {
      const { error: err } = await supabase.from('messages').insert({
        couple_id: couple.id,
        sender_id: item.sender_id,
        sender_name: item.sender_name,
        text: item.text,
      })
      if (err) break // stop at the first failure — keeps the remaining queue in order
      setQueuedAndPersist((prev) => prev.filter((q) => q.localId !== item.localId))
    }
  }

  // Initial load + realtime subscription for inserts/updates/deletes.
  useEffect(() => {
    if (!couple) return
    const storedQueue = loadQueuedFromStorage(couple.id)
    queuedRef.current = storedQueue
    setQueued(storedQueue)

    loadInitial()
    loadReactions()
    markRead()
    flushQueue()

    const reactionsChannel = supabase
      .channel(`message-reactions-${couple.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'message_reactions', filter: `couple_id=eq.${couple.id}` },
        (payload) => upsertReactionLocal(payload.new)
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'message_reactions', filter: `couple_id=eq.${couple.id}` },
        (payload) => upsertReactionLocal(payload.new)
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'message_reactions', filter: `couple_id=eq.${couple.id}` },
        (payload) => removeReactionLocal(payload.old)
      )
      .subscribe()

    const channel = supabase
      .channel(`messages-${couple.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `couple_id=eq.${couple.id}` },
        (payload) => {
          setMessages((prev) => [...prev, payload.new])
          if (payload.new.sender_id !== user.id) markRead()
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages', filter: `couple_id=eq.${couple.id}` },
        (payload) => {
          setMessages((prev) => prev.map((m) => (m.id === payload.new.id ? payload.new : m)))
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'messages', filter: `couple_id=eq.${couple.id}` },
        (payload) => {
          setMessages((prev) => prev.filter((m) => m.id !== payload.old.id))
        }
      )
      .subscribe()

    function onVisible() {
      if (document.visibilityState !== 'visible') return
      loadInitial()
      loadReactions()
      markRead()
      flushQueue()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', flushQueue)

    return () => {
      supabase.removeChannel(channel)
      supabase.removeChannel(reactionsChannel)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', flushQueue)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [couple?.id])

  useEffect(() => {
    if (!couple || !user) return
    const channel = supabase.channel(`chat-presence-${couple.id}`, {
      config: { presence: { key: user.id } },
    })

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState()
        setPartnerOnline(Object.keys(state).some((k) => k !== user.id))
      })
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        if (payload.userId === user.id) return
        setPartnerTyping(true)
        clearTimeout(typingHideRef.current)
        typingHideRef.current = setTimeout(() => setPartnerTyping(false), 2500)
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ online_at: new Date().toISOString() })
        }
      })

    presenceChannelRef.current = channel

    return () => {
      clearTimeout(typingHideRef.current)
      clearTimeout(myTypingResetRef.current)
      supabase.removeChannel(channel)
      presenceChannelRef.current = null
    }
  }, [couple?.id, user?.id])

  const lastId = messages[messages.length - 1]?.id || queued[queued.length - 1]?.localId
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' })
  }, [lastId])

  function handleTyping(value) {
    setText(value)
    const channel = presenceChannelRef.current
    if (!channel) return
    clearTimeout(myTypingResetRef.current)
    channel.send({ type: 'broadcast', event: 'typing', payload: { userId: user.id } })
  }

  async function send(e) {
    e.preventDefault()
    const value = text.trim()
    if (!value || sending) return
    setText('')
    setError('')

    const pending = {
      localId: `local-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      text: value,
      sender_id: user.id,
      sender_name: profile?.display_name || 'Me',
    }

    if (!navigator.onLine) {
      setQueuedAndPersist((prev) => [...prev, pending])
      return
    }

    setSending(true)
    const { error: err } = await supabase.from('messages').insert({
      couple_id: couple.id,
      sender_id: user.id,
      sender_name: profile?.display_name || 'Me',
      text: value,
    })
    setSending(false)

    if (err) {
      if (err.code) {
        setError(err.message)
        setText(value)
      } else {
        setQueuedAndPersist((prev) => [...prev, pending])
      }
    }
  }

  async function sendImage(file) {
    if (!file || !couple) return
    if (!navigator.onLine) {
      setError('You need to be online to send a photo.')
      return
    }
    setSending(true)
    setError('')
    try {
      const resized = await resizeImage(file, 1000, 0.82)
      const path = `${couple.id}/chat/${Date.now()}_${file.name}`
      const { error: uploadError } = await supabase.storage.from('photos').upload(path, resized)
      if (uploadError) throw uploadError
      const { error: err } = await supabase.from('messages').insert({
        couple_id: couple.id,
        sender_id: user.id,
        sender_name: profile?.display_name || 'Me',
        text: text.trim() || null,
        image_path: path,
      })
      if (err) throw err
      setText('')
    } catch (err) {
      setError(err.message)
    } finally {
      setSending(false)
    }
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
      const path = `${couple.id}/chat/${Date.now()}_voice.webm`
      const { error: uploadError } = await supabase.storage.from('photos').upload(path, blob)
      if (uploadError) throw uploadError
      const { error: err } = await supabase.from('messages').insert({
        couple_id: couple.id,
        sender_id: user.id,
        sender_name: profile?.display_name || 'Me',
        text: null,
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

  function startEdit(m) {
    setEditingId(m.id)
    setEditText(m.text)
    setActiveId(null)
  }

  async function saveEdit(id) {
    const value = editText.trim()
    if (!value) return
    await supabase.from('messages').update({ text: value, edited_at: new Date().toISOString() }).eq('id', id)
    setEditingId(null)
  }

  async function deleteMessage(id) {
    await supabase.from('messages').delete().eq('id', id)
    setActiveId(null)
    setConfirmDeleteId(null)
  }

  async function react(messageId, emoji) {
    const existing = reactions[messageId]?.[user.id]
    if (existing === emoji) {
      await supabase.from('message_reactions').delete().eq('message_id', messageId).eq('user_id', user.id)
    } else {
      await supabase
        .from('message_reactions')
        .upsert(
          { message_id: messageId, couple_id: couple.id, user_id: user.id, emoji },
          { onConflict: 'message_id,user_id' }
        )
    }
    setActiveId(null)
  }

  const lastMessage = messages[messages.length - 1]
  const showSeenStatus = lastMessage && lastMessage.sender_id === user?.id && queued.length === 0

  return (
    <div className="screen chat-screen">
      <div className="chat-header-row">
        <div>
          <h2>Chat</h2>
          <p className="subtitle">
            {partnerName ? `A running conversation with ${partnerName}.` : 'A running conversation with your partner.'}
          </p>
        </div>
        <span
          className={'presence-dot' + (partnerOnline ? ' online' : '')}
          title={partnerOnline ? `${partnerName || 'Partner'} is online` : 'Offline'}
        />
      </div>

      <div className="chat-thread">
        {hasMore && (
          <button className="link-btn chat-load-more" onClick={loadMore} disabled={loadingMore}>
            {loadingMore ? 'Loading…' : 'Load earlier messages'}
          </button>
        )}

        {messages.length === 0 && queued.length === 0 && (
          <p className="empty-state">No messages yet — say something to start the conversation.</p>
        )}

        {messages.map((m, i) => {
          const mine = m.sender_id === user?.id
          const prev = messages[i - 1]
          const showDay = !prev || dayLabel(prev.created_at) !== dayLabel(m.created_at)
          const showName = !mine && (!prev || prev.sender_id !== m.sender_id)
          const editing = editingId === m.id
          return (
            <Fragment key={m.id}>
              {showDay && <div className="chat-day-divider">{dayLabel(m.created_at)}</div>}
              <div
                className={'chat-bubble' + (mine ? ' mine' : ' theirs')}
                onClick={() => {
                  if (!editing && activeId === m.id) {
                    setActiveId(null)
                    setConfirmDeleteId(null)
                  }
                }}
                onTouchStart={() => !editing && startPress(m.id)}
                onTouchEnd={cancelPress}
                onTouchMove={cancelPress}
                onMouseDown={() => !editing && startPress(m.id)}
                onMouseUp={cancelPress}
                onMouseLeave={cancelPress}
                onContextMenu={(e) => e.preventDefault()}
              >
                {showName && <div className="chat-bubble-name">{m.sender_name || partnerName || 'Partner'}</div>}

                {editing ? (
                  <form
                    className="chat-edit-form"
                    onClick={(e) => e.stopPropagation()}
                    onSubmit={(e) => {
                      e.preventDefault()
                      saveEdit(m.id)
                    }}
                  >
                    <input value={editText} onChange={(e) => setEditText(e.target.value)} autoFocus />
                    <div className="chat-edit-actions">
                      <button type="submit">Save</button>
                      <button type="button" onClick={() => setEditingId(null)}>
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <>
                    {m.image_path && <ChatImage path={m.image_path} onOpen={setLightboxUrl} />}
                    {m.audio_path && <VoiceNotePlayer path={m.audio_path} />}
                    {m.text && <div className="chat-bubble-text">{m.text}</div>}
                    <div className="chat-bubble-time">
                      {timeLabel(m.created_at)}
                      {m.edited_at ? ' · edited' : ''}
                    </div>
                  </>
                )}

                {Object.keys(reactions[m.id] || {}).length > 0 && (
                  <div className={'chat-bubble-reactions' + (mine ? ' mine' : '')}>
                    {Object.entries(reactions[m.id]).map(([uid, emoji]) => (
                      <span key={uid} className="reaction-chip">
                        {emoji}
                      </span>
                    ))}
                  </div>
                )}

                {activeId === m.id && !editing && (
                  <div className="chat-bubble-actions" onClick={(e) => e.stopPropagation()}>
                    <div className="reaction-picker">
                      {QUICK_REACTIONS.map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          className={reactions[m.id]?.[user.id] === emoji ? 'active' : ''}
                          onClick={() => react(m.id, emoji)}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                    {mine && (
                      <div className="chat-bubble-actions-row">
                        {m.text != null && !m.image_path && !m.audio_path && (
                          <button type="button" onClick={() => startEdit(m)}>
                            Edit
                          </button>
                        )}
                        {confirmDeleteId === m.id ? (
                          <>
                            <button type="button" onClick={() => deleteMessage(m.id)}>
                              Confirm delete
                            </button>
                            <button type="button" onClick={() => setConfirmDeleteId(null)}>
                              Cancel
                            </button>
                          </>
                        ) : (
                          <button type="button" onClick={() => setConfirmDeleteId(m.id)}>
                            Delete
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </Fragment>
          )
        })}

        {queued.map((m) => (
          <div key={m.localId} className="chat-bubble mine pending">
            <div className="chat-bubble-text">{m.text}</div>
            <div className="chat-bubble-time">Waiting to send…</div>
          </div>
        ))}

        {partnerTyping && <div className="typing-indicator">{partnerName || 'Partner'} is typing…</div>}

        {showSeenStatus && !partnerTyping && (
          <div className="chat-seen-status">{lastMessage.read_at ? 'Seen' : 'Delivered'}</div>
        )}

        <div ref={bottomRef} />
      </div>

      {error && <p className="error">{error}</p>}
      {micError && <p className="error">{micError}</p>}
      {queued.length > 0 && (
        <p className="queued-hint">
          {queued.length === 1 ? '1 message' : `${queued.length} messages`} will send automatically once you're back
          online.
        </p>
      )}

      <form onSubmit={send} className="chat-input-row">
        <label className="chat-attach-btn" title="Send a photo">
          📷
          <input
            type="file"
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files[0]
              if (file) sendImage(file)
              e.target.value = ''
            }}
            disabled={sending || recording}
            hidden
          />
        </label>
        <button
          type="button"
          className={'chat-attach-btn' + (recording ? ' recording' : '')}
          title={recording ? 'Stop and send' : 'Record a voice note'}
          onClick={handleMicTap}
          disabled={sending}
        >
          {recording ? '⏹️' : '🎤'}
        </button>
        <input
          type="text"
          placeholder="Type a message…"
          value={text}
          onChange={(e) => handleTyping(e.target.value)}
          disabled={recording}
        />
        <button type="submit" disabled={sending || recording || !text.trim()}>
          Send
        </button>
      </form>
      {recording && (
        <button className="link-btn small" onClick={cancelRecording}>
          Cancel recording
        </button>
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
