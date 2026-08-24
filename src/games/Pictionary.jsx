import { useEffect, useRef, useState } from 'react'
import { supabase } from '../supabase/config'
import { useAuth } from '../context/AuthContext'
import Confetti from '../components/Confetti'
import { randomPictionaryWord } from '../data/pictionaryWords'

const COLORS = ['#2d2d2d', '#e63946', '#f4a261', '#2a9d8f', '#457b9d']

export default function Pictionary({ onBack }) {
  const { couple, user, partnerUid, partnerName } = useAuth()
  const canvasRef = useRef(null)
  const drawing = useRef(false)
  const currentStroke = useRef([])
  const strokesRef = useRef([])
  const [color, setColor] = useState('#2d2d2d')
  const [round, setRound] = useState(null)
  const [guess, setGuess] = useState('')
  const [wrongFlash, setWrongFlash] = useState(false)
  const [busy, setBusy] = useState(false)

  const isDrawer = round && round.drawer_id === user.id

  function clearCanvas() {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#fffdf8'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }

  function drawStroke(stroke) {
    const canvas = canvasRef.current
    if (!canvas || !stroke.points || stroke.points.length < 2) return
    const ctx = canvas.getContext('2d')
    ctx.beginPath()
    ctx.strokeStyle = stroke.color
    ctx.lineWidth = stroke.width
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.moveTo(stroke.points[0].x, stroke.points[0].y)
    stroke.points.slice(1).forEach((p) => ctx.lineTo(p.x, p.y))
    ctx.stroke()
  }

  function renderAll(strokes) {
    clearCanvas()
    strokes.forEach(drawStroke)
  }

  async function loadStrokes(roundId) {
    const { data } = await supabase
      .from('pictionary_strokes')
      .select('*')
      .eq('round_id', roundId)
      .order('created_at', { ascending: true })
    const strokes = data || []
    strokesRef.current = strokes
    renderAll(strokes)
  }

  async function loadRound() {
    if (!couple) return
    const { data } = await supabase
      .from('pictionary_rounds')
      .select('*')
      .eq('couple_id', couple.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    setRound(data || null)
    if (data) {
      loadStrokes(data.id)
    } else {
      strokesRef.current = []
      clearCanvas()
    }
  }

  useEffect(() => {
    if (!couple) return
    loadRound()

    const channel = supabase
      .channel(`pictionary-${couple.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pictionary_rounds', filter: `couple_id=eq.${couple.id}` },
        () => loadRound()
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'pictionary_strokes', filter: `couple_id=eq.${couple.id}` },
        (payload) => {
          if (payload.new.by === user.id) return
          strokesRef.current = [...strokesRef.current, payload.new]
          drawStroke(payload.new)
        }
      )
      .subscribe()

    return () => supabase.removeChannel(channel)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [couple?.id])

  async function startRound() {
    setBusy(true)
    // Whoever DIDN'T draw last time draws this time, alternating naturally.
    const drawerId = round && round.drawer_id === user.id ? partnerUid : user.id
    await supabase.from('pictionary_rounds').insert({
      couple_id: couple.id,
      word: randomPictionaryWord(),
      drawer_id: drawerId,
      created_by: user.id,
    })
    setBusy(false)
  }

  function getPos(e) {
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const point = e.touches ? e.touches[0] : e
    return {
      x: ((point.clientX - rect.left) / rect.width) * canvas.width,
      y: ((point.clientY - rect.top) / rect.height) * canvas.height,
    }
  }

  function start(e) {
    if (!isDrawer || round.solved_at) return
    e.preventDefault()
    drawing.current = true
    currentStroke.current = [getPos(e)]
  }

  function move(e) {
    if (!drawing.current) return
    e.preventDefault()
    const pos = getPos(e)
    currentStroke.current.push(pos)
    const ctx = canvasRef.current.getContext('2d')
    const pts = currentStroke.current
    if (pts.length >= 2) {
      ctx.beginPath()
      ctx.strokeStyle = color
      ctx.lineWidth = 4
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.moveTo(pts[pts.length - 2].x, pts[pts.length - 2].y)
      ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y)
      ctx.stroke()
    }
  }

  async function end() {
    if (!drawing.current) return
    drawing.current = false
    if (currentStroke.current.length < 2) return
    const points = currentStroke.current
    currentStroke.current = []
    await supabase.from('pictionary_strokes').insert({
      round_id: round.id,
      couple_id: couple.id,
      color,
      width: 4,
      points,
      by: user.id,
    })
  }

  async function submitGuess() {
    if (!guess.trim() || !round) return
    const correct = guess.trim().toLowerCase() === round.word.toLowerCase()
    if (correct) {
      setBusy(true)
      await supabase
        .from('pictionary_rounds')
        .update({ solved_at: new Date().toISOString(), winning_guess: guess.trim() })
        .eq('id', round.id)
      setBusy(false)
    } else {
      setWrongFlash(true)
      setTimeout(() => setWrongFlash(false), 500)
    }
    setGuess('')
  }

  const active = round && !round.solved_at

  return (
    <>
      <button className="link-btn" onClick={onBack}>
        ← Back to games
      </button>
      <h2>Pictionary</h2>
      <p className="subtitle">One of you draws, the other guesses — the word only shows to the drawer.</p>

      {!round && (
        <div className="game-empty-state">
          <p>No round in progress.</p>
          <button className="primary-btn" onClick={startRound} disabled={busy}>
            Start a round
          </button>
        </div>
      )}

      {round && (
        <>
          {isDrawer ? (
            <p className="pictionary-role-banner drawer">
              You're drawing: <strong>{round.word}</strong>
            </p>
          ) : (
            <p className="pictionary-role-banner guesser">
              {partnerName || 'Your partner'} is drawing — guess what it is!
            </p>
          )}

          <div className="canvas-wrap">
            <canvas
              ref={canvasRef}
              width={600}
              height={450}
              className={'draw-canvas' + (wrongFlash ? ' shake' : '')}
              onMouseDown={start}
              onMouseMove={move}
              onMouseUp={end}
              onMouseLeave={end}
              onTouchStart={start}
              onTouchMove={move}
              onTouchEnd={end}
            />
          </div>

          {isDrawer && active && (
            <div className="swatches">
              {COLORS.map((c) => (
                <button
                  key={c}
                  className={'swatch' + (c === color ? ' active' : '')}
                  style={{ background: c }}
                  onClick={() => setColor(c)}
                />
              ))}
            </div>
          )}

          {!isDrawer && active && (
            <div className="word-input-row">
              <input
                type="text"
                value={guess}
                onChange={(e) => setGuess(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submitGuess()}
                placeholder="Type your guess"
                className="word-input pictionary-guess-input"
              />
              <button className="primary-btn" onClick={submitGuess} disabled={busy}>
                Guess
              </button>
            </div>
          )}

          {round.solved_at && (
            <div className="word-result-card win">
              <Confetti />
              <p className="word-result-title">
                🎉 {round.drawer_id === user.id ? partnerName || 'They' : 'You'} guessed it!
              </p>
              <p className="word-result-word">
                It was <strong>{round.word}</strong>
              </p>
              <button className="primary-btn" onClick={startRound} disabled={busy}>
                Start another round
              </button>
            </div>
          )}
        </>
      )}
    </>
  )
}
