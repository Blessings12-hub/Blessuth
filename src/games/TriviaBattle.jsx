import { useMemo, useState } from 'react'

const QUESTIONS = [
  { prompt: 'Which book opens the New Testament?', options: ['Matthew', 'Genesis', 'Psalms', 'Acts'], answer: 0 },
  { prompt: 'How many days did creation take before the day of rest?', options: ['5', '6', '7', '40'], answer: 1 },
  { prompt: 'Who built the ark?', options: ['Moses', 'David', 'Noah', 'Abraham'], answer: 2 },
  { prompt: 'Which fruit of the Spirit means choosing peace over conflict?', options: ['Patience', 'Joy', 'Kindness', 'Peace'], answer: 3 },
  { prompt: 'What did Jesus use to feed the five thousand?', options: ['Five loaves and two fish', 'Manna', 'Grapes and wheat', 'Seven baskets'], answer: 0 },
  { prompt: 'Which Psalm begins “The Lord is my shepherd”?', options: ['Psalm 1', 'Psalm 23', 'Psalm 91', 'Psalm 119'], answer: 1 },
]

export default function TriviaBattle({ onBack }) {
  const questions = useMemo(() => [...QUESTIONS].sort(() => Math.random() - 0.5), [])
  const [step, setStep] = useState(0)
  const [score, setScore] = useState(0)
  const [selected, setSelected] = useState(null)
  const [finished, setFinished] = useState(false)

  function answer(index) {
    if (selected !== null) return
    setSelected(index)
    if (index === questions[step].answer) setScore((value) => value + 1)
  }

  function next() {
    if (step === questions.length - 1) setFinished(true)
    else { setStep((value) => value + 1); setSelected(null) }
  }

  function restart() { setStep(0); setScore(0); setSelected(null); setFinished(false) }

  if (finished) return (
    <section className="game-detail">
      <button className="link-btn" onClick={onBack}>← Back to games</button>
      <div className="game-result-card">
        <p className="eyebrow">Trivia Battle complete</p>
        <h2>{score} / {questions.length}</h2>
        <p className="subtitle">Compare your score with your partner and play again whenever you are ready.</p>
        <div className="row"><button className="primary-btn" onClick={restart}>Play again</button><button onClick={onBack}>Choose another game</button></div>
      </div>
    </section>
  )

  const question = questions[step]
  return (
    <section className="game-detail">
      <button className="link-btn" onClick={onBack}>← Back to games</button>
      <p className="eyebrow">Trivia Battle · Question {step + 1} of {questions.length}</p>
      <h2>{question.prompt}</h2>
      <div className="quiz-options">
        {question.options.map((option, index) => (
          <button key={option} className={'quiz-option' + (selected === index ? ' selected' : '')} onClick={() => answer(index)} disabled={selected !== null}>
            {option}
            {selected !== null && index === question.answer ? ' · Correct' : ''}
            {selected === index && index !== question.answer ? ' · Not quite' : ''}
          </button>
        ))}
      </div>
      {selected !== null && <button className="primary-btn" onClick={next}>{step === questions.length - 1 ? 'See result' : 'Next question'}</button>}
    </section>
  )
}
