import { useEffect, useState } from 'react'
import { supabase } from '../supabase/config'
import { useAuth } from '../context/AuthContext'

export default function QuickTapDuel({ onBack }) {
  const { couple, user, partnerUid, partnerName, profile } = useAuth()
  const [mine, setMine] = useState(0)
  const [theirs, setTheirs] = useState(0)
  const [done, setDone] = useState(false)
  const [sent, setSent] = useState(false)

  useEffect(() => {
    if (!couple) return
    const load = async () => {
      const { data } = await supabase.from('quick_game_scores').select('*').eq('couple_id', couple.id).eq('game_key', 'quick-tap')
      const mineRow = (data || []).find((row) => row.user_id === user?.id)
      const partnerRow = (data || []).find((row) => row.user_id === partnerUid)
      setMine(mineRow?.score || 0)
      setTheirs(partnerRow?.score || 0)
      setDone((mineRow?.score || 0) >= 10)
    }
    load()
    const channel = supabase.channel(`quick-tap-${couple.id}`).on('postgres_changes', { event: '*', schema: 'public', table: 'quick_game_scores', filter: `couple_id=eq.${couple.id}` }, load).subscribe()
    return () => supabase.removeChannel(channel)
  }, [couple?.id, partnerUid, user?.id])

  async function tap() {
    if (done || !couple) return
    const next = mine + 1
    setMine(next)
    if (next >= 10) {
      setDone(true)
      await supabase.from('quick_game_scores').upsert({ couple_id: couple.id, game_key: 'quick-tap', user_id: user.id, user_name: profile?.display_name || 'You', score: next, updated_at: new Date().toISOString() }, { onConflict: 'couple_id,game_key,user_id' })
      setSent(true)
    }
  }

  return <>
    <button className="link-btn" onClick={onBack}>← Back to games</button>
    <h2>Quick Tap Duel</h2>
    <p className="subtitle">An original message-style mini game. First partner to tap 10 wins.</p>
    <div className="quick-game-card">
      <div className="quick-scoreboard"><span>You <strong>{mine}/10</strong></span><span>{partnerName || 'Partner'} <strong>{theirs}/10</strong></span></div>
      <button className="quick-tap-button" onClick={tap} disabled={done} aria-label={`Tap to score, ${mine} of 10`}>{done ? 'Round complete' : 'Tap!'}</button>
      {sent && <p className="activity-feedback" role="status">Your score is in. {partnerName || 'Your partner'} has been notified.</p>}
    </div>
  </>
}


