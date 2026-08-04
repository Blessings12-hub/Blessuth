import { useEffect, useState } from 'react'
import { supabase } from '../supabase/config'
import { useAuth } from '../context/AuthContext'
import { todaysQuestion, todayKey } from '../data/dailyQuestions'

export default function DailyQuestion() {
  const { couple, user, partnerName } = useAuth()
  const question = todaysQuestion()
  const dateKey = todayKey()
  const [mine, setMine] = useState(null)
  const [theirs, setTheirs] = useState(null)
  const [answer, setAnswer] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    if (!couple) return
    const { data } = await supabase
      .from('daily_answers')
      .select('*')
      .eq('couple_id', couple.id)
      .eq('answer_date', dateKey)
    setMine(data?.find((r) => r.user_id === user.id) || null)
    setTheirs(data?.find((r) => r.user_id !== user.id) || null)
  }

  useEffect(() => {
    if (!couple) return
    load()
    const channel = supabase
      .channel(`daily-${couple.id}-${dateKey}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'daily_answers', filter: `couple_id=eq.${couple.id}` },
        load
      )
      .subscribe()
    return () => supabase.removeChannel(channel)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [couple?.id, dateKey])

  async function submit(e) {
    e.preventDefault()
    if (!answer.trim()) return
    setSubmitting(true)
    setError('')
    const { error: err } = await supabase.rpc('record_daily_answer', {
      p_couple_id: couple.id,
      p_date: dateKey,
      p_answer: answer.trim(),
    })
    setSubmitting(false)
    if (err) setError(err.message)
  }

  const bothAnswered = mine && theirs

  return (
    <div className="daily-card">
      <div className="daily-header">
        <span className="daily-tag">✨ Today's question</span>
        {couple?.streak_count > 0 && <span className="streak-badge">🔥 {couple.streak_count}</span>}
      </div>
      <p className="daily-question">{question}</p>

      {bothAnswered ? (
        <div className="daily-answers">
          <div className="daily-answer mine">
            <span className="label">You</span>
            {mine.answer}
          </div>
          <div className="daily-answer theirs">
            <span className="label">{partnerName || 'Partner'}</span>
            {theirs.answer}
          </div>
        </div>
      ) : mine ? (
        <p className="daily-waiting">
          Answered ✓ — waiting for {partnerName || 'your partner'} to answer too…
        </p>
      ) : (
        <form onSubmit={submit} className="daily-form">
          <input
            type="text"
            placeholder="Your answer…"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            required
          />
          <button type="submit" disabled={submitting}>
            {submitting ? '…' : 'Answer'}
          </button>
        </form>
      )}
      {error && <p className="error">{error}</p>}
    </div>
  )
}
