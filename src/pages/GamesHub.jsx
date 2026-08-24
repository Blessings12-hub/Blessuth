import { useState } from 'react'
import WordGame from '../games/WordGame'
import TruthOrDare from '../games/TruthOrDare'
import ThisOrThat from '../games/ThisOrThat'
import TicTacToe from '../games/TicTacToe'
import Pictionary from '../games/Pictionary'

const GAMES = [
  { key: 'word', title: 'Word Game', desc: 'Solve a shared word together, 6 guesses', icon: '🔤', Component: WordGame },
  { key: 'tod', title: 'Truth or Dare', desc: 'Pick one, see what comes up', icon: '🎲', Component: TruthOrDare },
  { key: 'tot', title: 'This or That', desc: 'Rapid-fire picks, compare matches', icon: '⚡', Component: ThisOrThat },
  { key: 'ttt', title: 'Tic-Tac-Toe', desc: 'Real-time head-to-head', icon: '❌', Component: TicTacToe },
  { key: 'pictionary', title: 'Pictionary', desc: 'One draws, one guesses', icon: '🎨', Component: Pictionary },
]

export default function GamesHub() {
  const [activeKey, setActiveKey] = useState(null)
  const active = GAMES.find((g) => g.key === activeKey)

  if (active) {
    const { Component } = active
    return <Component onBack={() => setActiveKey(null)} />
  }

  return (
    <>
      <p className="subtitle">Bite-sized 2-player games, built right into the app.</p>

      <div className="games-grid">
        {GAMES.map((g) => (
          <button key={g.key} className="game-tile" onClick={() => setActiveKey(g.key)}>
            <div className="game-tile-icon">{g.icon}</div>
            <div className="game-tile-title">{g.title}</div>
            <div className="game-tile-desc">{g.desc}</div>
          </button>
        ))}
      </div>
    </>
  )
}
