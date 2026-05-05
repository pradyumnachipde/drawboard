import React, { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { roomsAPI } from '../api'

// ── Icons ─────────────────────────────────────────────────────────────────────
const PlusIcon    = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="w-4 h-4"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
const ArrowIcon   = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
const UserIcon    = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
const LogOutIcon  = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
const BoardIcon   = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
const GlobeIcon   = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
const LockIcon    = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>

// ── Room card ─────────────────────────────────────────────────────────────────
function RoomCard({ room, onEnter }) {
  const ago = new Date(room.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })
  return (
    <div
      onClick={() => onEnter(room.code)}
      className="card p-4 hover:border-brand-200 hover:shadow-md cursor-pointer transition-all
                 duration-150 group active:scale-[0.98]"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 bg-brand-50 rounded-xl flex items-center justify-center
                        group-hover:bg-brand-100 transition-colors">
          <BoardIcon />
        </div>
        <span className={`flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full
          ${room.online_count > 0 ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${room.online_count > 0 ? 'bg-green-400' : 'bg-gray-300'}`} />
          {room.online_count > 0 ? `${room.online_count} online` : 'Empty'}
        </span>
      </div>
      <h3 className="font-semibold text-gray-800 mb-1 truncate">{room.name}</h3>
      <div className="flex items-center justify-between text-xs text-gray-400">
        <code className="font-mono bg-gray-100 px-1.5 py-0.5 rounded">{room.code}</code>
        <div className="flex items-center gap-1">
          {room.is_public ? <GlobeIcon /> : <LockIcon />}
          <span>{ago}</span>
        </div>
      </div>
    </div>
  )
}

// ── Create room modal ─────────────────────────────────────────────────────────
function CreateModal({ onClose, onCreate }) {
  const [name,     setName]     = useState('')
  const [isPublic, setIsPublic] = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name.trim()) { setError('Room name is required.'); return }
    setLoading(true)
    try {
      const { data } = await roomsAPI.create({ name: name.trim(), is_public: isPublic })
      onCreate(data)
    } catch (err) {
      setError(err.response?.data?.name?.[0] || 'Failed to create room.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
         onClick={onClose}>
      <div className="card w-full max-w-sm p-6 shadow-2xl animate-slide-up"
           onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-gray-900 mb-4">New Room</h2>
        {error && (
          <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg mb-3">{error}</p>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Room name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My awesome board"
              className="input-field"
              autoFocus
            />
          </div>
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <div className="relative">
              <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)}
                     className="sr-only" />
              <div className={`w-10 h-6 rounded-full transition-colors ${isPublic ? 'bg-brand-600' : 'bg-gray-200'}`} />
              <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform
                               ${isPublic ? 'translate-x-5' : 'translate-x-1'}`} />
            </div>
            <span className="text-sm text-gray-600">Public room</span>
          </label>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button type="submit" disabled={loading} className="btn-primary flex-1 justify-center">
              {loading ? 'Creating…' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function LobbyPage() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()

  const [rooms,       setRooms]       = useState([])
  const [joinCode,    setJoinCode]    = useState('')
  const [loading,     setLoading]     = useState(true)
  const [joinError,   setJoinError]   = useState('')
  const [joinLoading, setJoinLoading] = useState(false)
  const [showCreate,  setShowCreate]  = useState(false)

  useEffect(() => {
    roomsAPI.list()
      .then(({ data }) => setRooms(data.results || data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const handleJoin = async (e) => {
    e.preventDefault()
    const code = joinCode.trim().toUpperCase()
    if (!code) return
    setJoinLoading(true)
    setJoinError('')
    try {
      await roomsAPI.join(code)
      navigate(`/room/${code}`)
    } catch (err) {
      setJoinError(err.response?.status === 404 ? 'Room not found.' : 'Failed to join room.')
    } finally {
      setJoinLoading(false)
    }
  }

  const handleCreate = (room) => {
    setShowCreate(false)
    navigate(`/room/${room.code}`)
  }

  const handleEnter = (code) => navigate(`/room/${code}`)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Nav ── */}
      <nav className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center">
            <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"
                 strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
              <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
            </svg>
          </div>
          <span className="font-bold text-gray-900">Drawboard</span>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/profile" className="btn-ghost text-sm">
            <UserIcon />
            <span className="hidden sm:inline">{user?.username}</span>
          </Link>
          <button onClick={logout} className="btn-ghost text-sm text-gray-500">
            <LogOutIcon />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-10">
        {/* ── Header actions ── */}
        <div className="flex flex-col sm:flex-row gap-4 mb-10">
          {/* Join by code */}
          <form onSubmit={handleJoin} className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Join a room</label>
            <div className="flex gap-2">
              <input
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="ROOM CODE"
                maxLength={8}
                className="input-field font-mono tracking-widest uppercase flex-1"
              />
              <button type="submit" disabled={joinLoading || !joinCode.trim()}
                      className="btn-primary px-5">
                {joinLoading ? '…' : <ArrowIcon />}
              </button>
            </div>
            {joinError && <p className="text-xs text-red-500 mt-1">{joinError}</p>}
          </form>

          {/* Create */}
          <div className="flex items-end">
            <button onClick={() => setShowCreate(true)} className="btn-primary gap-2 h-10 px-5">
              <PlusIcon />
              New Room
            </button>
          </div>
        </div>

        {/* ── Room list ── */}
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
            Your Rooms
          </h2>

          {loading && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1,2,3].map((i) => (
                <div key={i} className="card p-4 animate-pulse">
                  <div className="w-10 h-10 bg-gray-200 rounded-xl mb-3" />
                  <div className="h-4 bg-gray-200 rounded mb-2 w-3/4" />
                  <div className="h-3 bg-gray-100 rounded w-1/2" />
                </div>
              ))}
            </div>
          )}

          {!loading && rooms.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <BoardIcon />
              <p className="mt-3 font-medium text-gray-500">No rooms yet</p>
              <p className="text-sm">Create one or join with a room code.</p>
            </div>
          )}

          {!loading && rooms.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {rooms.map((room) => (
                <RoomCard key={room.id} room={room} onEnter={handleEnter} />
              ))}
            </div>
          )}
        </div>
      </main>

      {showCreate && <CreateModal onClose={() => setShowCreate(false)} onCreate={handleCreate} />}
    </div>
  )
}
