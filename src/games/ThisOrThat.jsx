import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabase/config'
import { useAuth } from '../context/AuthContext'
import Confetti from '../components/Confetti'
import { THIS_OR_THAT_PAIRS, seededShuffle } from '../data/thisOrThat'

const BATCH_SIZE = 10
const DEFAULT_BATCH_KEY = 'daily'

export default function ThisOrThat({ onBack }) {
  const { couple, user, partnerUid, partnerName, profile } = useAuth()
  const [batchKey, setBatchKey] = useState(DEFAULT_BATCH_KEY)
  const [mine, setMine] = useState(null)
  const [theirs, setTheirs] = useState(null)
  const [step, setStep] = useState(0)
  const [selections, setSelections] = useState([])

  // Both partners derive the exact same question order from the same
  // batch_key — no randomness happens independently on each device.
  const pairs = useMemo(() => seededShuffle(THIS_OR_THAT_PAIRS, batchKey).slice(0, BATCH_SIZE), [batchKey])

  async function loadRound() {
    if (!couple) return
    const { data } = await supabase.from('this_or_that_round').select('*').eq('couple_id', couple.id).maybeSingle()
    setBatchKey(data?.batch_key || DEFAULT_BATCH_KEY)
  }

  async function loadAnswers(key) {
    if (!couple) return
    const { data } = await supabase
      .from('this_or_that_answers')
      .select('*')
      .eq('couple_id', couple.id)
      .eq('batch_key', key)
    const mineRow = (data || []).find((r) => r.user_id === user.id)
    const theirsRow = (data || []).find((r) => r.user_id === partnerUid)
    setMine(mineRow || null)
    setTheirs(theirsRow || null)
    setSelections([])
    setStep(0)
  }

  useEffect(() => {
    if (!couple) return
    loadRound()

    const channel = supabase
      .channel(`this-or-that-${couple.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'this_or_that_round', filter: `couple_id=eq.${couple.id}` },
        (payload) => setBatchKey(payload.new.batch_key)
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'this_or_that_answers', filter: `couple_id=eq.${couple.id}` },
        () => loadAnswers(batchKey)
      )
      .subscribe()

    return () => supabase.removeChannel(channel)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [couple?.id, batchKey])

  useEffect(() => {
    loadAnswers(batchKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batchKey])

  async function pick(choice) {
    const next = [...selections, choice]
    setSelections(next)
    if (step + 1 < pairs.length) {
      setStep(step + 1)
      return
    }
    await supabase.from('this_or_that_answers').upsert({
      couple_id: couple.id,
      batch_key: batchKey,
      user_id: user.id,
      user_name: profile?.display_name || 'You',
      answers: next,
      updated_at: new Date().toISOString(),
    })
  }

  async function playAgain() {
    const nextKey = `round-${Date.now()}`
    await supabase
      .from('this_or_that_round')
      .upsert({ couple_id: couple.id, batch_key: nextKey, updated_by: user.id, updated_at: new Date().toISOString() })
    setBatchKey(nextKey)
  }

  const myDone = !!mine
  const theirsDone = !!theirs
  const bothDone = myDone && theirsDone

  let matchCount = 0
  if (bothDone) {
    mine.answers.forEach((a, i) => {
      if (a === theirs.answers[i]) matchCount++
    })
  }
  const matchPct = bothDone ? Math.round((matchCount / pairs.length) * 100) : null

  return (
    <>
      <button className="link-btn" onClick={onBack}>
        ← Back to games
      </button>
      <h2>This or That</h2>
      <p className="subtitle">Quick picks, your own honest choice — then see how well you match.</p>

      {myDone && !bothDone && (
        <div className="game-empty-state">
          <p>You're done! Waiting for {partnerName || 'your partner'} to finish their picks.</p>
        </div>
      )}

      {!myDone && step < pairs.length && (
        <div className="tot-card">
          <p className="tot-progress">
            {step + 1} of {pairs.length}
          </p>
          <div className="tot-options">
            <button className="tot-option-btn" onClick={() => pick(pairs[step][0])}>
              {pairs[step][0]}
            </button>
            <div className="tot-or">or</div>
            <button className="tot-option-btn" onClick={() => pick(pairs[step][1])}>
              {pairs[step][1]}
            </button>
          </div>
        </div>
      )}

      {bothDone && (
        <div className={'tot-result-card' + (matchPct >= 70 ? ' win' : '')}>
          {matchPct >= 70 && <Confetti />}
          <p className="tot-result-pct">{matchPct}%</p>
          <p className="tot-result-label">
            you two matched on {matchCount} of {pairs.length} picks
          </p>
          <div className="tot-compare-list">
            {mine.answers.map((a, i) => {
              const matched = a === theirs.answers[i]
              return (
                <div key={i} className={'tot-compare-row' + (matched ? ' matched' : '')}>
                  <span className="tot-compare-you">{a}</span>
                  <span className="tot-compare-vs">{matched ? '🤝' : 'vs'}</span>
                  <span className="tot-compare-them">{theirs.answers[i]}</span>
                </div>
              )
            })}
          </div>
          <button className="primary-btn" onClick={playAgain}>
            Play a new round
          </button>
        </div>
      )}
    </>
  )
}
