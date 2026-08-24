import { useEffect, useState } from 'react'
import { supabase } from '../supabase/config'
import { useAuth } from '../context/AuthContext'
import Confetti from '../components/Confetti'

const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
]

function checkWinner(board) {
  for (const [a, b, c] of LINES) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a]
  }
  if (board.every((cell) => cell)) return 'draw'
  return null
}

export default function TicTacToe({ onBack }) {
  const { couple, user, partnerUid, partnerName } = useAuth()
  const [game, setGame] = useState(null)
  const [history, setHistory] = useState([])
  const [busy, setBusy] = useState(false)

  async function loadGame() {
    if (!couple) return
    const { data } = await supabase
      .from('tictactoe_games')
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
      .from('tictactoe_games')
      .select('winner, player_x, player_o')
      .eq('couple_id', couple.id)
      .not('winner', 'is', null)
    setHistory(data || [])
  }

  useEffect(() => {
    if (!couple) return
    loadGame()
    loadHistory()

    const channel = supabase
      .channel(`tictactoe-${couple.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tictactoe_games', filter: `couple_id=eq.${couple.id}` },
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
    // Coin flip for who's X (X always goes first).
    const iAmX = Math.random() < 0.5
    await supabase.from('tictactoe_games').insert({
      couple_id: couple.id,
      player_x: iAmX ? user.id : partnerUid,
      player_o: iAmX ? partnerUid : user.id,
      turn: iAmX ? user.id : partnerUid,
      created_by: user.id,
    })
    setBusy(false)
  }

  async function playCell(i) {
    if (!game || game.winner || game.board[i] || game.turn !== user.id) return
    const board = [...game.board]
    board[i] = game.player_x === user.id ? 'X' : 'O'
    const winner = checkWinner(board)
    setBusy(true)
    await supabase
      .from('tictactoe_games')
      .update({
        board,
        turn: partnerUid,
        winner,
        updated_at: new Date().toISOString(),
      })
      .eq('id', game.id)
    setBusy(false)
  }

  const mySymbol = game && (game.player_x === user.id ? 'X' : 'O')
  const myTurn = game && !game.winner && game.turn === user.id

  const myWins = history.filter(
    (g) => (g.winner === 'X' && g.player_x === user.id) || (g.winner === 'O' && g.player_o === user.id)
  ).length
  const theirWins = history.filter(
    (g) => (g.winner === 'X' && g.player_x === partnerUid) || (g.winner === 'O' && g.player_o === partnerUid)
  ).length
  const draws = history.filter((g) => g.winner === 'draw').length

  return (
    <>
      <button className="link-btn" onClick={onBack}>
        ← Back to games
      </button>
      <h2>Tic-Tac-Toe</h2>
      <p className="subtitle">Real-time, head-to-head — tap a square on your turn.</p>

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
                ? "Last game was a draw."
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
            {myTurn ? "Your turn" : `${partnerName || 'Their'} turn`} · you're {mySymbol}
          </p>
          <div className="ttt-board">
            {game.board.map((cell, i) => (
              <button
                key={i}
                className={'ttt-cell' + (cell ? ` filled ${cell.toLowerCase()}` : '')}
                onClick={() => playCell(i)}
                disabled={!myTurn || !!cell || busy}
              >
                {cell}
              </button>
            ))}
          </div>
        </>
      )}
    </>
  )
}
