import { useEffect, useState } from 'react'
import { supabase } from '../supabase/config'
import { useAuth } from '../context/AuthContext'
import QUIZ_SETS from '../data/quizSets'

function scoreTier(pct) {
  if (pct === 100) return { text: 'Soulmates! You two are perfectly in sync.' }
  if (pct >= 80) return { text: 'Wow, you really get each other.' }
  if (pct >= 60) return { text: 'Pretty in sync, with a few surprises.' }
  if (pct >= 40) return { text: 'Interesting — you see things differently.' }
  return { text: 'Total opposites. Never a dull moment!' }
}

export default function Quizzes() {
  const { couple, user, partnerUid, partnerName, profile } = useAuth()
  const [allAnswers, setAllAnswers] = useState([])
  const [activeQuiz, setActiveQuiz] = useState(null)
  const [step, setStep] = useState(0)
  const [selections, setSelections] = useState([])
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

  function statusFor(key) {
    const mine = allAnswers.find((r) => r.quiz_key === key && r.user_id === user.id)
    const theirs = allAnswers.find((r) => r.quiz_key === key && r.user_id === partnerUid)
    if (!mine || !theirs) return { mine, theirs, done: false }
    const qs = QUIZ_SETS[key].questions
    let matches = 0
    qs.forEach((_, i) => {
      if (mine.answers[i] === theirs.answers[i]) matches++
    })
    return { mine, theirs, done: true, pct: Math.round((matches / qs.length) * 100) }
  }

  function openQuiz(key) {
    setActiveQuiz(key)
    setStep(0)
    setSelections([])
    setRetaking(false)
  }

  function retake() {
    setStep(0)
    setSelections([])
    setRetaking(true)
  }

  async function submit(finalSelections) {
    await supabase.from('quiz_answers').upsert({
      couple_id: couple.id,
      quiz_key: activeQuiz,
      user_id: user.id,
      user_name: profile?.display_name || 'You',
      answers: finalSelections,
    })
    setRetaking(false)
  }

  function pick(optionIndex) {
    const set = QUIZ_SETS[activeQuiz]
    const next = [...selections]
    next[step] = optionIndex
    setSelections(next)
    if (step < set.questions.length - 1) {
      setTimeout(() => setStep(step + 1), 200)
    } else {
      setTimeout(() => submit(next), 200)
    }
  }

  if (!activeQuiz) {
    const doneStatuses = Object.keys(QUIZ_SETS).map(statusFor).filter((s) => s.done)
    const overallPct = doneStatuses.length
      ? Math.round(doneStatuses.reduce((a, s) => a + s.pct, 0) / doneStatuses.length)
      : null

    return (
      <div className="screen with-nav">
        <h2>Couple Quizzes</h2>
        <p className="subtitle">Pick a topic, answer separately, then see how in sync you are.</p>

        {overallPct !== null && (
          <div className="overall-compat-banner">
            {overallPct}% overall compatibility across {doneStatuses.length}{' '}
            quiz{doneStatuses.length === 1 ? '' : 'zes'}
          </div>
        )}

        <div className="quiz-hub-grid">
          {Object.entries(QUIZ_SETS).map(([key, set]) => {
            const status = statusFor(key)
            return (
              <button key={key} className="quiz-tile" onClick={() => openQuiz(key)}>
                <div className="quiz-tile-title">{set.title}</div>
                <div className="quiz-tile-count">{set.questions.length} questions</div>
                {status.done ? (
                  <div className="quiz-tile-badge done">
                    {status.pct}% match
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
      </div>
    )
  }

  const set = QUIZ_SETS[activeQuiz]
  const status = statusFor(activeQuiz)
  const showResults = status.done && !retaking
  const showWaiting = status.mine && !status.done && !retaking

  return (
    <div className="screen with-nav">
      <button className="link-btn" onClick={() => setActiveQuiz(null)}>
        ← Back to topics
      </button>
      <h2>{set.title}</h2>

      {showResults ? (
        <>
          <div className="quiz-score-card">
            <div className="quiz-score-pct">{status.pct}%</div>
            <div className="quiz-score-label">match</div>
            <p className="quiz-score-text">{scoreTier(status.pct).text}</p>
          </div>

          <div className="quiz-results">
            {set.questions.map((q, i) => {
              const matched = status.mine.answers[i] === status.theirs.answers[i]
              return (
                <div key={i} className="quiz-result-row">
                  <p className={'quiz-question' + (matched ? ' matched' : ' different')}>
                    {q.q}
                  </p>
                  <div className="quiz-answer-pair">
                    <div className="quiz-answer mine">
                      <span className="label">You</span>
                      {q.options[status.mine.answers[i]]}
                    </div>
                    <div className={'quiz-answer theirs' + (matched ? ' matched' : '')}>
                      <span className="label">{partnerName || 'Partner'}</span>
                      {q.options[status.theirs.answers[i]]}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          <button className="link-btn" onClick={retake}>
            Retake this quiz
          </button>
        </>
      ) : showWaiting ? (
        <p className="empty-state">
          You've answered! Waiting for {partnerName || 'your partner'} to finish this one too.
        </p>
      ) : (
        <div className="quiz-taking">
          <div className="quiz-progress-track">
            <div
              className="quiz-progress-fill"
              style={{ width: `${Math.round((step / set.questions.length) * 100)}%` }}
            />
          </div>
          <div className="quiz-progress-label">
            Question {step + 1} of {set.questions.length}
          </div>
          <p className="quiz-taking-question">{set.questions[step].q}</p>
          <div className="quiz-options">
            {set.questions[step].options.map((opt, i) => (
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
      )}
    </div>
  )
}
