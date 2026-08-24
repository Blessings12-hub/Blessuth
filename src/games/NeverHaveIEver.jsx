import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabase/config'
import { useAuth } from '../context/AuthContext'
import Confetti from '../components/Confetti'
import { NHIE_PROMPTS } from '../data/neverHaveIEver'
import { seededShuffle } from '../data/thisOrThat'

const BATCH_SIZE = 10
const DEFAULT_BATCH_KEY = 'daily'

export default function NeverHaveIEver({ onBack }) {
  const { couple, user, partnerUid, partnerName, profile } = useAuth()
  const [batchKey, setBatchKey] = useState(DEFAULT_BATCH_KEY)
  const [mine, setMine] = useState(null)
  const [theirs, setTheirs] = useState(null)
  const [step, setStep] = useState(0)
  const [selections, setSelections] = useState([])

  const prompts = useMemo(() => seededShuffle(NHIE_PROMPTS, batchKey).slice(0, BATCH_SIZE), [batchKey])

  async function loadRound() {
    if (!couple) return
    const { data } = await supabase.from('nhie_round').select('*').eq('couple_id', couple.id).maybeSingle()
    setBatchKey(data?.batch_key || DEFAULT_BATCH_KEY)
  }

  async function loadAnswers(key) {
    if (!couple) return
    const { data } = await supabase.from('nhie_answers').select('*').eq('couple_id', couple.id).eq('batch_key', key)
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
      .channel(`nhie-${couple.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'nhie_round', filter: `couple_id=eq.${couple.id}` },
        (payload) => setBatchKey(payload.new.batch_key)
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'nhie_answers', filter: `couple_id=eq.${couple.id}` },
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

  async function pick(haveIt) {
    const next = [...selections, haveIt]
    setSelections(next)
    if (step + 1 < prompts.length) {
      setStep(step + 1)
      return
    }
    await supabase.from('nhie_answers').upsert({
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
      .from('nhie_round')
      .upsert({ couple_id: couple.id, batch_key: nextKey, updated_by: user.id, updated_at: new Date().toISOString() })
    setBatchKey(nextKey)
  }

  const myDone = !!mine
  const theirsDone = !!theirs
  const bothDone = myDone && theirsDone

  let syncCount = 0
  if (bothDone) {
    mine.answers.forEach((a, i) => {
      if (a === theirs.answers[i]) syncCount++
    })
  }

  return (
    <>
      <button className="link-btn" onClick={onBack}>
        ← Back to games
      </button>
      <h2>Never Have I Ever</h2>
      <p className="subtitle">Answer honestly, then see where you match — and where you don't.</p>

      {myDone && !bothDone && (
        <div className="game-empty-state">
          <p>You're done! Waiting for {partnerName || 'your partner'} to finish.</p>
        </div>
      )}

      {!myDone && step < prompts.length && (
        <div className="tot-card">
          <p className="tot-progress">
            {step + 1} of {prompts.length}
          </p>
          <p className="nhie-prompt">Never have I ever… {prompts[step]}</p>
          <div className="tot-options nhie-options">
            <button className="tot-option-btn" onClick={() => pick(true)}>
              I have
            </button>
            <div className="tot-or">or</div>
            <button className="tot-option-btn" onClick={() => pick(false)}>
              I haven't
            </button>
          </div>
        </div>
      )}

      {bothDone && (
        <div className={'tot-result-card' + (syncCount >= 7 ? ' win' : '')}>
          {syncCount >= 7 && <Confetti />}
          <p className="tot-result-pct">
            {syncCount}/{prompts.length}
          </p>
          <p className="tot-result-label">you two are in sync on {syncCount} of {prompts.length}</p>
          <div className="tot-compare-list">
            {prompts.map((prompt, i) => {
              const myAns = mine.answers[i]
              const theirAns = theirs.answers[i]
              const matched = myAns === theirAns
              return (
                <div key={i} className={'nhie-compare-row' + (matched ? ' matched' : '')}>
                  <span className="nhie-compare-prompt">{prompt}</span>
                  <span className="nhie-compare-icons">
                    <span title="You">{myAns ? '✅' : '❌'}</span>
                    <span title={partnerName || 'Partner'}>{theirAns ? '✅' : '❌'}</span>
                  </span>
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
