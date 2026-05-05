import React, { useState } from 'react'

function Avatar({ user, size = 'md' }) {
  const sz = size === 'sm' ? 'w-7 h-7 text-xs' : 'w-9 h-9 text-sm'
  const initials = user.username.slice(0, 2).toUpperCase()
  return (
    <div
      title={user.username}
      className={`${sz} rounded-full flex items-center justify-center font-semibold
                  text-white border-2 border-white shadow-sm flex-shrink-0 cursor-default select-none`}
      style={{ background: user.color || '#6366f1' }}
    >
      {initials}
    </div>
  )
}

export default function PresenceBar({ users = [], roomCode, roomName }) {
  const [showList, setShowList] = useState(false)
  const MAX_SHOWN = 5
  const shown   = users.slice(0, MAX_SHOWN)
  const overflow = users.length - MAX_SHOWN

  return (
    <div className="absolute top-3 right-3 z-30 flex items-center gap-2">
      {/* Room info */}
      <div className="hidden sm:flex items-center gap-2 bg-white border border-gray-200
                      rounded-xl px-3 py-2 shadow-sm">
        <span className="text-xs text-gray-500 font-medium">Room</span>
        <code className="text-xs font-mono font-bold text-brand-600 bg-brand-50 px-1.5 py-0.5 rounded">
          {roomCode}
        </code>
        {roomName && (
          <span className="text-xs text-gray-700 font-medium max-w-[120px] truncate">
            {roomName}
          </span>
        )}
      </div>

      {/* Avatars */}
      <div
        className="relative flex items-center bg-white border border-gray-200
                   rounded-xl px-3 py-1.5 shadow-sm cursor-pointer hover:border-brand-300
                   transition-colors"
        onClick={() => setShowList((v) => !v)}
      >
        <div className="flex -space-x-2">
          {shown.map((u) => <Avatar key={u.id} user={u} size="sm" />)}
          {overflow > 0 && (
            <div className="w-7 h-7 rounded-full bg-gray-200 border-2 border-white flex items-center
                            justify-center text-xs font-semibold text-gray-600">
              +{overflow}
            </div>
          )}
        </div>
        <div className="ml-2 flex items-center gap-1">
          <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse-dot" />
          <span className="text-xs text-gray-600 font-medium">{users.length}</span>
        </div>

        {/* Dropdown list */}
        {showList && users.length > 0 && (
          <div
            className="absolute top-full right-0 mt-2 bg-white border border-gray-200 rounded-xl
                       shadow-xl py-2 w-52 animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-xs text-gray-400 px-3 pb-1 font-medium uppercase tracking-wide">
              Online ({users.length})
            </p>
            {users.map((u) => (
              <div key={u.id} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50">
                <Avatar user={u} size="sm" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{u.username}</p>
                  {u.is_guest && (
                    <p className="text-xs text-gray-400">Guest</p>
                  )}
                </div>
                <span className="ml-auto w-2 h-2 bg-green-400 rounded-full flex-shrink-0" />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
