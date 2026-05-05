import { useEffect, useRef, useState, useCallback } from 'react'
import { useWebSocket } from './useWebSocket'

const WS_BASE = process.env.REACT_APP_WS_URL || 'ws://localhost:8000'
const TYPING_TIMEOUT = 2000 // ms before "typing" indicator clears

export function useChat(roomCode, token) {
  const [messages,       setMessages]       = useState([])
  const [typingUsers,    setTypingUsers]    = useState({}) // userId → username
  const [wsState,        setWsState]        = useState('connecting')
  const typingTimers     = useRef({})
  const typingDebounce   = useRef(null)
  const isTypingRef      = useRef(false)

  const wsUrl = token
    ? `${WS_BASE}/ws/chat/${roomCode}/?token=${token}`
    : null

  const { sendJSON, lastMessage } = useWebSocket(wsUrl, {
    enabled: !!token,
    onOpen:  () => setWsState('open'),
    onClose: () => setWsState('closed'),
  })

  // ── Incoming WS messages ──────────────────────────────────────────────────
  useEffect(() => {
    if (!lastMessage) return
    let data
    try { data = JSON.parse(lastMessage.data) } catch { return }

    switch (data.type) {
      case 'history':
        setMessages(data.messages || [])
        break

      case 'chat_message':
        setMessages((prev) => {
          // Deduplicate by id
          if (prev.some((m) => m.id === data.id)) return prev
          return [...prev, {
            id:        data.id,
            text:      data.text,
            username:  data.username,
            user_id:   data.user_id,
            color:     data.color,
            timestamp: data.timestamp,
          }]
        })
        break

      case 'typing':
        if (data.is_typing) {
          setTypingUsers((prev) => ({ ...prev, [data.user_id]: data.username }))
          // Auto-clear after timeout if no follow-up
          clearTimeout(typingTimers.current[data.user_id])
          typingTimers.current[data.user_id] = setTimeout(() => {
            setTypingUsers((prev) => {
              const next = { ...prev }
              delete next[data.user_id]
              return next
            })
          }, TYPING_TIMEOUT + 500)
        } else {
          clearTimeout(typingTimers.current[data.user_id])
          setTypingUsers((prev) => {
            const next = { ...prev }
            delete next[data.user_id]
            return next
          })
        }
        break

      default: break
    }
  }, [lastMessage])

  // ── Send a message ────────────────────────────────────────────────────────
  const sendMessage = useCallback((text) => {
    const trimmed = text.trim()
    if (!trimmed) return false
    sendJSON({ type: 'chat_message', text: trimmed })
    // Stop typing indicator
    if (isTypingRef.current) {
      isTypingRef.current = false
      sendJSON({ type: 'typing', is_typing: false })
    }
    clearTimeout(typingDebounce.current)
    return true
  }, [sendJSON])

  // ── Typing indicator ──────────────────────────────────────────────────────
  const notifyTyping = useCallback(() => {
    if (!isTypingRef.current) {
      isTypingRef.current = true
      sendJSON({ type: 'typing', is_typing: true })
    }
    clearTimeout(typingDebounce.current)
    typingDebounce.current = setTimeout(() => {
      isTypingRef.current = false
      sendJSON({ type: 'typing', is_typing: false })
    }, TYPING_TIMEOUT)
  }, [sendJSON])

  // ── Cleanup ───────────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      clearTimeout(typingDebounce.current)
      Object.values(typingTimers.current).forEach(clearTimeout)
    }
  }, [])

  return {
    messages,
    typingUsers,
    wsState,
    sendMessage,
    notifyTyping,
  }
}
