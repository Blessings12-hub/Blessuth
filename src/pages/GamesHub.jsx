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
import TriviaBattle from '../games/TriviaBattle'

const GAMES = [
  { key: 'trivia', title: 'Trivia Battle', desc: 'Bible trivia with instant feedback', icon: '?', Component: TriviaBattle },
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
const FAVORITES_KEY = 'blessuth-favorite-games'

function loadJSON(key) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // localStorage can fail (private browsing, storage full) — sorting and
    // favoriting just silently fall back to defaults, nothing else depends
    // on this succeeding.
  }
}

function recordPlayed(key) {
  const recent = loadJSON(RECENT_KEY).filter((k) => k !== key)
  recent.unshift(key)
  saveJSON(RECENT_KEY, recent.slice(0, 10))
}

function toggleFavorite(key) {
  const favorites = loadJSON(FAVORITES_KEY)
  const next = favorites.includes(key) ? favorites.filter((k) => k !== key) : [...favorites, key]
  saveJSON(FAVORITES_KEY, next)
  return next
}

// Favorites always lead, then whatever's been played most recently, then
// everything else in its original order — gives people direct control
// (favoriting) plus a sensible default (recency) without forcing either.
function orderGames(games, favorites, recent) {
  return [...games].sort((a, b) => {
    const aFav = favorites.includes(a.key)
    const bFav = favorites.includes(b.key)
    if (aFav !== bFav) return aFav ? -1 : 1
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
  const [favorites, setFavorites] = useState(() => loadJSON(FAVORITES_KEY))
  const active = GAMES.find((g) => g.key === activeKey)
  const recent = loadJSON(RECENT_KEY)
  const orderedGames = orderGames(GAMES, favorites, recent)

  function openGame(key) {
    recordPlayed(key)
    setActiveKey(key)
  }

  function handleFavoriteClick(e, key) {
    e.stopPropagation()
    setFavorites(toggleFavorite(key))
  }

  if (active) {
    const { Component } = active
    return <Component onBack={() => setActiveKey(null)} />
  }

  return (
    <>
      <p className="subtitle">
        Bite-sized 2-player games, built right into the app.
        {favorites.length > 0 ? ' Your favorites are pinned to the top.' : ' Tap the star on any game to pin it to the top.'}
      </p>

      {/* Trivia Battle isn't a game in its own right — it's the head-to-head
          scoreboard built from your Quiz answers, so this is a shortcut
          into the Quizzes tab, deliberately styled apart from the grid of
          actual games below so it doesn't read as "one of the games." */}
      <button
        onClick={onGoToQuizzes}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          background: 'linear-gradient(135deg, var(--ink), #3a3f6d)',
          color: 'white',
          border: 'none',
          borderRadius: 'var(--radius)',
          padding: '14px 16px',
          marginBottom: 16,
          textAlign: 'left',
          cursor: 'pointer',
        }}
      >
        <div style={{ fontSize: '1.6rem' }}>🏆</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: '0.95rem' }}>Trivia Battle</div>
          <div style={{ fontSize: '0.75rem', color: '#d8d9ec' }}>
            Your head-to-head score, built from your Quizzes — tap to view
          </div>
        </div>
        <div style={{ fontSize: '1.1rem', color: '#d8d9ec' }}>→</div>
      </button>

      <div className="games-grid">
        {orderedGames.map((g) => (
          <div
            key={g.key}
            className="game-tile"
            role="button"
            tabIndex={0}
            aria-label={`Open ${g.title}`}
            onClick={() => openGame(g.key)}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && openGame(g.key)}
            style={{ position: 'relative' }}
          >
            <button
              onClick={(e) => handleFavoriteClick(e, g.key)}
              type="button"
              aria-label={favorites.includes(g.key) ? `Unpin ${g.title}` : `Pin ${g.title} to top`}
              aria-pressed={favorites.includes(g.key)}
              style={{
                position: 'absolute',
                top: 6,
                right: 8,
                background: 'none',
                border: 'none',
                fontSize: '1.1rem',
                color: favorites.includes(g.key) ? 'var(--gold)' : 'var(--border)',
                cursor: 'pointer',
                padding: 4,
                lineHeight: 1,
              }}
            >
              {favorites.includes(g.key) ? '★' : '☆'}
            </button>
            <div className="game-tile-icon">{g.icon}</div>
            <div className="game-tile-title">{g.title}</div>
            <div className="game-tile-desc">{g.desc}</div>
          </div>
        ))}
      </div>
    </>
  )
}
