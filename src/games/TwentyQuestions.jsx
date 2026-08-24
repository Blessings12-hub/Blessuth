import { useEffect, useState } from 'react'
import { supabase } from '../supabase/config'
import { useAuth } from '../context/AuthContext'
import Confetti from '../components/Confetti'

const MAX_QUESTIONS = 20

export default function TwentyQuestions({ onBack }) {
  const { couple, user, partnerUid, partnerName } = useAuth()
  const [round, setRound] = useState(null)
  const [lastAnswererId, setLastAnswererId] = useState(null)
  const [questions, setQuestions] = useState([])
  const [secretInput, setSecretInput] = useState('')
  const [questionInput, setQuestionInput] = useState('')
  const [guessInput, setGuessInput] = useState('')
  const [wrongFlash, setWrongFlash] = useState(false)
  const [busy, setBusy] = useState(false)

  async function loadRound() {
    if (!couple) return
    const { data } = await supabase
      .from('twenty_q_rounds')
      .select('*')
      .eq('couple_id', couple.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    setRound(data || null)
    if (data) {
      setLastAnswererId(data.answerer_id)
      loadQuestions(data.id)
    } else {
      setQuestions([])
    }
  }

  async function loadQuestions(roundId) {
    const { data } = await supabase
      .from('twenty_q_questions')
      .select('*')
      .eq('round_id', roundId)
      .order('created_at', { ascending: true })
    setQuestions(data || [])
  }

  useEffect(() => {
    if (!couple) return
    loadRound()

    const channel = supabase
      .channel(`twentyq-${couple.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'twenty_q_rounds', filter: `couple_id=eq.${couple.id}` },
        () => loadRound()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'twenty_q_questions', filter: `couple_id=eq.${couple.id}` },
        (payload) => {
          setQuestions((prev) => {
            const i = prev.findIndex((q) => q.id === payload.new.id)
            if (i === -1) return [...prev, payload.new]
            const next = [...prev]
            next[i] = payload.new
            return next
          })
        }
      )
      .subscribe()

    return () => supabase.removeChannel(channel)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [couple?.id])

  const active = round && !round.solved_at
  const finished = round && round.solved_at
  const isAnswerer = round && round.answerer_id === user.id

  // Whoever wasn't the answerer last round becomes the answerer this round.
  // Once the current round finishes, this flips so a new round is ready to
  // start with roles swapped — no dead end after a reveal.
  const nextAnswererId = lastAnswererId === user.id ? partnerUid : lastAnswererId === partnerUid ? user.id : user.id
  const myTurnToThink = !active && nextAnswererId === user.id

  async function startRound() {
    if (!secretInput.trim()) return
    setBusy(true)
    await supabase.from('twenty_q_rounds').insert({
      couple_id: couple.id,
      answerer_id: user.id,
      secret: secretInput.trim(),
      created_by: user.id,
    })
    setSecretInput('')
    setBusy(false)
  }

  async function askQuestion() {
    if (!questionInput.trim() || questions.length >= MAX_QUESTIONS) return
    setBusy(true)
    await supabase.from('twenty_q_questions').insert({
      round_id: round.id,
      couple_id: couple.id,
      question: questionInput.trim(),
      asked_by: user.id,
    })
    setQuestionInput('')
    setBusy(false)
  }

  async function answerQuestion(questionId, answer) {
    setBusy(true)
    await supabase.from('twenty_q_questions').update({ answer }).eq('id', questionId)
    setBusy(false)
  }

  async function submitGuess() {
    if (!guessInput.trim() || !round) return
    const correct = guessInput.trim().toLowerCase() === round.secret.toLowerCase()
    if (correct) {
      setBusy(true)
      await supabase
        .from('twenty_q_rounds')
        .update({ solved_at: new Date().toISOString(), winning_guess: guessInput.trim() })
        .eq('id', round.id)
      setBusy(false)
    } else {
      setWrongFlash(true)
      setTimeout(() => setWrongFlash(false), 500)
    }
    setGuessInput('')
  }

  async function revealSecret() {
    setBusy(true)
    await supabase.from('twenty_q_rounds').update({ solved_at: new Date().toISOString() }).eq('id', round.id)
    setBusy(false)
  }

  return (
    <>
      <button className="link-btn" onClick={onBack}>
        ← Back to games
      </button>
      <h2>20 Questions</h2>
      <p className="subtitle">One of you thinks of something, the other asks yes/no questions to guess it.</p>

      {finished && (
        <div className="word-result-card win">
          <Confetti />
          <p className="word-result-title">{round.winning_guess ? '🎉 Guessed it!' : 'Revealed!'}</p>
          <p className="word-result-word">
            It was <strong>{round.secret}</strong>
          </p>
        </div>
      )}

      {!active && !myTurnToThink && (
        <div className="game-empty-state">
          <p>Waiting for {partnerName || 'your partner'} to think of something…</p>
        </div>
      )}

      {!active && myTurnToThink && (
        <div className="game-empty-state">
          <p>Think of a person, place, or thing — only you'll see it.</p>
          <input
            type="text"
            value={secretInput}
            onChange={(e) => setSecretInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && startRound()}
            placeholder="e.g. Pizza"
            className="word-input pictionary-guess-input"
          />
          <div style={{ height: 10 }} />
          <button className="primary-btn" onClick={startRound} disabled={busy || !secretInput.trim()}>
            Start round
          </button>
        </div>
      )}

      {active && (
        <>
          <p className={'pictionary-role-banner' + (isAnswerer ? ' drawer' : ' guesser')}>
            {isAnswerer
              ? 'You picked the secret — answer their questions'
              : `Guess what ${partnerName || 'they'} thought of`}
          </p>
          <p className="twentyq-counter">
            {questions.length} of {MAX_QUESTIONS} questions used
          </p>

          <div className="twentyq-list">
            {questions.map((q) => (
              <div key={q.id} className="twentyq-item">
                <p className="twentyq-question">{q.question}</p>
                {q.answer ? (
                  <span className={'twentyq-answer-badge ' + q.answer}>{q.answer}</span>
                ) : isAnswerer ? (
                  <div className="twentyq-answer-buttons">
                    <button onClick={() => answerQuestion(q.id, 'yes')} disabled={busy}>
                      Yes
                    </button>
                    <button onClick={() => answerQuestion(q.id, 'no')} disabled={busy}>
                      No
                    </button>
                    <button onClick={() => answerQuestion(q.id, 'maybe')} disabled={busy}>
                      Maybe
                    </button>
                  </div>
                ) : (
                  <span className="twentyq-answer-badge pending">waiting…</span>
                )}
              </div>
            ))}
          </div>

          {!isAnswerer && (
            <>
              <div className="word-input-row">
                <input
                  type="text"
                  value={questionInput}
                  onChange={(e) => setQuestionInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && askQuestion()}
                  placeholder="Ask a yes/no question"
                  className="word-input pictionary-guess-input"
                  disabled={questions.length >= MAX_QUESTIONS}
                />
                <button
                  className="primary-btn"
                  onClick={askQuestion}
                  disabled={busy || questions.length >= MAX_QUESTIONS}
                >
                  Ask
                </button>
              </div>
              <div className={'word-input-row' + (wrongFlash ? ' shake' : '')}>
                <input
                  type="text"
                  value={guessInput}
                  onChange={(e) => setGuessInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && submitGuess()}
                  placeholder="Or make your final guess"
                  className="word-input pictionary-guess-input"
                />
                <button className="primary-btn" onClick={submitGuess} disabled={busy}>
                  Guess
                </button>
              </div>
            </>
          )}

          {isAnswerer && (
            <button className="link-btn" onClick={revealSecret} disabled={busy}>
              Give up and reveal it
            </button>
          )}
        </>
      )}
    </>
  )
}
