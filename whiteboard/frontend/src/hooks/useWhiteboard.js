import { useRef, useCallback, useEffect, useState } from 'react'
import { useWebSocket } from './useWebSocket'

export const TOOLS = {
  PEN:    'pen',
  ERASER: 'eraser',
  RECT:   'rect',
  CIRCLE: 'circle',
  LINE:   'line',
  ARROW:  'arrow',
}

const WS_BASE = process.env.REACT_APP_WS_URL || 'ws://localhost:8000'

// ── Utility: get canvas-relative position ────────────────────────────────────
function getPos(e, canvas) {
  const rect  = canvas.getBoundingClientRect()
  const scaleX = canvas.width  / rect.width
  const scaleY = canvas.height / rect.height
  const src    = e.touches ? e.touches[0] : e
  return {
    x: Math.round((src.clientX - rect.left) * scaleX),
    y: Math.round((src.clientY - rect.top)  * scaleY),
  }
}

// ── Stroke rendering helpers ──────────────────────────────────────────────────
function applyStrokeStyle(ctx, stroke, override = {}) {
  ctx.lineWidth   = override.size  ?? stroke.size
  ctx.strokeStyle = override.color ?? stroke.color
  ctx.fillStyle   = override.color ?? stroke.color
  ctx.lineCap     = 'round'
  ctx.lineJoin    = 'round'
  ctx.globalCompositeOperation = stroke.tool === 'eraser' ? 'destination-out' : 'source-over'
}

function renderStroke(ctx, stroke) {
  const { tool, points } = stroke
  if (!points) return

  applyStrokeStyle(ctx, stroke)
  ctx.beginPath()

  if (tool === 'pen' || tool === 'eraser') {
    if (!Array.isArray(points) || points.length < 2) return
    ctx.moveTo(points[0].x, points[0].y)
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y)
    ctx.stroke()
  } else if (tool === 'line' || tool === 'arrow') {
    const { x1, y1, x2, y2 } = points
    ctx.moveTo(x1, y1)
    ctx.lineTo(x2, y2)
    ctx.stroke()
    if (tool === 'arrow') drawArrowHead(ctx, x1, y1, x2, y2, stroke.size)
  } else if (tool === 'rect') {
    const { x1, y1, x2, y2 } = points
    ctx.strokeRect(x1, y1, x2 - x1, y2 - y1)
  } else if (tool === 'circle') {
    const { x1, y1, x2, y2 } = points
    const rx = Math.abs(x2 - x1) / 2
    const ry = Math.abs(y2 - y1) / 2
    ctx.ellipse(
      x1 + (x2 - x1) / 2,
      y1 + (y2 - y1) / 2,
      rx, ry, 0, 0, 2 * Math.PI
    )
    ctx.stroke()
  }
}

function drawArrowHead(ctx, x1, y1, x2, y2, size) {
  const angle      = Math.atan2(y2 - y1, x2 - x1)
  const headLength = Math.max(10, size * 3)
  ctx.beginPath()
  ctx.moveTo(x2, y2)
  ctx.lineTo(
    x2 - headLength * Math.cos(angle - Math.PI / 6),
    y2 - headLength * Math.sin(angle - Math.PI / 6)
  )
  ctx.moveTo(x2, y2)
  ctx.lineTo(
    x2 - headLength * Math.cos(angle + Math.PI / 6),
    y2 - headLength * Math.sin(angle + Math.PI / 6)
  )
  ctx.stroke()
}

