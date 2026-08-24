import { useEffect, useState } from 'react'
import { supabase } from '../supabase/config'
import { useAuth } from '../context/AuthContext'
import Confetti from '../components/Confetti'

export default function StoryChain({ onBack }) {
  const { couple, user, partnerUid, partnerName, profile } = useAuth()
  const [round, setRound] = useState(null)
  const [lines, setLines] = useState([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)

  async function loadRound() {
    if (!couple) return
    const { data } = await supabase
      .from('story_chain_rounds')
      .select('*')
      .eq('couple_id', couple.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    setRound(data || null)
    if (data) {
      loadLines(data.id)
    } else {
      setLines([])
    }
  }

  async function loadLines(roundId) {
    const { data } = await supabase
      .from('story_chain_lines')
      .select('*')
      .eq('round_id', roundId)
      .order('created_at', { ascending: true })
    setLines(data || [])
  }

  useEffect(() => {
    if (!couple) return
    loadRound()

    const channel = supabase
      .channel(`story-chain-${couple.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'story_chain_rounds', filter: `couple_id=eq.${couple.id}` },
        () => loadRound()
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'story_chain_lines', filter: `couple_id=eq.${couple.id}` },
        (payload) => {
          setLines((prev) => (prev.some((l) => l.id === payload.new.id) ? prev : [...prev, payload.new]))
        }
      )
      .subscribe()

    return () => supabase.removeChannel(channel)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [couple?.id])

  async function startRound() {
    setBusy(true)
    await supabase.from('story_chain_rounds').insert({
      couple_id: couple.id,
      created_by: user.id,
    })
    setBusy(false)
  }

  async function addLine() {
    if (!input.trim() || !round) return
    setBusy(true)
    await supabase.from('story_chain_lines').insert({
      round_id: round.id,
      couple_id: couple.id,
      user_id: user.id,
      user_name: profile?.display_name || 'You',
      text: input.trim(),
    })
    const newCount = lines.length + 1
    if (newCount >= round.max_lines) {
      await supabase.from('story_chain_rounds').update({ ended_at: new Date().toISOString() }).eq('id', round.id)
    }
    setInput('')
    setBusy(false)
  }

  const active = round && !round.ended_at
  const finished = round && round.ended_at
  const lastAuthor = lines.length > 0 ? lines[lines.length - 1].user_id : null
  const myTurn = active && (lastAuthor === null ? round.created_by === user.id : lastAuthor === partnerUid)

  return (
    <>
      <button className="link-btn" onClick={onBack}>
        ← Back to games
      </button>
      <h2>Story Chain</h2>
      <p className="subtitle">Build a story together, one line at a time — take turns, see where it goes.</p>

      {!round && (
        <div className="game-empty-state">
          <p>No story going yet.</p>
          <button className="primary-btn" onClick={startRound} disabled={busy}>
            Start a story
          </button>
        </div>
      )}

      {round && (
        <>
          {lines.length > 0 && (
            <div className="story-lines">
              {lines.map((l) => (
                <div key={l.id} className={'story-line' + (l.user_id === user.id ? ' mine' : '')}>
                  <p className="story-line-text">{l.text}</p>
                  <p className="story-line-by">{l.user_id === user.id ? 'You' : l.user_name || partnerName}</p>
                </div>
              ))}
            </div>
          )}

          {active && (
            <p className="story-progress">
              {lines.length} of {round.max_lines} lines
              {myTurn ? ' · your turn' : ` · waiting for ${partnerName || 'your partner'}`}
            </p>
          )}

          {active && myTurn && (
            <div className="word-input-row">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addLine()}
                placeholder="Add the next line…"
                className="word-input pictionary-guess-input"
              />
              <button className="primary-btn" onClick={addLine} disabled={busy}>
                Add
              </button>
            </div>
          )}

          {finished && (
            <div className="word-result-card win">
              <Confetti />
              <p className="word-result-title">🎉 The End</p>
              <p className="word-result-word">Your story is complete — {lines.length} lines.</p>
              <button className="primary-btn" onClick={startRound} disabled={busy}>
                Start a new story
              </button>
            </div>
          )}
        </>
      )}
    </>
  )
}
