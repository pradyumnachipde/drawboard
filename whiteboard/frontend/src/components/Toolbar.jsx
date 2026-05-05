import React, { useState } from 'react'
import { TOOLS } from '../hooks/useWhiteboard'

// ── Icons (inline SVG to avoid dependency) ────────────────────────────────────
const PenIcon       = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
const EraserIcon    = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M20 20H7L3 16l10-10 7 7-2.5 2.5"/><path d="m6.5 17.5 3-3"/></svg>
const RectIcon      = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>
const CircleIcon    = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><circle cx="12" cy="12" r="9"/></svg>
const LineIcon      = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="w-4 h-4"><line x1="4" y1="20" x2="20" y2="4"/></svg>
const ArrowIcon     = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><line x1="5" y1="19" x2="19" y2="5"/><polyline points="9 5 19 5 19 15"/></svg>
const UndoIcon      = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg>
const RedoIcon      = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13"/></svg>
const TrashIcon     = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
const DownloadIcon  = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>

const PALETTE = [
  '#1e1b4b','#111827','#dc2626','#ea580c','#ca8a04',
  '#16a34a','#0891b2','#2563eb','#9333ea','#db2777',
  '#ffffff','#f1f5f9','#fca5a5','#fdba74','#fde68a',
  '#86efac','#67e8f9','#93c5fd','#c4b5fd','#f9a8d4',
]

const SIZES = [2, 4, 8, 16, 24]

const TOOL_DEFS = [
  { id: TOOLS.PEN,    label: 'Pen (P)',     Icon: PenIcon },
  { id: TOOLS.ERASER, label: 'Eraser (E)',  Icon: EraserIcon },
  { id: TOOLS.RECT,   label: 'Rectangle (R)', Icon: RectIcon },
  { id: TOOLS.CIRCLE, label: 'Circle (C)',  Icon: CircleIcon },
  { id: TOOLS.LINE,   label: 'Line (L)',    Icon: LineIcon },
  { id: TOOLS.ARROW,  label: 'Arrow (A)',   Icon: ArrowIcon },
]

// ── Tooltip wrapper ───────────────────────────────────────────────────────────
function Tip({ label, children }) {
  return (
    <div className="relative group">
      {children}
      <div className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2 px-2 py-1
                      bg-gray-800 text-white text-xs rounded whitespace-nowrap
                      opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-50">
        {label}
      </div>
    </div>
  )
}

// ── Divider ───────────────────────────────────────────────────────────────────
function Divider() {
  return <div className="my-1 h-px bg-gray-200 mx-2" />
}

export default function Toolbar({
  tool, setTool,
  color, setColor,
  size, setSize,
  onUndo, onRedo,
  onClear, onExport,
  isOwner = false,
}) {
  const [showPalette, setShowPalette] = useState(false)
  const [showClearConfirm, setShowClearConfirm] = useState(false)

  // Keyboard shortcuts
  React.useEffect(() => {
    const map = { p: TOOLS.PEN, e: TOOLS.ERASER, r: TOOLS.RECT, c: TOOLS.CIRCLE, l: TOOLS.LINE, a: TOOLS.ARROW }
    const handler = (ev) => {
      if (ev.target.tagName === 'INPUT' || ev.target.tagName === 'TEXTAREA') return
      if (ev.ctrlKey || ev.metaKey) return
      const t = map[ev.key.toLowerCase()]
      if (t) setTool(t)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [setTool])

  return (
    <div className="absolute left-3 top-1/2 -translate-y-1/2 z-30 flex flex-col items-center
                    bg-white border border-gray-200 rounded-2xl shadow-lg py-3 px-2 gap-1 select-none">

      {/* Drawing tools */}
      {TOOL_DEFS.map(({ id, label, Icon }) => (
        <Tip key={id} label={label}>
          <button
            onClick={() => setTool(id)}
            className={`tool-btn ${tool === id ? 'tool-btn-active' : ''}`}
            aria-label={label}
          >
            <Icon />
          </button>
        </Tip>
      ))}

      <Divider />

      {/* Color swatch */}
      <Tip label="Color">
        <button
          onClick={() => setShowPalette((v) => !v)}
          className="tool-btn relative"
          aria-label="Pick color"
        >
          <span
            className="w-5 h-5 rounded-full border-2 border-gray-300 block"
            style={{ background: color }}
          />
          {showPalette && (
            <div
              className="absolute left-full ml-2 top-0 bg-white border border-gray-200 rounded-xl
                         shadow-xl p-2 grid grid-cols-5 gap-1 w-36 animate-fade-in"
              onMouseLeave={() => setShowPalette(false)}
            >
              {PALETTE.map((c) => (
                <button
                  key={c}
                  onClick={(e) => { e.stopPropagation(); setColor(c); setShowPalette(false) }}
                  className="w-6 h-6 rounded-full border-2 transition-transform hover:scale-110"
                  style={{
                    background: c,
                    borderColor: c === color ? '#6366f1' : c === '#ffffff' ? '#e5e7eb' : 'transparent',
                  }}
                  title={c}
                />
              ))}
              {/* Custom color input */}
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-6 h-6 rounded cursor-pointer border border-gray-200"
                title="Custom color"
              />
            </div>
          )}
        </button>
      </Tip>

      {/* Brush size */}
      <Tip label="Brush size">
        <div className="flex flex-col items-center gap-1 py-1">
          {SIZES.map((s) => (
            <button
              key={s}
              onClick={() => setSize(s)}
              className={`flex items-center justify-center w-9 h-6 rounded transition-colors
                          ${size === s ? 'bg-brand-50' : 'hover:bg-gray-100'}`}
              aria-label={`Size ${s}`}
            >
              <span
                className="rounded-full"
                style={{
                  width: s + 2,
                  height: s + 2,
                  maxWidth: 22,
                  maxHeight: 22,
                  background: size === s ? '#6366f1' : '#374151',
                }}
              />
            </button>
          ))}
        </div>
      </Tip>

      <Divider />

      {/* Actions */}
      <Tip label="Undo (Ctrl+Z)">
        <button onClick={onUndo} className="tool-btn" aria-label="Undo">
          <UndoIcon />
        </button>
      </Tip>
      <Tip label="Redo (Ctrl+Shift+Z)">
        <button onClick={onRedo} className="tool-btn" aria-label="Redo">
          <RedoIcon />
        </button>
      </Tip>

      <Divider />

      <Tip label="Export PNG">
        <button onClick={onExport} className="tool-btn text-gray-500 hover:text-brand-600" aria-label="Export">
          <DownloadIcon />
        </button>
      </Tip>

      {isOwner && (
        <Tip label="Clear board">
          {showClearConfirm ? (
            <div className="absolute left-full ml-2 top-0 bg-white border border-red-200 rounded-xl
                            shadow-xl p-3 w-44 animate-fade-in z-50">
              <p className="text-xs text-gray-700 mb-2 font-medium">Clear the entire board?</p>
              <div className="flex gap-2">
                <button
                  onClick={() => { onClear(); setShowClearConfirm(false) }}
                  className="flex-1 px-2 py-1 bg-red-500 text-white text-xs rounded-lg hover:bg-red-600 font-medium"
                >
                  Clear
                </button>
                <button
                  onClick={() => setShowClearConfirm(false)}
                  className="flex-1 px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-lg hover:bg-gray-200 font-medium"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowClearConfirm(true)}
              className="tool-btn text-gray-400 hover:text-red-500"
              aria-label="Clear board"
            >
              <TrashIcon />
            </button>
          )}
        </Tip>
      )}
    </div>
  )
}
