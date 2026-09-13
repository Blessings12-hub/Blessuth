import { useState } from 'react'
import Quizzes from './Quizzes'
import GamesHub from './GamesHub'

export default function Play() {
  const [tab, setTab] = useState('quizzes')

  return (
    <main className="screen with-nav play-screen">
      <header className="play-header">
        <div>
          <p className="eyebrow">Together time</p>
          <h1>Play together</h1>
          <p className="subtitle">A little friendly competition, a lot of shared moments.</p>
        </div>
        <div className="play-header-mark" aria-hidden="true">+</div>
      </header>
      <div className="play-context" role="note">
        <strong>Make time for each other.</strong>
        <span>Pick a quiz to learn something new, or open a game for a quick shared turn.</span>
      </div>
      <div className="play-tabs" role="tablist" aria-label="Play activities">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'quizzes'}
          aria-controls="play-panel"
          className={'play-tab' + (tab === 'quizzes' ? ' active' : '')}
          onClick={() => setTab('quizzes')}
        >
          <span>Quizzes</span><small>Know each other</small>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'games'}
          className={'play-tab' + (tab === 'games' ? ' active' : '')}
          onClick={() => setTab('games')}
        >
          <span>Games</span><small>Make a moment</small>
        </button>
      </div>

      <section id="play-panel" className="play-content" aria-live="polite">
        {tab === 'quizzes' ? <Quizzes /> : <GamesHub />}
      </section>
    </main>
  )
}
