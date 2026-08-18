import { useEffect, useState } from 'react'
import { supabase } from '../supabase/config'
import { useAuth } from '../context/AuthContext'

// Picks a photo or note from the same month+day in a previous year and
// surfaces it as a small "memory lane" card. Renders nothing if there's
// no match yet — couples who just joined won't see an empty card.
export default function OnThisDay() {
  const { couple } = useAuth()
  const [memory, setMemory] = useState(null)

  useEffect(() => {
    if (!couple) return
    let cancelled = false

    async function load() {
      const today = new Date()
      const month = today.getMonth()
      const date = today.getDate()

      const [{ data: photos }, { data: notes }] = await Promise.all([
        supabase.from('photos').select('*').eq('couple_id', couple.id),
        supabase.from('notes').select('*').eq('couple_id', couple.id),
      ])

      const isPastMatch = (iso) => {
        const d = new Date(iso)
        return d.getMonth() === month && d.getDate() === date && d.getFullYear() < today.getFullYear()
      }

      const candidates = [
        ...(photos || []).filter((p) => isPastMatch(p.created_at)).map((p) => ({ type: 'photo', ...p })),
        ...(notes || []).filter((n) => isPastMatch(n.created_at)).map((n) => ({ type: 'note', ...n })),
      ]

      if (cancelled) return
      if (candidates.length === 0) {
        setMemory(null)
        return
      }

      const pick = candidates[Math.floor(Math.random() * candidates.length)]
      const yearsAgo = today.getFullYear() - new Date(pick.created_at).getFullYear()
      setMemory({ ...pick, yearsAgo })
    }

    load()
    return () => {
      cancelled = true
    }
  }, [couple?.id])

  if (!memory) return null

  return (
    <div className="daily-card on-this-day-card">
      <div className="daily-header">
        <span className="daily-tag">
          On this day, {memory.yearsAgo} year{memory.yearsAgo === 1 ? '' : 's'} ago
        </span>
      </div>
      {memory.type === 'photo' ? (
        <div className="on-this-day-photo">
          <img src={memory.url} alt={memory.caption || 'A memory'} />
          {memory.caption && <p className="on-this-day-caption">{memory.caption}</p>}
        </div>
      ) : (
        <p className="on-this-day-note">
          “{memory.text}” <span className="on-this-day-from">— {memory.from_name}</span>
        </p>
      )}
    </div>
  )
}
