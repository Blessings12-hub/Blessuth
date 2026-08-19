import { useEffect, useRef, useState } from 'react'
import { supabase } from '../supabase/config'
import { useAuth } from '../context/AuthContext'

const COLORS = ['#2d2d2d', '#e63946', '#f4a261', '#2a9d8f', '#457b9d', '#e76f51', '#ffffff']

export default function Canvas() {
  const { couple, user } = useAuth()
  const canvasRef = useRef(null)
  const drawing = useRef(false)
  const currentStroke = useRef([])
  const strokesRef = useRef([]) // mirrors state, for the pointer-move draw loop
  const [color, setColor] = useState('#2d2d2d')
  const [width, setWidth] = useState(4)
  const [hasStrokes, setHasStrokes] = useState(false)

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

  async function loadBoard() {
    if (!couple) return
    const { data } = await supabase
      .from('board_strokes')
      .select('*')
      .eq('couple_id', couple.id)
      .order('created_at', { ascending: true })
    const strokes = data || []
    strokesRef.current = strokes
    setHasStrokes(strokes.length > 0)
    renderAll(strokes)
  }

  useEffect(() => {
    if (!couple) return
    loadBoard()

    const channel = supabase
      .channel(`board-strokes-${couple.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'board_strokes', filter: `couple_id=eq.${couple.id}` },
        (payload) => {
          // Skip strokes we just drew ourselves — already on screen, and
          // re-adding them here would just be extra work.
          if (payload.new.by === user.id) return
          strokesRef.current = [...strokesRef.current, payload.new]
          setHasStrokes(true)
          drawStroke(payload.new)
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'board_strokes', filter: `couple_id=eq.${couple.id}` },
        () => {
          // A clear deletes every row — simplest correct response is to
          // just reload rather than track individual deletions.
          loadBoard()
        }
      )
      .subscribe()

    // Realtime sockets can silently drop while a tab is backgrounded for a
    // while (phone locked, app-switched). Re-sync from scratch whenever the
    // tab becomes visible again, so a missed stroke doesn't just stay missing.
    function onVisible() {
      if (document.visibilityState === 'visible') loadBoard()
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      supabase.removeChannel(channel)
      document.removeEventListener('visibilitychange', onVisible)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [couple?.id])

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
      ctx.lineWidth = width
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
    setHasStrokes(true)

    // A plain insert — no read-modify-write, so two strokes landing at the
    // same moment can never overwrite each other.
    await supabase.from('board_strokes').insert({
      couple_id: couple.id,
      color,
      width,
      points,
      by: user.id,
    })
  }

  async function clearBoard() {
    if (!confirm('Clear the whole canvas for both of you?')) return
    await supabase.from('board_strokes').delete().eq('couple_id', couple.id)
    clearCanvas()
    strokesRef.current = []
    setHasStrokes(false)
  }

  return (
    <div className="screen with-nav">
      <h2>Shared Canvas</h2>
      <p className="subtitle">Draw together — updates live for both of you.</p>

      <div className="canvas-wrap">
        <canvas
          ref={canvasRef}
          width={600}
          height={600}
          className="draw-canvas"
          onMouseDown={start}
          onMouseMove={move}
          onMouseUp={end}
          onMouseLeave={end}
          onTouchStart={start}
          onTouchMove={move}
          onTouchEnd={end}
        />
        {!hasStrokes && <div className="canvas-empty-hint">Draw something — it shows up for both of you live</div>}
      </div>

      <div className="canvas-controls">
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
        <input
          type="range"
          min="2"
          max="20"
          value={width}
          onChange={(e) => setWidth(Number(e.target.value))}
        />
        <button className="link-btn" onClick={clearBoard}>
          Clear board
        </button>
      </div>
    </div>
  )
}
