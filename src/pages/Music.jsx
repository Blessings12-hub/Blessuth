import { useEffect, useState } from 'react'
import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore'
import { db } from '../firebase/config'
import { useAuth } from '../context/AuthContext'

const MOODS = ['😊', '😍', '😴', '😢', '😤', '🥳', '😌', '🤒', '😬', '🥰']

export default function Music() {
  const { couple, user, partnerUid, partnerName, profile } = useAuth()
  const [mine, setMine] = useState(null)
  const [theirs, setTheirs] = useState(null)
  const [mood, setMood] = useState('😊')
  const [song, setSong] = useState('')

  useEffect(() => {
    if (!couple) return
    const ref = doc(db, 'couples', couple.id, 'mood', user.uid)
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        setMine(snap.data())
        setMood(snap.data().mood)
        setSong(snap.data().song || '')
      }
    })
    return unsub
  }, [couple, user])

  useEffect(() => {
    if (!couple || !partnerUid) return
    const ref = doc(db, 'couples', couple.id, 'mood', partnerUid)
    const unsub = onSnapshot(ref, (snap) => setTheirs(snap.exists() ? snap.data() : null))
    return unsub
  }, [couple, partnerUid])

  async function save(e) {
    e.preventDefault()
    await setDoc(doc(db, 'couples', couple.id, 'mood', user.uid), {
      mood,
      song,
      label: profile?.displayName || 'Me',
      updatedAt: serverTimestamp(),
    })
  }

  return (
    <div className="screen with-nav">
      <h2>🎧 Mood & Music</h2>
      <p className="subtitle">Share how you're feeling and what you're listening to.</p>

      <form onSubmit={save} className="mood-form">
        <div className="mood-picker">
          {MOODS.map((m) => (
            <button
              type="button"
              key={m}
              className={'mood-btn' + (m === mood ? ' active' : '')}
              onClick={() => setMood(m)}
            >
              {m}
            </button>
          ))}
        </div>
        <input
          type="text"
          placeholder="What are you listening to? (song — artist)"
          value={song}
          onChange={(e) => setSong(e.target.value)}
        />
        <button type="submit">Update</button>
      </form>

      <div className="mood-cards">
        <div className="mood-card">
          <div className="mood-card-title">You</div>
          <div className="mood-emoji">{mine?.mood || '—'}</div>
          {mine?.song && <div className="mood-song">🎵 {mine.song}</div>}
        </div>
        <div className="mood-card">
          <div className="mood-card-title">{partnerName || 'Partner'}</div>
          <div className="mood-emoji">{theirs?.mood || '—'}</div>
          {theirs?.song && <div className="mood-song">🎵 {theirs.song}</div>}
        </div>
      </div>
    </div>
  )
}
