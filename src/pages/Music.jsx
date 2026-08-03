import { useEffect, useState } from 'react'
import { supabase } from '../supabase/config'
import { useAuth } from '../context/AuthContext'

const MOODS = ['😊', '😍', '😴', '😢', '😤', '🥳', '😌', '🤒', '😬', '🥰']

export default function Music() {
  const { couple, user, partnerUid, partnerName, profile } = useAuth()
  const [mine, setMine] = useState(null)
  const [theirs, setTheirs] = useState(null)
  const [mood, setMood] = useState('😊')
  const [song, setSong] = useState('')

  async function loadMoods() {
    const { data } = await supabase.from('moods').select('*').eq('couple_id', couple.id)
    const mineRow = data?.find((r) => r.user_id === user.id) || null
    setMine(mineRow)
    if (mineRow) {
      setMood(mineRow.mood)
      setSong(mineRow.song || '')
    }
    setTheirs(data?.find((r) => r.user_id === partnerUid) || null)
  }

  useEffect(() => {
    if (!couple) return
    loadMoods()
    const channel = supabase
      .channel(`moods-${couple.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'moods', filter: `couple_id=eq.${couple.id}` },
        loadMoods
      )
      .subscribe()
    return () => supabase.removeChannel(channel)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [couple?.id, partnerUid])

  async function save(e) {
    e.preventDefault()
    await supabase.from('moods').upsert({
      couple_id: couple.id,
      user_id: user.id,
      mood,
      song,
      label: profile?.display_name || 'Me',
      updated_at: new Date().toISOString(),
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
