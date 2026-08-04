import { useEffect, useRef, useState } from 'react'
import { supabase } from '../supabase/config'
import { useAuth } from '../context/AuthContext'

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
  const { couple, user, partnerUid, partnerName, profile } = useAuth()
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const bottomRef = useRef(null)
  const listRef = useRef(null)

  async function loadMessages() {
    if (!couple) return
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('couple_id', couple.id)
      .order('created_at', { ascending: true })
      .limit(300)
    setMessages(data || [])
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

  useEffect(() => {
    if (!couple) return
    loadMessages()
    markRead()
    const channel = supabase
      .channel(`messages-${couple.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages', filter: `couple_id=eq.${couple.id}` },
        () => {
          loadMessages()
          markRead()
        }
      )
      .subscribe()
    return () => supabase.removeChannel(channel)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [couple?.id])

  // Keep the thread scrolled to the latest message as new ones arrive.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' })
  }, [messages.length])

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

  const lastMessage = messages[messages.length - 1]
  const showSeenStatus = lastMessage && lastMessage.sender_id === user?.id

  return (
    <div className="screen with-nav chat-screen">
      <h2>Chat</h2>
      <p className="subtitle">
        {partnerName ? `A running conversation with ${partnerName}.` : 'A running conversation with your partner.'}
      </p>

      <div className="chat-thread" ref={listRef}>
        {messages.length === 0 && (
          <p className="empty-state">No messages yet — say something to start the conversation.</p>
        )}

        {messages.map((m, i) => {
          const mine = m.sender_id === user?.id
          const prev = messages[i - 1]
          const showDay = !prev || dayLabel(prev.created_at) !== dayLabel(m.created_at)
          const showName = !mine && (!prev || prev.sender_id !== m.sender_id)
          return (
            <div key={m.id}>
              {showDay && <div className="chat-day-divider">{dayLabel(m.created_at)}</div>}
              <div className={'chat-bubble' + (mine ? ' mine' : ' theirs')}>
                {showName && <div className="chat-bubble-name">{m.sender_name || partnerName || 'Partner'}</div>}
                <div className="chat-bubble-text">{m.text}</div>
                <div className="chat-bubble-time">{timeLabel(m.created_at)}</div>
              </div>
            </div>
          )
        })}

        {showSeenStatus && (
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
          onChange={(e) => setText(e.target.value)}
        />
        <button type="submit" disabled={sending || !text.trim()}>
          Send
        </button>
      </form>
    </div>
  )
}
