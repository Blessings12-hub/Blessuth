import { useEffect, useState } from 'react'
import { supabase } from '../supabase/config'
import { useAuth } from '../context/AuthContext'

export default function Notes() {
  const { couple, user, profile } = useAuth()
  const [notes, setNotes] = useState([])
  const [text, setText] = useState('')

  async function loadNotes() {
    const { data } = await supabase
      .from('notes')
      .select('*')
      .eq('couple_id', couple.id)
      .order('created_at', { ascending: false })
    setNotes(data || [])
  }

  useEffect(() => {
    if (!couple) return
    loadNotes()
    const channel = supabase
      .channel(`notes-${couple.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notes', filter: `couple_id=eq.${couple.id}` },
        loadNotes
      )
      .subscribe()
    return () => supabase.removeChannel(channel)
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

  async function remove(id) {
    await supabase.from('notes').delete().eq('id', id)
  }

  return (
    <div className="screen with-nav">
      <h2>Love Notes</h2>
      <p className="subtitle">Little messages for each other, anytime.</p>

      <form onSubmit={send} className="note-form">
        <input
          type="text"
          placeholder="Write a little note…"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button type="submit">Send</button>
      </form>

      <div className="notes-list">
        {notes.map((n) => (
          <div
            key={n.id}
            className={'note-card' + (n.from_uid === user.id ? ' mine' : '')}
          >
            <div className="note-text">{n.text}</div>
            <div className="note-meta">
              <span>{n.from_name}</span>
              {n.from_uid === user.id && (
                <button className="link-btn small" onClick={() => remove(n.id)}>
                  delete
                </button>
              )}
            </div>
          </div>
        ))}
        {notes.length === 0 && <p className="empty-state">No notes yet — send the first one</p>}
      </div>
    </div>
  )
}
