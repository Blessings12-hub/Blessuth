import { useEffect, useState } from 'react'
import { supabase } from '../supabase/config'
import { useAuth } from '../context/AuthContext'
import { randomTruth, randomDare } from '../data/truthOrDare'

export default function TruthOrDare({ onBack }) {
  const { couple, user, partnerName } = useAuth()
  const [state, setState] = useState(null)
  const [busy, setBusy] = useState(false)

  async function loadState() {
    if (!couple) return
    const { data } = await supabase.from('truth_or_dare_state').select('*').eq('couple_id', couple.id).maybeSingle()
    setState(data || null)
  }

  useEffect(() => {
    if (!couple) return
    loadState()

    const channel = supabase
      .channel(`truth-or-dare-${couple.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'truth_or_dare_state', filter: `couple_id=eq.${couple.id}` },
        (payload) => setState(payload.new)
      )
      .subscribe()

    return () => supabase.removeChannel(channel)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [couple?.id])

  async function pick(kind) {
    setBusy(true)
    const prompt = kind === 'truth' ? randomTruth() : randomDare()
    await supabase
      .from('truth_or_dare_state')
      .upsert({ couple_id: couple.id, kind, prompt, chosen_by: user.id, updated_at: new Date().toISOString() })
    setBusy(false)
  }

  const chosenByMe = state?.chosen_by === user?.id
  const chooserName = chosenByMe ? 'You' : partnerName || 'They'

  return (
    <>
      <button className="link-btn" onClick={onBack}>
        ← Back to games
      </button>
      <h2>Truth or Dare</h2>
      <p className="subtitle">Either of you can pick — whatever comes up shows for both of you.</p>

      {state?.prompt ? (
        <div className={'tod-card ' + state.kind}>
          <div className="tod-kind-badge">{state.kind === 'truth' ? '💬 Truth' : '⚡ Dare'}</div>
          <p className="tod-prompt">{state.prompt}</p>
          <p className="tod-chosen-by">picked by {chooserName}</p>
        </div>
      ) : (
        <div className="game-empty-state">
          <p>Nothing picked yet — choose one below.</p>
        </div>
      )}

      <div className="tod-buttons">
        <button className="tod-choice-btn truth" onClick={() => pick('truth')} disabled={busy}>
          💬 Truth
        </button>
        <button className="tod-choice-btn dare" onClick={() => pick('dare')} disabled={busy}>
          ⚡ Dare
        </button>
      </div>
    </>
  )
}
