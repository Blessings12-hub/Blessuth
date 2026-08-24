import { useEffect, useState } from 'react'
import { supabase } from '../supabase/config'
import { useAuth } from '../context/AuthContext'
import Confetti from '../components/Confetti'
import { randomTargetWord, isValidGuess } from '../data/wordList'

const WORD_LEN = 5

// Wordle-style comparison, with correct handling of repeated letters: greens
// are claimed first, then yellows are matched against whatever's left.
function evaluateGuess(guess, target) {
  const g = guess.toLowerCase().split('')
  const t = target.toLowerCase().split('')
  const result = Array(WORD_LEN).fill('gray')
  const used = Array(WORD_LEN).fill(false)

  for (let i = 0; i < WORD_LEN; i++) {
    if (g[i] === t[i]) {
      result[i] = 'green'
      used[i] = true
    }
  }
  for (let i = 0; i < WORD_LEN; i++) {
    if (result[i] === 'green') continue
    const idx = t.findIndex((ch, j) => ch === g[i] && !used[j])
    if (idx !== -1) {
      result[i] = 'yellow'
      used[idx] = true
    }
  }
  return result
}

export default function WordGame({ onBack }) {
  const { couple, user, profile } = useAuth()
  const [round, setRound] = useState(null)
  const [guesses, setGuesses] = useState([])
  const [input, setInput] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function loadRound() {
    if (!couple) return
    const { data } = await supabase
      .from('word_rounds')
      .select('*')
      .eq('couple_id', couple.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    setRound(data || null)
    if (data) {
      const { data: g } = await supabase
        .from('word_guesses')
        .select('*')
        .eq('round_id', data.id)
        .order('created_at', { ascending: true })
      setGuesses(g || [])
    } else {
      setGuesses([])
    }
  }

  useEffect(() => {
    if (!couple) return
    loadRound()

    const channel = supabase
      .channel(`word-game-${couple.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'word_rounds', filter: `couple_id=eq.${couple.id}` },
        () => loadRound()
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'word_guesses', filter: `couple_id=eq.${couple.id}` },
        (payload) => {
          setGuesses((prev) => (prev.some((g) => g.id === payload.new.id) ? prev : [...prev, payload.new]))
        }
      )
      .subscribe()

    return () => supabase.removeChannel(channel)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [couple?.id])

  async function startRound() {
    setBusy(true)
    await supabase.from('word_rounds').insert({
      couple_id: couple.id,
      target_word: randomTargetWord(),
      created_by: user.id,
    })
    setBusy(false)
  }

  async function submitGuess() {
    setError('')
    const word = input.trim().toLowerCase()
    if (word.length !== WORD_LEN) {
      setError(`Guess must be ${WORD_LEN} letters.`)
      return
    }
    if (!isValidGuess(word)) {
      setError("That's not in the word list — try another.")
      return
    }
    setBusy(true)
    await supabase.from('word_guesses').insert({
      round_id: round.id,
      couple_id: couple.id,
      user_id: user.id,
      user_name: profile?.display_name || 'You',
      guess: word,
    })

    const solved = word === round.target_word.toLowerCase()
    const guessesSoFar = guesses.length + 1
    if (solved) {
      await supabase.from('word_rounds').update({ solved_at: new Date().toISOString() }).eq('id', round.id)
    } else if (guessesSoFar >= round.max_guesses) {
      await supabase.from('word_rounds').update({ failed: true }).eq('id', round.id)
    }
    setInput('')
    setBusy(false)
  }

  const active = round && !round.solved_at && !round.failed
  const finished = round && (round.solved_at || round.failed)

  return (
    <>
      <button className="link-btn" onClick={onBack}>
        ← Back to games
      </button>
      <h2>Word Game</h2>
      <p className="subtitle">
        One shared word, {round?.max_guesses || 6} guesses total — take turns or jump in anytime, you're
        solving it together.
      </p>

      {!round && (
        <div className="game-empty-state">
          <p>No round in progress.</p>
          <button className="primary-btn" onClick={startRound} disabled={busy}>
            Start a word
          </button>
        </div>
      )}

      {round && (
        <>
          <div className="word-grid">
            {Array.from({ length: round.max_guesses }).map((_, rowIdx) => {
              const g = guesses[rowIdx]
              // Tiles are colored against the real target word — never
              // displayed as text itself, only used to color feedback.
              const rowColors = g ? evaluateGuess(g.guess, round.target_word) : null
              return (
                <div key={rowIdx} className="word-row">
                  {Array.from({ length: WORD_LEN }).map((_, colIdx) => (
                    <div
                      key={colIdx}
                      className={'word-tile' + (rowColors ? ` ${rowColors[colIdx]}` : '')}
                    >
                      {g ? g.guess[colIdx].toUpperCase() : ''}
                    </div>
                  ))}
                  {g && <div className="word-row-by">{g.user_name}</div>}
                </div>
              )
            })}
          </div>

          {active && (
            <div className="word-input-row">
              <input
                type="text"
                maxLength={WORD_LEN}
                value={input}
                onChange={(e) => setInput(e.target.value.replace(/[^a-zA-Z]/g, ''))}
                onKeyDown={(e) => e.key === 'Enter' && submitGuess()}
                placeholder="Type a guess"
                className="word-input"
                autoCapitalize="characters"
              />
              <button className="primary-btn" onClick={submitGuess} disabled={busy}>
                Guess
              </button>
            </div>
          )}
          {error && <p className="error">{error}</p>}

          {finished && (
            <div className={'word-result-card' + (round.solved_at ? ' win' : ' lose')}>
              {round.solved_at && <Confetti />}
              <p className="word-result-title">
                {round.solved_at ? `🎉 Solved in ${guesses.length}!` : "Out of guesses — so close!"}
              </p>
              <p className="word-result-word">
                The word was <strong>{round.target_word.toUpperCase()}</strong>
              </p>
              <button className="primary-btn" onClick={startRound} disabled={busy}>
                Start a new word
              </button>
            </div>
          )}
        </>
      )}
    </>
  )
}
