import { useState } from 'react'
import Quizzes from './Quizzes'
import GamesHub from './GamesHub'

export default function Play() {
  const [tab, setTab] = useState('quizzes')

  return (
    <div className="screen with-nav">
      <div className="play-tabs">
        <button
          className={'play-tab' + (tab === 'quizzes' ? ' active' : '')}
          onClick={() => setTab('quizzes')}
        >
          Quizzes
        </button>
        <button className={'play-tab' + (tab === 'games' ? ' active' : '')} onClick={() => setTab('games')}>
          Games
        </button>
      </div>

      {tab === 'quizzes' ? <Quizzes /> : <GamesHub />}
    </div>
  )
}
