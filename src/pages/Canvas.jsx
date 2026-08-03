import { useEffect, useRef, useState } from 'react'
import { doc, onSnapshot, setDoc, updateDoc, arrayUnion } from 'firebase/firestore'
import { db } from '../firebase/config'
import { useAuth } from '../context/AuthContext'

const COLORS = ['#2d2d2d', '#e63946', '#f4a261', '#2a9d8f', '#457b9d', '#e76f51', '#ffffff']

export default function Canvas() {
  const { couple, user } = useAuth()
  const canvasRef = useRef(null)
  const drawing = useRef(false)
  const currentStroke = useRef([])
  const [color, setColor] = useState('#2d2d2d')
  const [width, setWidth] = useState(4)
  const strokesRef = useRef([])

  const boardId = couple ? `${couple.id}_board` : null

  // Redraw everything from a strokes array
  function renderAll(strokes) {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#fffdf8'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    strokes.forEach((stroke) => {
      if (!stroke.points || stroke.points.length < 2) return
      ctx.beginPath()
      ctx.strokeStyle = stroke.color
      ctx.lineWidth = stroke.width
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y)
      stroke.points.slice(1).forEach((p) => ctx.lineTo(p.x, p.y))
      ctx.stroke()
    })
  }

  useEffect(() => {
    if (!boardId) return
    const ref = doc(db, 'boards', boardId)
    const unsub = onSnapshot(ref, (snap) => {
      const strokes = snap.exists() ? snap.data().strokes || [] : []
      strokesRef.current = strokes
      renderAll(strokes)
    })
    return unsub
  }, [boardId])

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
    // draw locally for instant feedback
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
    const stroke = { points: currentStroke.current, color, width, by: user.uid }
    currentStroke.current = []
    const ref = doc(db, 'boards', boardId)
    try {
      await updateDoc(ref, { strokes: arrayUnion(stroke) })
    } catch {
      await setDoc(ref, { strokes: [stroke] })
    }
  }

  async function clearBoard() {
    if (!confirm('Clear the whole canvas for both of you?')) return
    await setDoc(doc(db, 'boards', boardId), { strokes: [] })
  }

  return (
    <div className="screen with-nav">
      <h2>🎨 Shared Canvas</h2>
      <p className="subtitle">Draw together — updates live for both of you.</p>

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