// ── Main hook ─────────────────────────────────────────────────────────────────
export function useWhiteboard(roomCode, token) {
  const canvasRef         = useRef(null)
  const committedRef      = useRef(null)   // offscreen: committed strokes only
  const cursorCanvasRef   = useRef(null)   // separate overlay for remote cursors
  const isDrawingRef      = useRef(false)
  const startPosRef       = useRef(null)   // for shape tools: where the drag started
  const currentPointsRef  = useRef([])     // live points for pen/eraser
  const seqRef            = useRef(0)

  // strokeMap: id → stroke — for efficient undo (no server round-trip re-render)
  const strokeMapRef      = useRef(new Map())
  // Local undo stack (seq numbers for this user's strokes)
  const undoStackRef      = useRef([])
  // Deleted strokes for redo
  const redoStackRef      = useRef([])

  const remoteCursors     = useRef({})     // userId → {x, y, color, username, ts}
  const cursorFadeTimer   = useRef({})

  const [tool,   setTool]   = useState(TOOLS.PEN)
  const [color,  setColor]  = useState('#1e1b4b')
  const [size,   setSize]   = useState(4)
  const [users,  setUsers]  = useState([])
  const [wsState, setWsState] = useState('connecting')

  const wsUrl = token
    ? `${WS_BASE}/ws/whiteboard/${roomCode}/?token=${token}`
    : null

  const { sendJSON, lastMessage, readyState } = useWebSocket(wsUrl, {
    enabled: !!token,
    onOpen:  () => setWsState('open'),
    onClose: () => setWsState('closed'),
  })

  // ── Canvas init ─────────────────────────────────────────────────────────────
  const initCanvases = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    // Committed offscreen
    const committed = document.createElement('canvas')
    committed.width  = canvas.width
    committed.height = canvas.height
    committedRef.current = committed
  }, [])

  useEffect(() => { initCanvases() }, [initCanvases])

  // ── Full redraw: composite committed + cursor layers ────────────────────────
  const redrawAll = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || !committedRef.current) return
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(committedRef.current, 0, 0)
  }, [])

  // ── Redraw committed layer from strokeMap ────────────────────────────────────
  const redrawCommitted = useCallback(() => {
    const off = committedRef.current
    if (!off) return
    const ctx = off.getContext('2d')
    ctx.clearRect(0, 0, off.width, off.height)
    // Render in insertion order (Map preserves it)
    for (const stroke of strokeMapRef.current.values()) {
      renderStroke(ctx, stroke)
    }
    redrawAll()
  }, [redrawAll])

  // ── Incoming WS messages ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!lastMessage) return
    let data
    try { data = JSON.parse(lastMessage.data) } catch { return }

    switch (data.type) {
      case 'replay': {
        strokeMapRef.current.clear()
        undoStackRef.current = []
        redoStackRef.current = []
        for (const s of (data.strokes || [])) {
          strokeMapRef.current.set(s.id, s)
        }
        redrawCommitted()
        break
      }
      case 'draw_stroke': {
        const s = data.stroke
        if (s?.id) {
          strokeMapRef.current.set(s.id, { ...s, username: data.username })
        }
        // Render just this stroke onto committed layer (incremental — fast)
        const offCtx = committedRef.current?.getContext('2d')
        if (offCtx && s) renderStroke(offCtx, s)
        redrawAll()
        break
      }
      case 'undo': {
        strokeMapRef.current.delete(data.stroke_id)
        redrawCommitted()
        break
      }
      case 'redo': {
        const s = data.stroke
        if (s?.id) strokeMapRef.current.set(s.id, s)
        const offCtx = committedRef.current?.getContext('2d')
        if (offCtx && s) renderStroke(offCtx, s)
        redrawAll()
        break
      }
      case 'clear': {
        strokeMapRef.current.clear()
        undoStackRef.current = []
        redoStackRef.current = []
        redrawCommitted()
        break
      }
      case 'cursor_move': {
        remoteCursors.current[data.user_id] = {
          x: data.x, y: data.y,
          color: data.color,
          username: data.username,
          ts: Date.now(),
        }
        renderCursorOverlay()
        // Auto-hide cursor after 3 s of inactivity
        clearTimeout(cursorFadeTimer.current[data.user_id])
        cursorFadeTimer.current[data.user_id] = setTimeout(() => {
          delete remoteCursors.current[data.user_id]
          renderCursorOverlay()
        }, 3000)
        break
      }
      case 'presence': {
        setUsers(data.users || [])
        break
      }
      default: break
    }
  }, [lastMessage, redrawAll, redrawCommitted])

  // ── Cursor overlay renderer ──────────────────────────────────────────────────
  const renderCursorOverlay = useCallback(() => {
    const overlay = cursorCanvasRef.current
    if (!overlay) return
    const ctx = overlay.getContext('2d')
    ctx.clearRect(0, 0, overlay.width, overlay.height)
    for (const { x, y, color, username } of Object.values(remoteCursors.current)) {
      // Dot
      ctx.beginPath()
      ctx.arc(x, y, 5, 0, Math.PI * 2)
      ctx.fillStyle = color
      ctx.fill()
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 1.5
      ctx.stroke()
      // Label
      ctx.font = 'bold 11px Inter, sans-serif'
      const label = username
      const tw = ctx.measureText(label).width
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.roundRect?.(x + 8, y - 16, tw + 10, 18, 4)
      ctx.fill()
      ctx.fillStyle = '#ffffff'
      ctx.fillText(label, x + 13, y - 2)
    }
  }, [])

  // ── Throttled cursor send ────────────────────────────────────────────────────
  const cursorThrottle = useRef(null)
  const sendCursor = useCallback((pos) => {
    if (cursorThrottle.current) return
    cursorThrottle.current = setTimeout(() => {
      sendJSON({ type: 'cursor_move', ...pos })
      cursorThrottle.current = null
    }, 40) // 25fps
  }, [sendJSON])

  // ── Drawing event handlers ───────────────────────────────────────────────────
  const startDraw = useCallback((e) => {
    e.preventDefault()
    const canvas = canvasRef.current
    if (!canvas) return
    isDrawingRef.current = true
    const pos = getPos(e, canvas)
    startPosRef.current  = pos
    currentPointsRef.current = [pos]

    if (tool === TOOLS.PEN || tool === TOOLS.ERASER) {
      const ctx = canvas.getContext('2d')
      applyStrokeStyle(ctx, { tool, color, size })
      ctx.beginPath()
      ctx.moveTo(pos.x, pos.y)
    }
  }, [tool, color, size])

  const draw = useCallback((e) => {
    e.preventDefault()
    if (!isDrawingRef.current) return
    const canvas = canvasRef.current
    const pos = getPos(e, canvas)
    sendCursor(pos)

    if (tool === TOOLS.PEN || tool === TOOLS.ERASER) {
      currentPointsRef.current.push(pos)
      const ctx = canvas.getContext('2d')
      applyStrokeStyle(ctx, { tool, color, size })
      ctx.lineTo(pos.x, pos.y)
      ctx.stroke()
    } else {
      // Shape preview: redraw committed + preview shape
      redrawAll()
      const ctx = canvas.getContext('2d')
      const start = startPosRef.current
      const previewStroke = {
        tool, color, size,
        points: { x1: start.x, y1: start.y, x2: pos.x, y2: pos.y }
      }
      renderStroke(ctx, previewStroke)
    }
  }, [tool, color, size, sendCursor, redrawAll])

  const endDraw = useCallback((e) => {
    if (!isDrawingRef.current) return
    isDrawingRef.current = false
    const canvas = canvasRef.current
    if (!canvas) return

    let points
    if (tool === TOOLS.PEN || tool === TOOLS.ERASER) {
      if (currentPointsRef.current.length < 2) {
        currentPointsRef.current = []
        return
      }
      points = [...currentPointsRef.current]
    } else {
      const end   = e.touches ? getPos(e.changedTouches[0], canvas) : getPos(e, canvas)
      const start = startPosRef.current
      points = { x1: start.x, y1: start.y, x2: end.x, y2: end.y }
    }

    const seq = ++seqRef.current
    const stroke = {
      tool,
      color: tool === TOOLS.ERASER ? '#ffffff' : color,
      size:  tool === TOOLS.ERASER ? size * 4  : size,
      points,
      seq,
      // id will be assigned by the server; use a temp key locally
      _tempSeq: seq,
    }

    // Render onto committed layer immediately (optimistic)
    const offCtx = committedRef.current?.getContext('2d')
    if (offCtx) renderStroke(offCtx, stroke)
    redrawAll()

    sendJSON({ type: 'draw_stroke', stroke })
    undoStackRef.current.push(seq)
    redoStackRef.current = []         // new action clears redo stack
    currentPointsRef.current = []
  }, [tool, color, size, sendJSON, redrawAll])

  // ── Undo ──────────────────────────────────────────────────────────────────
  const undo = useCallback(() => {
    sendJSON({ type: 'undo' })
  }, [sendJSON])

  // ── Redo ──────────────────────────────────────────────────────────────────
  const redo = useCallback(() => {
    sendJSON({ type: 'redo' })
  }, [sendJSON])

  // ── Clear ─────────────────────────────────────────────────────────────────
  const clearBoard = useCallback(() => {
    sendJSON({ type: 'clear' })
  }, [sendJSON])

  // ── Export as PNG ─────────────────────────────────────────────────────────
  const exportImage = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const link = document.createElement('a')
    link.download = `drawboard-${roomCode}-${Date.now()}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
  }, [roomCode])

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault()
        e.shiftKey ? redo() : undo()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [undo, redo])

  return {
    canvasRef,
    cursorCanvasRef,
    tool,   setTool,
    color,  setColor,
    size,   setSize,
    users,
    wsState,
    startDraw,
    draw,
    endDraw,
    undo,
    redo,
    clearBoard,
    exportImage,
  }
}
