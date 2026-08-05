import { useEffect, useRef, useState } from 'react'
import { supabase } from '../supabase/config'
import { useAuth } from '../context/AuthContext'

const PAGE_SIZE = 50

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

  const bottomRef = useRef(null)
  const presenceChannelRef = useRef(null)
  const typingHideRef = useRef(null)
  const myTypingResetRef = useRef(null)

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

  async function markRead() {
    if (!couple || !user) return
    await supabase
      .from('messages')
      .update({ read_at: new Date().toISOString() })
      .eq('couple_id', couple.id)
      .neq('sender_id', user.id)
      .is('read_at', null)
  }

  // Initial load + realtime subscription for inserts/updates/deletes.
  useEffect(() => {
    if (!couple) return
    loadInitial()
    markRead()

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

    return () => supabase.removeChannel(channel)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [couple?.id])

  // Presence (online dot) + typing broadcast on a separate lightweight channel.
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

  // Only autoscroll when the newest message actually changes (not when
  // older history gets prepended via "Load earlier").
  const lastId = messages[messages.length - 1]?.id
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
    setSending(true)
    setError('')
    setText('')
    const { error: err } = await supabase.from('messages').insert({
      couple_id: couple.id,
      sender_id: user.id,
      sender_name: profile?.display_name || 'Me',
      text: value,
    })
    setSending(false)
    if (err) {
      setError(err.message)
      setText(value)
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
  }

  const lastMessage = messages[messages.length - 1]
  const showSeenStatus = lastMessage && lastMessage.sender_id === user?.id

  return (
    <div className="screen with-nav chat-screen">
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

        {messages.length === 0 && (
          <p className="empty-state">No messages yet — say something to start the conversation.</p>
        )}

        {messages.map((m, i) => {
          const mine = m.sender_id === user?.id
          const prev = messages[i - 1]
          const showDay = !prev || dayLabel(prev.created_at) !== dayLabel(m.created_at)
          const showName = !mine && (!prev || prev.sender_id !== m.sender_id)
          const editing = editingId === m.id
          return (
            <div key={m.id}>
              {showDay && <div className="chat-day-divider">{dayLabel(m.created_at)}</div>}
              <div
                className={'chat-bubble' + (mine ? ' mine' : ' theirs')}
                onClick={() => mine && !editing && setActiveId(activeId === m.id ? null : m.id)}
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
                    <div className="chat-bubble-text">{m.text}</div>
                    <div className="chat-bubble-time">
                      {timeLabel(m.created_at)}
                      {m.edited_at ? ' · edited' : ''}
                    </div>
                  </>
                )}

                {mine && activeId === m.id && !editing && (
                  <div className="chat-bubble-actions" onClick={(e) => e.stopPropagation()}>
                    <button type="button" onClick={() => startEdit(m)}>
                      Edit
                    </button>
                    <button type="button" onClick={() => deleteMessage(m.id)}>
                      Delete
                    </button>
                  </div>
                )}
              </div>
            </div>
          )
        })}

        {partnerTyping && (
          <div className="typing-indicator">{partnerName || 'Partner'} is typing…</div>
        )}

        {showSeenStatus && !partnerTyping && (
          <div className="chat-seen-status">{lastMessage.read_at ? 'Seen' : 'Delivered'}</div>
        )}

        <div ref={bottomRef} />
      </div>

      {error && <p className="error">{error}</p>}

      <form onSubmit={send} className="chat-input-row">
        <input
          type="text"
          placeholder="Type a message…"
          value={text}
          onChange={(e) => handleTyping(e.target.value)}
        />
        <button type="submit" disabled={sending || !text.trim()}>
          Send
        </button>
      </form>
    </div>
  )
}
