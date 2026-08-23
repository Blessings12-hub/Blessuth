import { useEffect, useState } from 'react'
import { supabase } from '../supabase/config'
import { useAuth } from '../context/AuthContext'
import QUIZ_TOPICS from '../data/quizSets'

function scoreTier(pct) {
  if (pct === 100) return 'Perfect — you know them completely.'
  if (pct >= 80) return 'You really know them. Impressive.'
  if (pct >= 60) return 'Pretty good instincts, with a few surprises.'
  if (pct >= 40) return 'Some solid guesses, some real surprises.'
  return "Lots to learn about each other — that's the fun part."
}

function fillPartner(text, partnerName) {
  return text.replace(/\{partner\}/g, partnerName || 'your partner')
}

function useCountUp(value, duration = 700) {
  const [display, setDisplay] = useState(0)
  useEffect(() => {
    if (value == null) return
    let start = null
    let frame
    function tick(ts) {
      if (start === null) start = ts
      const progress = Math.min((ts - start) / duration, 1)
      setDisplay(Math.round(progress * value))
      if (progress < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [value, duration])
  return display
}

function Confetti() {
  const pieces = Array.from({ length: 18 })
  return (
    <div className="confetti-burst" aria-hidden="true">
      {pieces.map((_, i) => (
        <span
          key={i}
          className="confetti-piece"
          style={{
            left: `${(i / pieces.length) * 100}%`,
            animationDelay: `${(i % 6) * 0.08}s`,
            background: ['var(--sunset)', 'var(--gold)', 'var(--teal)'][i % 3],
          }}
        />
      ))}
    </div>
  )
}

function quizKey(topicKey, subtopicKey) {
  return `${topicKey}.${subtopicKey}`
}

export default function Quizzes() {
  const { couple, user, partnerUid, partnerName, profile } = useAuth()
  const [allAnswers, setAllAnswers] = useState([])
  const [activeTopic, setActiveTopic] = useState(null)
  const [activeSubtopic, setActiveSubtopic] = useState(null)
  const [mode, setMode] = useState(null) // null | 'guess' | 'self'
  const [step, setStep] = useState(0)
  const [selections, setSelections] = useState([])

  async function loadAll() {
    if (!couple) return
    const { data } = await supabase.from('quiz_answers').select('*').eq('couple_id', couple.id)
    setAllAnswers(data || [])
  }

  useEffect(() => {
    if (!couple) return
    loadAll()
    const channel = supabase
      .channel(`quizzes-${couple.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'quiz_answers', filter: `couple_id=eq.${couple.id}` },
        loadAll
      )
      .subscribe()
    return () => supabase.removeChannel(channel)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [couple?.id])

  // Each direction (my guess-score, their guess-score, in-sync %) is
  // computable independently — I don't need to have answered for myself to
  // see how well I know them, and they don't need to have guessed yet for
  // me to see my own score. That's what lets this be fully asynchronous:
  // whoever gets to a subtopic first can still make progress.
  function statusFor(topicKey, subtopicKey) {
    const key = quizKey(topicKey, subtopicKey)
    const qs = QUIZ_TOPICS[topicKey].subtopics[subtopicKey].questions
    const qCount = qs.length
    const mine = allAnswers.find((r) => r.quiz_key === key && r.user_id === user.id)
    const theirs = allAnswers.find((r) => r.quiz_key === key && r.user_id === partnerUid)
    const complete = (arr) => Array.isArray(arr) && arr.length === qCount

    const myAnswersDone = complete(mine?.answers)
    const myGuessesDone = complete(mine?.guesses)
    const theirAnswersDone = complete(theirs?.answers)
    const theirGuessesDone = complete(theirs?.guesses)

    let myScore = null
    if (myGuessesDone && theirAnswersDone) {
      let correct = 0
      qs.forEach((_, i) => {
        if (mine.guesses[i] === theirs.answers[i]) correct++
      })
      myScore = Math.round((correct / qCount) * 100)
    }

    let theirScore = null
    if (theirGuessesDone && myAnswersDone) {
      let correct = 0
      qs.forEach((_, i) => {
        if (theirs.guesses[i] === mine.answers[i]) correct++
      })
      theirScore = Math.round((correct / qCount) * 100)
    }

    let inSyncPct = null
    if (myAnswersDone && theirAnswersDone) {
      let same = 0
      qs.forEach((_, i) => {
        if (mine.answers[i] === theirs.answers[i]) same++
      })
      inSyncPct = Math.round((same / qCount) * 100)
    }

    return { mine, theirs, myAnswersDone, myGuessesDone, theirAnswersDone, theirGuessesDone, myScore, theirScore, inSyncPct }
  }

  function openSubtopic(topicKey, subtopicKey) {
    setActiveTopic(topicKey)
    setActiveSubtopic(subtopicKey)
    setMode(null)
    setStep(0)
    setSelections([])
  }

  function startGuessing() {
    setMode('guess')
    setStep(0)
    setSelections([])
  }

  function startSelfAnswering() {
    setMode('self')
    setStep(0)
    setSelections([])
  }

  async function submitGuesses(finalGuesses) {
    const status = statusFor(activeTopic, activeSubtopic)
    await supabase.from('quiz_answers').upsert({
      couple_id: couple.id,
      quiz_key: quizKey(activeTopic, activeSubtopic),
      user_id: user.id,
      user_name: profile?.display_name || 'You',
      answers: status.mine?.answers || [],
      guesses: finalGuesses,
    })
    setMode(null)
  }

  async function submitSelfAnswers(finalAnswers) {
    const status = statusFor(activeTopic, activeSubtopic)
    await supabase.from('quiz_answers').upsert({
      couple_id: couple.id,
      quiz_key: quizKey(activeTopic, activeSubtopic),
      user_id: user.id,
      user_name: profile?.display_name || 'You',
      answers: finalAnswers,
      guesses: status.mine?.guesses || [],
    })
    setMode(null)
  }

  function pick(optionIndex) {
    const questions = QUIZ_TOPICS[activeTopic].subtopics[activeSubtopic].questions
    const lastStep = step === questions.length - 1
    const next = [...selections]
    next[step] = optionIndex
    setSelections(next)
    setTimeout(() => {
      if (lastStep) {
        if (mode === 'guess') submitGuesses(next)
        else submitSelfAnswers(next)
      } else {
        setStep(step + 1)
      }
    }, 220)
  }

  // ---------- Hub: list of topics ----------
  if (!activeTopic) {
    let doneCount = 0
    let totalSubtopics = 0
    let scoreSum = 0
    const readyToGuess = []
    Object.entries(QUIZ_TOPICS).forEach(([tk, t]) => {
      Object.entries(t.subtopics).forEach(([sk, sub]) => {
        totalSubtopics++
        const s = statusFor(tk, sk)
        if (s.myScore !== null) {
          doneCount++
          scoreSum += s.myScore
        } else if (s.theirAnswersDone) {
          readyToGuess.push({ tk, sk, title: `${t.title} · ${sub.title}` })
        }
      })
    })
    const overallPct = doneCount ? Math.round(scoreSum / doneCount) : null

    return (
      <div className="screen with-nav">
        <h2>Couple Quizzes</h2>
        <p className="subtitle">Guess {partnerName || 'your partner'}'s answers — find out how well you really know them.</p>

        {overallPct !== null && (
          <div className="overall-compat-banner">
            {doneCount} of {totalSubtopics} guessed · you know {partnerName || 'them'} {overallPct}% overall
          </div>
        )}

        {readyToGuess.length > 0 && (
          <div className="quiz-ready-banner">
            <div className="quiz-ready-title">
              🎯 {partnerName || 'Your partner'} has answered {readyToGuess.length === 1 ? 'this' : 'these'} — ready
              for you to guess:
            </div>
            <div className="quiz-ready-list">
              {readyToGuess.map(({ tk, sk, title }) => (
                <button key={`${tk}.${sk}`} className="quiz-ready-chip" onClick={() => openSubtopic(tk, sk)}>
                  {title}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="quiz-hub-grid">
          {Object.entries(QUIZ_TOPICS).map(([topicKey, topic], i) => {
            const subtopicKeys = Object.keys(topic.subtopics)
            const guessedHere = subtopicKeys.filter((sk) => statusFor(topicKey, sk).myScore !== null).length
            const readyHere = subtopicKeys.filter((sk) => {
              const s = statusFor(topicKey, sk)
              return s.myScore === null && s.theirAnswersDone
            }).length
            const questionCount = subtopicKeys.reduce((n, sk) => n + topic.subtopics[sk].questions.length, 0)
            return (
              <button
                key={topicKey}
                className="quiz-tile quiz-tile-enter"
                style={{ animationDelay: `${i * 0.04}s` }}
                onClick={() => setActiveTopic(topicKey)}
              >
                <div className="quiz-tile-title">{topic.title}</div>
                <div className="quiz-tile-count">
                  {subtopicKeys.length} subtopics · {questionCount} questions
                </div>
                {readyHere > 0 ? (
                  <div className="quiz-tile-badge new">🎯 {readyHere} ready to guess</div>
                ) : guessedHere === subtopicKeys.length ? (
                  <div className="quiz-tile-badge done">All guessed</div>
                ) : guessedHere > 0 ? (
                  <div className="quiz-tile-badge waiting">
                    {guessedHere}/{subtopicKeys.length} guessed
                  </div>
                ) : (
                  <div className="quiz-tile-badge new">Not started</div>
                )}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  // ---------- Topic: list of subtopics ----------
  if (!activeSubtopic) {
    const topic = QUIZ_TOPICS[activeTopic]
    return (
      <div className="screen with-nav">
        <button className="link-btn" onClick={() => setActiveTopic(null)}>
          ← Back to topics
        </button>
        <h2>{topic.title}</h2>
        <p className="subtitle">Pick a subtopic to start.</p>

        <div className="quiz-hub-grid">
          {Object.entries(topic.subtopics).map(([subtopicKey, subtopic], i) => {
            const status = statusFor(activeTopic, subtopicKey)
            return (
              <button
                key={subtopicKey}
                className="quiz-tile quiz-tile-enter"
                style={{ animationDelay: `${i * 0.04}s` }}
                onClick={() => openSubtopic(activeTopic, subtopicKey)}
              >
                <div className="quiz-tile-title">{subtopic.title}</div>
                <div className="quiz-tile-count">{subtopic.questions.length} questions</div>
                {status.myScore !== null ? (
                  <div className="quiz-tile-badge done">{status.myScore}% you guessed right</div>
                ) : status.theirAnswersDone ? (
                  <div className="quiz-tile-badge new">🎯 Ready to guess</div>
                ) : status.myAnswersDone ? (
                  <div className="quiz-tile-badge waiting">Waiting for {partnerName || 'partner'}</div>
                ) : (
                  <div className="quiz-tile-badge new">Not started</div>
                )}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  // ---------- Subtopic ----------
  const topic = QUIZ_TOPICS[activeTopic]
  const subtopic = topic.subtopics[activeSubtopic]
  const status = statusFor(activeTopic, activeSubtopic)

  return (
    <div className="screen with-nav">
      <button
        className="link-btn"
        onClick={() => {
          if (mode) setMode(null)
          else setActiveSubtopic(null)
        }}
      >
        ← Back {mode ? `to ${subtopic.title}` : `to ${topic.title}`}
      </button>
      <h2>{subtopic.title}</h2>

      {!mode && (
        <>
          <div className="quiz-action-grid">
            <button
              className="quiz-action-card"
              disabled={!status.theirAnswersDone}
              onClick={status.theirAnswersDone ? startGuessing : undefined}
            >
              <div className="quiz-action-title">Guess {partnerName || 'them'}</div>
              {status.myScore !== null ? (
                <div className="quiz-action-status done">✓ You knew them: {status.myScore}%</div>
              ) : status.theirAnswersDone ? (
                <div className="quiz-action-status ready">Ready — tap to guess</div>
              ) : (
                <div className="quiz-action-status locked">
                  Waiting for {partnerName || 'them'} to answer these first
                </div>
              )}
            </button>

            <button className="quiz-action-card secondary" onClick={startSelfAnswering}>
              <div className="quiz-action-title">Answer for yourself</div>
              {status.myAnswersDone ? (
                <div className="quiz-action-status done">
                  ✓ Answered{status.theirScore !== null ? ` — they knew you: ${status.theirScore}%` : ''}
                </div>
              ) : (
                <div className="quiz-action-status ready">So {partnerName || 'they'} can guess these</div>
              )}
            </button>
          </div>

          {status.myScore !== null && (
            <>
              <div className="quiz-score-card">
                {status.myScore === 100 && <Confetti />}
                <div className="quiz-score-pct">{useCountUp(status.myScore)}%</div>
                <div className="quiz-score-label">you knew {partnerName || 'them'}</div>
                <p className="quiz-score-text">{scoreTier(status.myScore)}</p>
                {status.inSyncPct !== null && (
                  <p className="quiz-score-subtext">Also {status.inSyncPct}% in sync on your own answers.</p>
                )}
              </div>

              <div className="quiz-results">
                {subtopic.questions.map(([, guessQ, options], i) => {
                  const theirAnswer = status.theirs.answers[i]
                  const myGuess = status.mine.guesses[i]
                  const right = myGuess === theirAnswer
                  return (
                    <div key={i} className="quiz-result-row quiz-result-enter" style={{ animationDelay: `${i * 0.06}s` }}>
                      <p className="quiz-question">{fillPartner(guessQ, partnerName)}</p>
                      <div className="quiz-answer-pair">
                        <div className="quiz-answer theirs">
                          <span className="label">{partnerName || 'Partner'} answered</span>
                          {options[theirAnswer]}
                        </div>
                        <div className={'quiz-answer mine' + (right ? ' matched' : '')}>
                          <span className="label">You guessed</span>
                          {options[myGuess]} {right ? '✓' : '✗'}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              <button className="link-btn" onClick={startGuessing}>
                Retake this quiz
              </button>
            </>
          )}
        </>
      )}

      {mode && (
        <div className="quiz-taking">
          <div className="quiz-round-label">
            {mode === 'guess' ? `Guessing ${partnerName || 'your partner'}` : 'Your own answers'}
          </div>
          <div className="quiz-progress-track">
            <div
              className="quiz-progress-fill"
              style={{ width: `${Math.round((step / subtopic.questions.length) * 100)}%` }}
            />
          </div>
          <div className="quiz-progress-label">
            Question {step + 1} of {subtopic.questions.length}
          </div>
          <div key={step} className="quiz-question-enter">
            <p className="quiz-taking-question">
              {mode === 'guess'
                ? fillPartner(subtopic.questions[step][1], partnerName)
                : subtopic.questions[step][0]}
            </p>
            <div className="quiz-options">
              {subtopic.questions[step][2].map((opt, i) => (
                <button
                  key={i}
                  className={'quiz-option' + (selections[step] === i ? ' selected' : '')}
                  onClick={() => pick(i)}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
