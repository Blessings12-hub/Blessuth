import { useEffect, useState } from 'react'
import { supabase } from '../supabase/config'
import { useAuth } from '../context/AuthContext'
import QUIZ_TOPICS from '../data/quizSets'

function scoreTier(pct) {
  if (pct === 100) return 'Perfect — you know them completely.'
  if (pct >= 80) return "You really know them. Impressive."
  if (pct >= 60) return 'Pretty good instincts, with a few surprises.'
  if (pct >= 40) return "Some solid guesses, some real surprises."
  return "Lots to learn about each other — that's the fun part."
}

function fillPartner(text, partnerName) {
  return text.replace(/\{partner\}/g, partnerName || 'your partner')
}

// Animates a number counting up from 0 to `value` over roughly `duration` ms.
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

// quiz_key format: "<topicKey>.<subtopicKey>" — keeps every subtopic
// independently answerable/retakeable under the existing (couple_id,
// quiz_key, user_id) primary key.
function quizKey(topicKey, subtopicKey) {
  return `${topicKey}.${subtopicKey}`
}

export default function Quizzes() {
  const { couple, user, partnerUid, partnerName, profile } = useAuth()
  const [allAnswers, setAllAnswers] = useState([])
  const [activeTopic, setActiveTopic] = useState(null)
  const [activeSubtopic, setActiveSubtopic] = useState(null)
  const [round, setRound] = useState('self') // 'self' | 'guess'
  const [step, setStep] = useState(0)
  const [selfSelections, setSelfSelections] = useState([])
  const [guessSelections, setGuessSelections] = useState([])
  const [retaking, setRetaking] = useState(false)

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

  // A submission only counts as "done" once it has both a self-answer and a
  // guess for every question — a row saved before this guessing mechanic
  // existed only has `answers`, so it's treated as not-yet-done rather than
  // shown as a broken/incomplete result.
  function statusFor(topicKey, subtopicKey) {
    const key = quizKey(topicKey, subtopicKey)
    const qCount = QUIZ_TOPICS[topicKey].subtopics[subtopicKey].questions.length
    const mine = allAnswers.find((r) => r.quiz_key === key && r.user_id === user.id)
    const theirs = allAnswers.find((r) => r.quiz_key === key && r.user_id === partnerUid)
    const complete = (r) => r && r.answers?.length === qCount && r.guesses?.length === qCount
    if (!complete(mine) || !complete(theirs)) {
      return { mine, theirs, done: false }
    }
    const qs = QUIZ_TOPICS[topicKey].subtopics[subtopicKey].questions
    let myGuessCorrect = 0
    let theirGuessCorrect = 0
    let inSync = 0
    qs.forEach((_, i) => {
      if (mine.guesses[i] === theirs.answers[i]) myGuessCorrect++
      if (theirs.guesses[i] === mine.answers[i]) theirGuessCorrect++
      if (mine.answers[i] === theirs.answers[i]) inSync++
    })
    // Battle mode: whoever guessed more of the other's real answers correctly
    // wins this round. The round's timestamp (for streak ordering) is
    // whichever of the two submissions landed last.
    const winner = myGuessCorrect === theirGuessCorrect ? 'tie' : myGuessCorrect > theirGuessCorrect ? 'me' : 'partner'
    const roundAt = [mine.updated_at, theirs.updated_at].filter(Boolean).sort().slice(-1)[0] || null
    return {
      mine,
      theirs,
      done: true,
      myGuessPct: Math.round((myGuessCorrect / qs.length) * 100),
      theirGuessPct: Math.round((theirGuessCorrect / qs.length) * 100),
      inSyncPct: Math.round((inSync / qs.length) * 100),
      myGuessCorrect,
      theirGuessCorrect,
      winner,
      roundAt,
    }
  }

  // Aggregates every completed subtopic into a running head-to-head score:
  // points are total correct guesses, rounds are won/lost/tied per subtopic,
  // and streak tracks consecutive round wins by the same person, most
  // recent first (ties don't break a streak, they just don't extend it).
  function computeBattle() {
    let myPoints = 0
    let theirPoints = 0
    let myWins = 0
    let theirWins = 0
    let ties = 0
    const rounds = []
    Object.entries(QUIZ_TOPICS).forEach(([tk, t]) => {
      Object.keys(t.subtopics).forEach((sk) => {
        const s = statusFor(tk, sk)
        if (!s.done) return
        myPoints += s.myGuessCorrect
        theirPoints += s.theirGuessCorrect
        if (s.winner === 'me') myWins++
        else if (s.winner === 'partner') theirWins++
        else ties++
        rounds.push({ winner: s.winner, at: s.roundAt || '' })
      })
    })
    rounds.sort((a, b) => a.at.localeCompare(b.at))
    let streakWinner = null
    let streakCount = 0
    for (let i = rounds.length - 1; i >= 0; i--) {
      const w = rounds[i].winner
      if (w === 'tie') continue
      if (streakWinner === null) {
        streakWinner = w
        streakCount = 1
      } else if (w === streakWinner) {
        streakCount++
      } else {
        break
      }
    }
    return {
      myPoints,
      theirPoints,
      myWins,
      theirWins,
      ties,
      streakWinner,
      streakCount,
      totalRounds: myWins + theirWins + ties,
    }
  }

  function openSubtopic(topicKey, subtopicKey) {
    setActiveTopic(topicKey)
    setActiveSubtopic(subtopicKey)
    setRound('self')
    setStep(0)
    setSelfSelections([])
    setGuessSelections([])
    setRetaking(false)
  }

  function retake() {
    setRound('self')
    setStep(0)
    setSelfSelections([])
    setGuessSelections([])
    setRetaking(true)
  }

  async function submit(finalAnswers, finalGuesses) {
    await supabase.from('quiz_answers').upsert({
      couple_id: couple.id,
      quiz_key: quizKey(activeTopic, activeSubtopic),
      user_id: user.id,
      user_name: profile?.display_name || 'You',
      answers: finalAnswers,
      guesses: finalGuesses,
      updated_at: new Date().toISOString(),
    })
    setRetaking(false)
  }

  function pick(optionIndex) {
    const questions = QUIZ_TOPICS[activeTopic].subtopics[activeSubtopic].questions
    const lastStep = step === questions.length - 1

    if (round === 'self') {
      const next = [...selfSelections]
      next[step] = optionIndex
      setSelfSelections(next)
      setTimeout(() => {
        if (lastStep) {
          setRound('guess')
          setStep(0)
        } else {
          setStep(step + 1)
        }
      }, 220)
    } else {
      const next = [...guessSelections]
      next[step] = optionIndex
      setGuessSelections(next)
      if (lastStep) {
        setTimeout(() => submit(selfSelections, next), 220)
      } else {
        setTimeout(() => setStep(step + 1), 220)
      }
    }
  }

  // ---------- Hub: list of topics ----------
  if (!activeTopic) {
    let doneCount = 0
    let totalSubtopics = 0
    let syncSum = 0
    Object.entries(QUIZ_TOPICS).forEach(([tk, t]) => {
      Object.keys(t.subtopics).forEach((sk) => {
        totalSubtopics++
        const s = statusFor(tk, sk)
        if (s.done) {
          doneCount++
          syncSum += s.inSyncPct
        }
      })
    })
    const overallPct = doneCount ? Math.round(syncSum / doneCount) : null
    const battle = computeBattle()

    return (
      <>
        <p className="subtitle">
          Answer for yourself, then guess {partnerName || 'your partner'}'s answer — find out how well you really
          know each other.
        </p>

        {battle.totalRounds > 0 && (
          <div className="battle-scoreboard">
            <div className="battle-score-row">
              <div className={'battle-side' + (battle.myPoints > battle.theirPoints ? ' ahead' : '')}>
                <div className="battle-score-num">{battle.myPoints}</div>
                <div className="battle-score-label">You</div>
              </div>
              <div className="battle-vs">VS</div>
              <div className={'battle-side' + (battle.theirPoints > battle.myPoints ? ' ahead' : '')}>
                <div className="battle-score-num">{battle.theirPoints}</div>
                <div className="battle-score-label">{partnerName || 'Partner'}</div>
              </div>
            </div>
            <p className="battle-summary">
              {battle.myWins}–{battle.theirWins}–{battle.ties} rounds (win–loss–tie) · {overallPct}% in sync overall
            </p>
            {battle.streakCount >= 2 && (
              <p className="battle-streak">
                🔥 {battle.streakWinner === 'me' ? 'You' : partnerName || 'Partner'}{' '}
                {battle.streakWinner === 'me' ? 'are' : 'is'} on a {battle.streakCount}-round win streak
              </p>
            )}
          </div>
        )}

        <div className="quiz-hub-grid">
          {Object.entries(QUIZ_TOPICS).map(([topicKey, topic], i) => {
            const subtopicKeys = Object.keys(topic.subtopics)
            const doneHere = subtopicKeys.filter((sk) => statusFor(topicKey, sk).done).length
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
                {doneHere === subtopicKeys.length ? (
                  <div className="quiz-tile-badge done">All done</div>
                ) : doneHere > 0 ? (
                  <div className="quiz-tile-badge waiting">
                    {doneHere}/{subtopicKeys.length} done
                  </div>
                ) : (
                  <div className="quiz-tile-badge new">Not started</div>
                )}
              </button>
            )
          })}
        </div>
      </>
    )
  }

  // ---------- Topic: list of subtopics ----------
  if (!activeSubtopic) {
    const topic = QUIZ_TOPICS[activeTopic]
    return (
      <>
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
                {status.done ? (
                  <div
                    className={
                      'quiz-tile-badge done' +
                      (status.winner === 'me' ? ' won' : status.winner === 'partner' ? ' lost' : '')
                    }
                  >
                    {status.winner === 'me'
                      ? `🏆 You won · ${status.myGuessPct}%`
                      : status.winner === 'partner'
                        ? `${partnerName || 'Partner'} won · ${status.myGuessPct}%`
                        : `🤝 Tied · ${status.myGuessPct}%`}
                  </div>
                ) : status.mine ? (
                  <div className="quiz-tile-badge waiting">Waiting for {partnerName || 'partner'}</div>
                ) : (
                  <div className="quiz-tile-badge new">Not started</div>
                )}
              </button>
            )
          })}
        </div>
      </>
    )
  }

  // ---------- Subtopic: taking / waiting / results ----------
  const topic = QUIZ_TOPICS[activeTopic]
  const subtopic = topic.subtopics[activeSubtopic]
  const status = statusFor(activeTopic, activeSubtopic)
  const showResults = status.done && !retaking
  const showWaiting = status.mine?.answers?.length === subtopic.questions.length && !status.done && !retaking

  return (
    <>
      <button
        className="link-btn"
        onClick={() => {
          setActiveSubtopic(null)
        }}
      >
        ← Back to {topic.title}
      </button>
      <h2>{subtopic.title}</h2>

      {showResults ? (
        <QuizResults set={subtopic} status={status} partnerName={partnerName} onRetake={retake} />
      ) : showWaiting ? (
        <p className="empty-state">
          You've answered and guessed! Waiting for {partnerName || 'your partner'} to finish this one too.
        </p>
      ) : (
        <div className="quiz-taking">
          <div className="quiz-round-label">
            {round === 'self' ? 'Round 1 · About you' : `Round 2 · Guessing ${partnerName || 'your partner'}`}
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
          <div key={`${round}-${step}`} className="quiz-question-enter">
            <p className="quiz-taking-question">
              {round === 'self'
                ? subtopic.questions[step][0]
                : fillPartner(subtopic.questions[step][1], partnerName)}
            </p>
            <div className="quiz-options">
              {subtopic.questions[step][2].map((opt, i) => (
                <button
                  key={i}
                  className={
                    'quiz-option' +
                    ((round === 'self' ? selfSelections[step] : guessSelections[step]) === i ? ' selected' : '')
                  }
                  onClick={() => pick(i)}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function QuizResults({ set, status, partnerName, onRetake }) {
  const displayMine = useCountUp(status.myGuessPct)
  const displayTheirs = useCountUp(status.theirGuessPct)

  return (
    <>
      <div className="quiz-score-card">
        {(status.winner === 'me' || (status.myGuessPct === 100 && status.theirGuessPct === 100)) && <Confetti />}
        <div className={'round-result-banner ' + status.winner}>
          {status.winner === 'me' && `🏆 You won this round! ${status.myGuessCorrect}–${status.theirGuessCorrect}`}
          {status.winner === 'partner' &&
            `${partnerName || 'They'} won this round ${status.theirGuessCorrect}–${status.myGuessCorrect}`}
          {status.winner === 'tie' && `🤝 Tied this round, ${status.myGuessCorrect}–${status.theirGuessCorrect}`}
        </div>
        <div className="quiz-score-dual">
          <div>
            <div className="quiz-score-pct">{displayMine}%</div>
            <div className="quiz-score-label">you knew {partnerName || 'them'}</div>
          </div>
          <div>
            <div className="quiz-score-pct">{displayTheirs}%</div>
            <div className="quiz-score-label">{partnerName || 'they'} knew you</div>
          </div>
        </div>
        <p className="quiz-score-text">{scoreTier(status.myGuessPct)}</p>
        <p className="quiz-score-subtext">Also {status.inSyncPct}% in sync on your own answers.</p>
      </div>

      <div className="quiz-results">
        {set.questions.map(([selfQ, , options], i) => {
          const myAnswer = status.mine.answers[i]
          const theirAnswer = status.theirs.answers[i]
          const myGuessRight = status.mine.guesses[i] === theirAnswer
          const theirGuessRight = status.theirs.guesses[i] === myAnswer
          return (
            <div key={i} className="quiz-result-row quiz-result-enter" style={{ animationDelay: `${i * 0.06}s` }}>
              <p className="quiz-question">{selfQ}</p>
              <div className="quiz-answer-pair">
                <div className="quiz-answer mine">
                  <span className="label">You answered</span>
                  {options[myAnswer]}
                </div>
                <div className={'quiz-answer theirs' + (theirGuessRight ? ' matched' : '')}>
                  <span className="label">{partnerName || 'Partner'} guessed</span>
                  {options[status.theirs.guesses[i]]} {theirGuessRight ? '✓' : '✗'}
                </div>
              </div>
              <div className="quiz-answer-pair">
                <div className="quiz-answer theirs">
                  <span className="label">{partnerName || 'Partner'} answered</span>
                  {options[theirAnswer]}
                </div>
                <div className={'quiz-answer mine' + (myGuessRight ? ' matched' : '')}>
                  <span className="label">You guessed</span>
                  {options[status.mine.guesses[i]]} {myGuessRight ? '✓' : '✗'}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <button className="link-btn" onClick={onRetake}>
        Retake this quiz
      </button>
    </>
  )
}
