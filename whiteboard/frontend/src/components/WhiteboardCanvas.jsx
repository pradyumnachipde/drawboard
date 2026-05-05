import React, { useEffect } from 'react'
import { useWhiteboard, TOOLS } from '../hooks/useWhiteboard'
import { useAuth } from '../contexts/AuthContext'
import Toolbar from './Toolbar'
import PresenceBar from './PresenceBar'
import ChatPanel from './ChatPanel'

const CANVAS_WIDTH  = 2560
const CANVAS_HEIGHT = 1440

// ── Connection status badge ───────────────────────────────────────────────────
function ConnectionBadge({ state }) {
  const map = {
    open:         { dot: 'bg-green-400', label: 'Live',         text: 'text-green-700', bg: 'bg-green-50 border-green-200' },
    connecting:   { dot: 'bg-yellow-400 animate-pulse', label: 'Connecting…', text: 'text-yellow-700', bg: 'bg-yellow-50 border-yellow-200' },
    reconnecting: { dot: 'bg-orange-400 animate-pulse', label: 'Reconnecting…', text: 'text-orange-700', bg: 'bg-orange-50 border-orange-200' },
    closed:       { dot: 'bg-red-400',   label: 'Offline',      text: 'text-red-700',   bg: 'bg-red-50 border-red-200' },
  }
  const s = map[state] || map.connecting
  return (
    <div className={`absolute top-3 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1.5
                     px-3 py-1.5 rounded-full border text-xs font-medium ${s.bg} ${s.text}`}>
      <span className={`w-2 h-2 rounded-full ${s.dot}`} />
      {s.label}
    </div>
  )
}

export default function WhiteboardCanvas({ roomCode, roomName }) {
  const { user, getWsToken } = useAuth()
  const token = getWsToken()

  const {
    canvasRef,
    cursorCanvasRef,
    tool, setTool,
    color, setColor,
    size, setSize,
    users,
    wsState,
    startDraw,
    draw,
    endDraw,
    undo, redo,
    clearBoard,
    exportImage,
  } = useWhiteboard(roomCode, token)

  // Sync cursor canvas size whenever window resizes
  useEffect(() => {
    const sync = () => {
      const main   = canvasRef.current
      const cursor = cursorCanvasRef.current
      if (!main || !cursor) return
      cursor.width  = main.width
      cursor.height = main.height
    }
    sync()
    window.addEventListener('resize', sync)
    return () => window.removeEventListener('resize', sync)
  }, [canvasRef, cursorCanvasRef])

  const isOwner = users.some((u) => u.id === String(user?.id) && u.is_owner) ||
                  users.length > 0 // fallback: owner check done server-side on clear

  const cursorClass = tool === TOOLS.ERASER ? 'cursor-eraser' : 'cursor-pen'

  return (
    <div className="relative w-full h-screen bg-gray-50 overflow-hidden">

      {/* Connection badge */}
      <ConnectionBadge state={wsState} />

      {/* Presence (top-right) */}
      <PresenceBar users={users} roomCode={roomCode} roomName={roomName} />

      {/* Toolbar (left side) */}
      <Toolbar
        tool={tool}       setTool={setTool}
        color={color}     setColor={setColor}
        size={size}       setSize={setSize}
        onUndo={undo}
        onRedo={redo}
        onClear={clearBoard}
        onExport={exportImage}
        isOwner={true}  // let server enforce; owner-only guard is in consumer
      />

      {/* ── Canvas stack ── */}
      <div className="absolute inset-0 flex items-center justify-center">
        {/* Main drawing canvas */}
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className={`w-full h-full touch-none bg-white ${cursorClass}`}
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={endDraw}
          onMouseLeave={endDraw}
          onTouchStart={startDraw}
          onTouchMove={draw}
          onTouchEnd={endDraw}
        />

        {/* Cursor overlay — pointer-events: none so it never intercepts drawing */}
        <canvas
          ref={cursorCanvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className="absolute inset-0 w-full h-full pointer-events-none"
        />
      </div>

      {/* Chat panel (bottom-right) */}
      <ChatPanel roomCode={roomCode} token={token} />
    </div>
  )
}
