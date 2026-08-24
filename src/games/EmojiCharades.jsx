import { useEffect, useState } from 'react'
import { supabase } from '../supabase/config'
import { useAuth } from '../context/AuthContext'
import Confetti from '../components/Confetti'
import { randomEmojiPhrase } from '../data/emojiCharades'

export default function EmojiCharades({ onBack }) {
  const { couple, user, partnerUid, partnerName } = useAuth()
  const [round, setRound] = useState(null)
  const [emojiInput, setEmojiInput] = useState('')
  const [guess, setGuess] = useState('')
  const [wrongFlash, setWrongFlash] = useState(false)
  const [busy, setBusy] = useState(false)

  const isClueGiver = round && round.clue_giver_id === user.id

  async function loadRound() {
    if (!couple) return
    const { data } = await supabase
      .from('emoji_charades_rounds')
      .select('*')
      .eq('couple_id', couple.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    setRound(data || null)
    setEmojiInput(data?.emojis || '')
  }

  useEffect(() => {
    if (!couple) return
    loadRound()

    const channel = supabase
      .channel(`emoji-charades-${couple.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'emoji_charades_rounds', filter: `couple_id=eq.${couple.id}` },
        (payload) => {
          setRound(payload.new)
          if (payload.new.clue_giver_id !== user.id) setEmojiInput(payload.new.emojis || '')
        }
      )
      .subscribe()

    return () => supabase.removeChannel(channel)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [couple?.id])

  async function startRound() {
    setBusy(true)
    const clueGiverId = round && round.clue_giver_id === user.id ? partnerUid : user.id
    await supabase.from('emoji_charades_rounds').insert({
      couple_id: couple.id,
      phrase: randomEmojiPhrase(),
      clue_giver_id: clueGiverId,
      created_by: user.id,
    })
    setBusy(false)
  }

  async function updateEmojis(next) {
    setEmojiInput(next)
    await supabase.from('emoji_charades_rounds').update({ emojis: next }).eq('id', round.id)
  }

  async function submitGuess() {
    if (!guess.trim() || !round) return
    const correct = guess.trim().toLowerCase() === round.phrase.toLowerCase()
    if (correct) {
      setBusy(true)
      await supabase
        .from('emoji_charades_rounds')
        .update({ solved_at: new Date().toISOString(), winning_guess: guess.trim() })
        .eq('id', round.id)
      setBusy(false)
    } else {
      setWrongFlash(true)
      setTimeout(() => setWrongFlash(false), 500)
    }
    setGuess('')
  }

  const active = round && !round.solved_at

  return (
    <>
      <button className="link-btn" onClick={onBack}>
        ← Back to games
      </button>
      <h2>Emoji Charades</h2>
      <p className="subtitle">Translate the secret phrase into emojis — your partner decodes it live.</p>

      {!round && (
        <div className="game-empty-state">
          <p>No round in progress.</p>
          <button className="primary-btn" onClick={startRound} disabled={busy}>
            Start a round
          </button>
        </div>
      )}

      {round && (
        <>
          {isClueGiver ? (
            <p className="pictionary-role-banner drawer">
              Translate into emojis: <strong>{round.phrase}</strong>
            </p>
          ) : (
            <p className="pictionary-role-banner guesser">
              {partnerName || 'Your partner'} is translating — guess the phrase!
            </p>
          )}

          <div className={'emoji-display' + (wrongFlash ? ' shake' : '')}>
            {emojiInput || (isClueGiver ? 'Type emojis below…' : 'Waiting for emojis…')}
          </div>

          {isClueGiver && active && (
            <input
              type="text"
              value={emojiInput}
              onChange={(e) => updateEmojis(e.target.value)}
              placeholder="🦁👑"
              className="word-input pictionary-guess-input emoji-input"
            />
          )}

          {!isClueGiver && active && (
            <div className="word-input-row">
              <input
                type="text"
                value={guess}
                onChange={(e) => setGuess(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submitGuess()}
                placeholder="Type your guess"
                className="word-input pictionary-guess-input"
              />
              <button className="primary-btn" onClick={submitGuess} disabled={busy}>
                Guess
              </button>
            </div>
          )}

          {round.solved_at && (
            <div className="word-result-card win">
              <Confetti />
              <p className="word-result-title">
                🎉 {round.clue_giver_id === user.id ? partnerName || 'They' : 'You'} guessed it!
              </p>
              <p className="word-result-word">
                It was <strong>{round.phrase}</strong>
              </p>
              <button className="primary-btn" onClick={startRound} disabled={busy}>
                Start another round
              </button>
            </div>
          )}
        </>
      )}
    </>
  )
}
