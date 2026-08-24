import { useEffect, useState } from 'react'
import { supabase } from '../supabase/config'
import { useAuth } from '../context/AuthContext'
import Confetti from '../components/Confetti'

const ROWS = 6
const COLS = 7

function idx(r, c) {
  return r * COLS + c
}

function dropRow(board, col) {
  for (let r = ROWS - 1; r >= 0; r--) {
    if (!board[idx(r, col)]) return r
  }
  return -1
}

function checkWinner(board) {
  const dirs = [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, -1],
  ]
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cell = board[idx(r, c)]
      if (!cell) continue
      for (const [dr, dc] of dirs) {
        let count = 1
        for (let k = 1; k < 4; k++) {
          const nr = r + dr * k
          const nc = c + dc * k
          if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) break
          if (board[idx(nr, nc)] === cell) count++
          else break
        }
        if (count === 4) return cell
      }
    }
  }
  if (board.every((c) => c)) return 'draw'
  return null
}

export default function Connect4({ onBack }) {
  const { couple, user, partnerUid, partnerName } = useAuth()
  const [game, setGame] = useState(null)
  const [history, setHistory] = useState([])
  const [busy, setBusy] = useState(false)

  async function loadGame() {
    if (!couple) return
    const { data } = await supabase
      .from('connect4_games')
      .select('*')
      .eq('couple_id', couple.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    setGame(data || null)
  }

  async function loadHistory() {
    if (!couple) return
    const { data } = await supabase
      .from('connect4_games')
      .select('winner, player_r, player_y')
      .eq('couple_id', couple.id)
      .not('winner', 'is', null)
    setHistory(data || [])
  }

  useEffect(() => {
    if (!couple) return
    loadGame()
    loadHistory()

    const channel = supabase
      .channel(`connect4-${couple.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'connect4_games', filter: `couple_id=eq.${couple.id}` },
        () => {
          loadGame()
          loadHistory()
        }
      )
      .subscribe()

    return () => supabase.removeChannel(channel)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [couple?.id])

  async function startGame() {
    setBusy(true)
    const iAmR = Math.random() < 0.5
    await supabase.from('connect4_games').insert({
      couple_id: couple.id,
      player_r: iAmR ? user.id : partnerUid,
      player_y: iAmR ? partnerUid : user.id,
      turn: iAmR ? user.id : partnerUid,
      created_by: user.id,
    })
    setBusy(false)
  }

  async function playColumn(col) {
    if (!game || game.winner || game.turn !== user.id) return
    const row = dropRow(game.board, col)
    if (row === -1) return
    const board = [...game.board]
    board[idx(row, col)] = game.player_r === user.id ? 'R' : 'Y'
    const winner = checkWinner(board)
    setBusy(true)
    await supabase
      .from('connect4_games')
      .update({ board, turn: partnerUid, winner, updated_at: new Date().toISOString() })
      .eq('id', game.id)
    setBusy(false)
  }

  const mySymbol = game && (game.player_r === user.id ? 'R' : 'Y')
  const myTurn = game && !game.winner && game.turn === user.id

  const myWins = history.filter(
    (g) => (g.winner === 'R' && g.player_r === user.id) || (g.winner === 'Y' && g.player_y === user.id)
  ).length
  const theirWins = history.filter(
    (g) => (g.winner === 'R' && g.player_r === partnerUid) || (g.winner === 'Y' && g.player_y === partnerUid)
  ).length
  const draws = history.filter((g) => g.winner === 'draw').length

  return (
    <>
      <button className="link-btn" onClick={onBack}>
        ← Back to games
      </button>
      <h2>Connect Four</h2>
      <p className="subtitle">Tap a column to drop your piece — get 4 in a row to win.</p>

      {history.length > 0 && (
        <p className="ttt-tally">
          You {myWins} — {theirWins} {partnerName || 'Partner'}
          {draws > 0 ? ` · ${draws} draw${draws === 1 ? '' : 's'}` : ''}
        </p>
      )}

      {!game || game.winner ? (
        <div className="game-empty-state">
          {game?.winner && game.winner !== 'draw' && game.winner === mySymbol && <Confetti />}
          {game?.winner && (
            <p className="ttt-last-result">
              {game.winner === 'draw'
                ? 'Last game was a draw.'
                : (game.winner === mySymbol ? 'You won' : `${partnerName || 'Partner'} won`) + ' the last game.'}
            </p>
          )}
          <button className="primary-btn" onClick={startGame} disabled={busy}>
            {game ? 'Play again' : 'Start a game'}
          </button>
        </div>
      ) : (
        <>
          <p className={'ttt-turn-indicator' + (myTurn ? ' mine' : '')}>
            {myTurn ? 'Your turn' : `${partnerName || 'Their'} turn`} · you're {mySymbol === 'R' ? '🔴' : '🟡'}
          </p>
          <div className="c4-board">
            {Array.from({ length: COLS }).map((_, col) => (
              <button
                key={col}
                className="c4-column"
                onClick={() => playColumn(col)}
                disabled={!myTurn || busy || dropRow(game.board, col) === -1}
              >
                {Array.from({ length: ROWS }).map((_, row) => {
                  const cell = game.board[idx(row, col)]
                  return (
                    <div
                      key={row}
                      className={'c4-cell' + (cell ? ` filled ${cell.toLowerCase()}` : '')}
                    />
                  )
                })}
              </button>
            ))}
          </div>
        </>
      )}
    </>
  )
}
