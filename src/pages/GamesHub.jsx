import { useState } from 'react'
import WordGame from '../games/WordGame'
import TruthOrDare from '../games/TruthOrDare'
import ThisOrThat from '../games/ThisOrThat'
import TicTacToe from '../games/TicTacToe'
import Pictionary from '../games/Pictionary'
import Connect4 from '../games/Connect4'
import NeverHaveIEver from '../games/NeverHaveIEver'
import TwentyQuestions from '../games/TwentyQuestions'
import EmojiCharades from '../games/EmojiCharades'
import StoryChain from '../games/StoryChain'

const GAMES = [
  { key: 'word', title: 'Word Game', desc: 'Solve a shared word together, 6 guesses', icon: '🔤', Component: WordGame },
  { key: 'tod', title: 'Truth or Dare', desc: 'Pick one, see what comes up', icon: '🎲', Component: TruthOrDare },
  { key: 'tot', title: 'This or That', desc: 'Rapid-fire picks, compare matches', icon: '⚡', Component: ThisOrThat },
  { key: 'ttt', title: 'Tic-Tac-Toe', desc: 'Real-time head-to-head', icon: '❌', Component: TicTacToe },
  { key: 'pictionary', title: 'Pictionary', desc: 'One draws, one guesses', icon: '🎨', Component: Pictionary },
  { key: 'connect4', title: 'Connect Four', desc: '4 in a row, real-time', icon: '🔴', Component: Connect4 },
  { key: 'nhie', title: 'Never Have I Ever', desc: 'Honest picks, see where you match', icon: '🙈', Component: NeverHaveIEver },
  { key: 'twentyq', title: '20 Questions', desc: 'Think of something, guess with yes/no', icon: '❓', Component: TwentyQuestions },
  { key: 'emoji', title: 'Emoji Charades', desc: 'Decode the phrase from emojis', icon: '😄', Component: EmojiCharades },
  { key: 'story', title: 'Story Chain', desc: 'Build a story, one line at a time', icon: '📖', Component: StoryChain },
]

const RECENT_KEY = 'blessuth-recent-games'

function loadRecent() {
  try {
    const raw = localStorage.getItem(RECENT_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function recordPlayed(key) {
  try {
    const recent = loadRecent().filter((k) => k !== key)
    recent.unshift(key)
    localStorage.setItem(RECENT_KEY, JSON.stringify(recent.slice(0, 10)))
  } catch {
    // localStorage can fail (private browsing, storage full) — sorting just
    // falls back to the default order, nothing else depends on this.
  }
}

function sortedByRecent(games) {
  const recent = loadRecent()
  if (recent.length === 0) return games
  return [...games].sort((a, b) => {
    const ai = recent.indexOf(a.key)
    const bi = recent.indexOf(b.key)
    if (ai === -1 && bi === -1) return 0
    if (ai === -1) return 1
    if (bi === -1) return -1
    return ai - bi
  })
}

export default function GamesHub({ onGoToQuizzes }) {
  const [activeKey, setActiveKey] = useState(null)
  const active = GAMES.find((g) => g.key === activeKey)
  const orderedGames = sortedByRecent(GAMES)
  const hasRecent = loadRecent().length > 0

  function openGame(key) {
    recordPlayed(key)
    setActiveKey(key)
  }

  if (active) {
    const { Component } = active
    return <Component onBack={() => setActiveKey(null)} />
  }

  return (
    <>
      <p className="subtitle">
        Bite-sized 2-player games, built right into the app.
        {hasRecent && ' Your most recent ones show up first.'}
      </p>

      <div className="games-grid">
        <button className="game-tile" onClick={onGoToQuizzes}>
          <div className="game-tile-icon">🏆</div>
          <div className="game-tile-title">Trivia Battle</div>
          <div className="game-tile-desc">Head-to-head score, in the Quizzes tab</div>
        </button>
        {orderedGames.map((g) => (
          <button key={g.key} className="game-tile" onClick={() => openGame(g.key)}>
            <div className="game-tile-icon">{g.icon}</div>
            <div className="game-tile-title">{g.title}</div>
            <div className="game-tile-desc">{g.desc}</div>
          </button>
        ))}
      </div>
    </>
  )
}
