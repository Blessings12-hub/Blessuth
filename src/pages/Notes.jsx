import { useEffect, useState } from 'react'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '../firebase/config'
import { useAuth } from '../context/AuthContext'

export default function Notes() {
  const { couple, user, profile } = useAuth()
  const [notes, setNotes] = useState([])
  const [text, setText] = useState('')

  useEffect(() => {
    if (!couple) return
    const q = query(
      collection(db, 'couples', couple.id, 'notes'),
      orderBy('createdAt', 'desc')
    )
    const unsub = onSnapshot(q, (snap) => {
      setNotes(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    })
    return unsub
  }, [couple])

  async function send(e) {
    e.preventDefault()
    if (!text.trim()) return
    await addDoc(collection(db, 'couples', couple.id, 'notes'), {
      text: text.trim(),
      from: profile?.displayName || 'Me',
      fromUid: user.uid,
      createdAt: serverTimestamp(),
    })
    setText('')
  }

  async function remove(id) {
    await deleteDoc(doc(db, 'couples', couple.id, 'notes', id))
  }

  return (
    <div className="screen with-nav">
      <h2>💌 Love Notes</h2>
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
            className={'note-card' + (n.fromUid === user.uid ? ' mine' : '')}
          >
            <div className="note-text">{n.text}</div>
            <div className="note-meta">
              <span>{n.from}</span>
              {n.fromUid === user.uid && (
                <button className="link-btn small" onClick={() => remove(n.id)}>
                  delete
                </button>
              )}
            </div>
          </div>
        ))}
        {notes.length === 0 && <p className="empty-state">No notes yet — send the first one 💕</p>}
      </div>
    </div>
  )
}
