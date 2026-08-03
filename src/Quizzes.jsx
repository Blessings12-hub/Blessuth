import { useEffect, useState } from 'react'
import { supabase } from '../supabase/config'
import { useAuth } from '../context/AuthContext'

const QUIZ_SETS = {
  classic: {
    title: 'How well do you know each other?',
    questions: [
      "What's my favorite food?",
      "What's my biggest pet peeve?",
      'Where would I want to go on vacation?',
      "What's my go-to comfort show or movie?",
      'What am I most proud of?',
    ],
  },
  future: {
    title: 'Future dreams',
    questions: [
      'Where do you picture us living in 5 years?',
      "What's one thing you want us to try together?",
      'What does an ideal weekend together look like?',
      'What are you most excited for in our future?',
    ],
  },
  thisorthat: {
    title: 'This or that',
    questions: [
      'Beach or mountains?',
      'Morning person or night owl?',
      'Cook at home or eat out?',
      'Early bird trips or spontaneous plans?',
      'Texting or calling?',
    ],
  },
}

export default function Quizzes() {
  const { couple, user, partnerUid, partnerName, profile } = useAuth()
  const [activeQuiz, setActiveQuiz] = useState(null)
  const [answers, setAnswers] = useState({})
  const [myAnswers, setMyAnswers] = useState([])
  const [partnerAnswers, setPartnerAnswers] = useState(null)

  async function loadAnswers() {
    const { data } = await supabase
      .from('quiz_answers')
      .select('*')
      .eq('couple_id', couple.id)
      .eq('quiz_key', activeQuiz)
    const mine = data?.find((r) => r.user_id === user.id)
    const theirs = data?.find((r) => r.user_id === partnerUid)
    setMyAnswers(mine?.answers || [])
    setPartnerAnswers(theirs?.answers || null)
  }

  useEffect(() => {
    if (!couple || !activeQuiz) return
    loadAnswers()
    const channel = supabase
      .channel(`quiz-${couple.id}-${activeQuiz}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'quiz_answers',
          filter: `couple_id=eq.${couple.id}`,
        },
        loadAnswers
      )
      .subscribe()
    return () => supabase.removeChannel(channel)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [couple?.id, activeQuiz, partnerUid])

  function openQuiz(key) {
    setActiveQuiz(key)
    setAnswers({})
  }

  async function submit(e) {
    e.preventDefault()
    const set = QUIZ_SETS[activeQuiz]
    const list = set.questions.map((_, i) => answers[i] || '')
    await supabase.from('quiz_answers').upsert({
      couple_id: couple.id,
      quiz_key: activeQuiz,
      user_id: user.id,
      user_name: profile?.display_name || 'You',
      answers: list,
    })
  }

  if (!activeQuiz) {
    return (
      <div className="screen with-nav">
        <h2>💭 Couple Quizzes</h2>
        <p className="subtitle">Answer separately, then compare your answers.</p>
        <div className="tile-grid">
          {Object.entries(QUIZ_SETS).map(([key, set]) => (
            <button key={key} className="tile" onClick={() => openQuiz(key)}>
              <div className="tile-icon">💭</div>
              <div className="tile-label">{set.title}</div>
              <div className="tile-desc">{set.questions.length} questions</div>
            </button>
          ))}
        </div>
      </div>
    )
  }

  const set = QUIZ_SETS[activeQuiz]
  const iAnswered = myAnswers.length > 0
  const bothAnswered = iAnswered && partnerAnswers && partnerAnswers.length > 0

  return (
    <div className="screen with-nav">
      <button className="link-btn" onClick={() => setActiveQuiz(null)}>
        ← Back
      </button>
      <h2>{set.title}</h2>

      {bothAnswered ? (
        <div className="quiz-results">
          {set.questions.map((q, i) => (
            <div key={i} className="quiz-result-row">
              <p className="quiz-question">{q}</p>
              <div className="quiz-answer-pair">
                <div className="quiz-answer mine">
                  <span className="label">You</span>
                  {myAnswers[i] || '—'}
                </div>
                <div className="quiz-answer theirs">
                  <span className="label">{partnerName || 'Partner'}</span>
                  {partnerAnswers[i] || '—'}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : iAnswered ? (
        <p className="empty-state">
          You've answered! Waiting for {partnerName || 'your partner'} to finish too. 💌
        </p>
      ) : (
        <form onSubmit={submit} className="quiz-form">
          {set.questions.map((q, i) => (
            <div key={i} className="quiz-input-row">
              <label>{q}</label>
              <input
                type="text"
                value={answers[i] || ''}
                onChange={(e) => setAnswers({ ...answers, [i]: e.target.value })}
                required
              />
            </div>
          ))}
          <button type="submit">Submit answers</button>
        </form>
      )}
    </div>
  )
}
