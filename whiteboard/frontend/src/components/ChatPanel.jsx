import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useChat } from '../hooks/useChat'
import { useAuth } from '../contexts/AuthContext'

// ── Send icon ─────────────────────────────────────────────────────────────────
const SendIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
       strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
    <line x1="22" y1="2" x2="11" y2="13"/>
    <polygon points="22 2 15 22 11 13 2 9 22 2"/>
  </svg>
)

const CloseIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
       strokeLinecap="round" className="w-4 h-4">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
)

const ChatIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
       strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
  </svg>
)

// ── Typing dots animation ─────────────────────────────────────────────────────
function TypingDots() {
  return (
    <span className="inline-flex items-end gap-0.5 h-3">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-1 h-1 bg-gray-400 rounded-full animate-bounce"
          style={{ animationDelay: `${i * 150}ms`, animationDuration: '0.9s' }}
        />
      ))}
    </span>
  )
}

// ── Single message bubble ─────────────────────────────────────────────────────
function MessageBubble({ msg, isOwn }) {
  const time = new Date(msg.timestamp).toLocaleTimeString([], {
    hour: '2-digit', minute: '2-digit'
  })

  return (
    <div className={`flex items-end gap-2 ${isOwn ? 'flex-row-reverse' : 'flex-row'} mb-1`}>
      {/* Avatar */}
      {!isOwn && (
        <div
          className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center
                     text-white text-xs font-bold"
          style={{ background: msg.color || '#6366f1' }}
          title={msg.username}
        >
          {msg.username.slice(0, 1).toUpperCase()}
        </div>
      )}

      <div className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'} max-w-[80%]`}>
        {!isOwn && (
          <span className="text-xs text-gray-400 mb-0.5 ml-1">{msg.username}</span>
        )}
        <div
          className={`px-3 py-2 rounded-2xl text-sm leading-relaxed break-words
            ${isOwn
              ? 'bg-brand-600 text-white rounded-br-sm'
              : 'bg-gray-100 text-gray-800 rounded-bl-sm'
            }`}
        >
          {msg.text}
        </div>
        <span className="text-xs text-gray-300 mt-0.5 mx-1">{time}</span>
      </div>
    </div>
  )
}

// ── Main ChatPanel component ──────────────────────────────────────────────────
export default function ChatPanel({ roomCode, token }) {
  const { user } = useAuth()
  const { messages, typingUsers, sendMessage, notifyTyping } = useChat(roomCode, token)
  const [input,   setInput]   = useState('')
  const [isOpen,  setIsOpen]  = useState(false)
  const [unread,  setUnread]  = useState(0)
  const messagesEndRef = useRef(null)
  const inputRef       = useRef(null)
  const prevLenRef     = useRef(0)

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Unread badge when panel is closed
  useEffect(() => {
    if (!isOpen && messages.length > prevLenRef.current) {
      setUnread((u) => u + (messages.length - prevLenRef.current))
    }
    prevLenRef.current = messages.length
  }, [messages, isOpen])

  const handleOpen = () => {
    setIsOpen(true)
    setUnread(0)
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  const handleSend = useCallback(() => {
    if (sendMessage(input)) setInput('')
  }, [input, sendMessage])

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleInputChange = (e) => {
    setInput(e.target.value)
    if (e.target.value) notifyTyping()
  }

  const typingList = Object.entries(typingUsers)
    .filter(([id]) => id !== String(user?.id))
    .map(([, name]) => name)

  return (
    <>
      {/* ── Toggle button ── */}
      {!isOpen && (
        <button
          onClick={handleOpen}
          className="absolute bottom-4 right-4 z-30 w-12 h-12 rounded-full bg-brand-600
                     text-white shadow-lg hover:bg-brand-700 active:scale-95 transition-all
                     flex items-center justify-center"
          aria-label="Open chat"
        >
          <ChatIcon />
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full
                             text-xs font-bold flex items-center justify-center">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </button>
      )}

      {/* ── Chat panel ── */}
      {isOpen && (
        <div
          className="absolute bottom-4 right-4 z-30 w-80 h-[480px] bg-white border
                     border-gray-200 rounded-2xl shadow-2xl flex flex-col overflow-hidden
                     animate-slide-up"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-white">
            <div className="flex items-center gap-2">
              <ChatIcon />
              <span className="font-semibold text-gray-800 text-sm">Room Chat</span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <CloseIcon />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <ChatIcon />
                <p className="text-sm text-gray-400 mt-2">No messages yet.</p>
                <p className="text-xs text-gray-300">Be the first to say hello!</p>
              </div>
            )}
            {messages.map((msg) => (
              <MessageBubble
                key={msg.id}
                msg={msg}
                isOwn={msg.user_id === String(user?.id)}
              />
            ))}

            {/* Typing indicator */}
            {typingList.length > 0 && (
              <div className="flex items-center gap-2 px-2 py-1">
                <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-xs">
                  {typingList[0][0].toUpperCase()}
                </div>
                <div className="bg-gray-100 rounded-2xl rounded-bl-sm px-3 py-2">
                  <TypingDots />
                </div>
                <span className="text-xs text-gray-400">
                  {typingList.length === 1
                    ? `${typingList[0]} is typing`
                    : `${typingList.length} people are typing`}
                </span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="px-3 pb-3 pt-2 border-t border-gray-100">
            <div className="flex items-end gap-2 bg-gray-50 rounded-xl px-3 py-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder="Type a message…"
                rows={1}
                className="flex-1 bg-transparent text-sm text-gray-800 placeholder-gray-400
                           resize-none outline-none max-h-20 leading-5"
                style={{ lineHeight: '1.25rem' }}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim()}
                className="flex-shrink-0 w-8 h-8 rounded-lg bg-brand-600 text-white
                           flex items-center justify-center hover:bg-brand-700
                           disabled:opacity-40 disabled:cursor-not-allowed
                           active:scale-95 transition-all"
              >
                <SendIcon />
              </button>
            </div>
            <p className="text-xs text-gray-300 mt-1 text-center">Enter to send · Shift+Enter for newline</p>
          </div>
        </div>
      )}
    </>
  )
}
