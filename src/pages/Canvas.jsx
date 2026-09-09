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

  // window.confirm() is unreliable in iOS home-screen PWAs (a known iOS
  // WebKit limitation) — using the same inline confirm-box pattern as the
  // rest of the app instead of the native browser dialog. Especially worth
  // getting right here, since this action wipes a page for both of you.
  const [confirmingClear, setConfirmingClear] = useState(false)
  const [clearBusy, setClearBusy] = useState(false)
  const [undoBusy, setUndoBusy] = useState(false)

  // Multiple pages — flip through them like a notebook. Page navigation is
  // deliberately buttons-only, not swipe: the canvas already uses
  // touch-drag for drawing strokes, so a swipe gesture there would be
  // ambiguous with actually drawing something.
  const [pages, setPages] = useState([])
  const [pageIndex, setPageIndex] = useState(0)
  const [addingPage, setAddingPage] = useState(false)
  const currentPageNumber = pages[pageIndex]?.page_number
  const currentPageNumberRef = useRef(currentPageNumber)
  currentPageNumberRef.current = currentPageNumber

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

  async function loadPages() {
    if (!couple) return
    const { data } = await supabase
      .from('canvas_pages')
      .select('*')
      .eq('couple_id', couple.id)
      .order('page_number', { ascending: true })
    let list = data || []
    if (list.length === 0) {
      // First time this couple has ever opened Canvas — bootstrap page 1
      // (every stroke drawn before multi-page support already lives under
      // page_number = 1 by default, so this lines up with existing work).
      const { data: created } = await supabase
        .from('canvas_pages')
        .insert({ couple_id: couple.id, page_number: 1, created_by: user.id })
        .select()
        .single()
      if (created) list = [created]
    }
    setPages(list)
    setPageIndex((i) => Math.min(i, Math.max(list.length - 1, 0)))
  }

  async function loadBoard(pageNumber) {
    if (!couple || pageNumber === undefined) return
    const { data } = await supabase
      .from('board_strokes')
      .select('*')
      .eq('couple_id', couple.id)
      .eq('page_number', pageNumber)
      .order('created_at', { ascending: true })
    const strokes = data || []
    strokesRef.current = strokes
    setHasStrokes(strokes.length > 0)
    renderAll(strokes)
  }

  useEffect(() => {
    if (!couple) return
    loadPages()

    const channel = supabase
      .channel(`board-strokes-${couple.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'board_strokes', filter: `couple_id=eq.${couple.id}` },
        (payload) => {
          if (payload.new.by === user.id) return // already on screen, drawn locally
          if (payload.new.page_number !== currentPageNumberRef.current) return // a different page
          strokesRef.current = [...strokesRef.current, payload.new]
          setHasStrokes(true)
          drawStroke(payload.new)
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'board_strokes', filter: `couple_id=eq.${couple.id}` },
        () => {
          // A clear deletes every row on a page — simplest correct
          // response is to just reload the current page rather than track
          // individual deletions.
          loadBoard(currentPageNumberRef.current)
        }
      )
      .subscribe()

    const pagesChannel = supabase
      .channel(`canvas-pages-${couple.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'canvas_pages', filter: `couple_id=eq.${couple.id}` },
        () => loadPages()
      )
      .subscribe()

    // Realtime sockets can silently drop while a tab is backgrounded for a
    // while (phone locked, app-switched). Re-sync from scratch whenever the
    // tab becomes visible again, so a missed stroke doesn't just stay missing.
    function onVisible() {
      if (document.visibilityState === 'visible') {
        loadPages()
        loadBoard(currentPageNumberRef.current)
      }
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      supabase.removeChannel(channel)
      supabase.removeChannel(pagesChannel)
      document.removeEventListener('visibilitychange', onVisible)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [couple?.id])

  useEffect(() => {
    if (!couple || currentPageNumber === undefined) return
    loadBoard(currentPageNumber)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [couple?.id, currentPageNumber])

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
      page_number: currentPageNumber,
    })
  }

  async function undoLast() {
    const strokes = strokesRef.current
    if (strokes.length === 0) return
    setUndoBusy(true)
    const last = strokes[strokes.length - 1]
    await supabase.from('board_strokes').delete().eq('id', last.id)
    setUndoBusy(false)
  }

  async function clearBoard() {
    setClearBusy(true)
    await supabase.from('board_strokes').delete().eq('couple_id', couple.id).eq('page_number', currentPageNumber)
    clearCanvas()
    strokesRef.current = []
    setHasStrokes(false)
    setClearBusy(false)
    setConfirmingClear(false)
  }

  async function addPage() {
    setAddingPage(true)
    const nextNumber = (pages[pages.length - 1]?.page_number || 0) + 1
    const { data: created } = await supabase
      .from('canvas_pages')
      .insert({ couple_id: couple.id, page_number: nextNumber, created_by: user.id })
      .select()
      .single()
    if (created) {
      setPages((prev) => [...prev, created])
      setPageIndex(pages.length) // the new page is now the last index
    }
    setAddingPage(false)
  }

  function goPrev() {
    setPageIndex((i) => Math.max(0, i - 1))
  }

  function goNext() {
    setPageIndex((i) => Math.min(pages.length - 1, i + 1))
  }

  return (
    <div className="screen with-nav">
      <h2>Shared Canvas</h2>
      <p className="subtitle">Draw together — updates live for both of you.</p>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, marginBottom: 10 }}>
        <button
          className="link-btn"
          onClick={goPrev}
          disabled={pageIndex === 0}
          aria-label="Previous page"
          style={{ fontSize: '1.2rem', padding: '4px 10px' }}
        >
          ‹
        </button>
        <span className="subtitle small-note" style={{ minWidth: 90, textAlign: 'center' }}>
          Page {pageIndex + 1} of {pages.length || 1}
        </span>
        <button
          className="link-btn"
          onClick={goNext}
          disabled={pageIndex >= pages.length - 1}
          aria-label="Next page"
          style={{ fontSize: '1.2rem', padding: '4px 10px' }}
        >
          ›
        </button>
        <button className="link-btn small" onClick={addPage} disabled={addingPage}>
          {addingPage ? 'Adding…' : '+ New page'}
        </button>
      </div>

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
        <input type="range" min="2" max="20" value={width} onChange={(e) => setWidth(Number(e.target.value))} />
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <button className="link-btn" onClick={undoLast} disabled={!hasStrokes || undoBusy}>
            {undoBusy ? 'Undoing…' : 'Undo last stroke'}
          </button>
          {!confirmingClear ? (
            <button className="link-btn" onClick={() => setConfirmingClear(true)} disabled={!hasStrokes}>
              Clear page
            </button>
          ) : null}
        </div>
        {confirmingClear && (
          <div className="confirm-box">
            <p>Clear this page for both of you?</p>
            <div className="row">
              <button className="danger-btn" onClick={clearBoard} disabled={clearBusy}>
                {clearBusy ? 'Clearing…' : 'Yes, clear it'}
              </button>
              <button type="button" onClick={() => setConfirmingClear(false)} disabled={clearBusy}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
