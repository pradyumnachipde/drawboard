import { useEffect, useRef, useState, useCallback } from 'react'

export const WS_STATES = {
  CONNECTING: 'connecting',
  OPEN: 'open',
  CLOSED: 'closed',
  RECONNECTING: 'reconnecting',
}

const RECONNECT_DELAYS = [1000, 2000, 4000, 8000, 15000]

export function useWebSocket(url, options = {}) {
  const { onMessage, onOpen, onClose, onError, enabled = true } = options
  const ws = useRef(null)
  const [readyState, setReadyState] = useState(WS_STATES.CONNECTING)
  const [lastMessage, setLastMessage] = useState(null)
  const reconnectAttempt = useRef(0)
  const reconnectTimer = useRef(null)
  const shouldReconnect = useRef(true)
  const urlRef = useRef(url)
  urlRef.current = url

  const connect = useCallback(() => {
    if (!shouldReconnect.current || !enabled) return

    setReadyState(
      reconnectAttempt.current > 0 ? WS_STATES.RECONNECTING : WS_STATES.CONNECTING
    )

    try {
      ws.current = new WebSocket(urlRef.current)
    } catch (err) {
      setReadyState(WS_STATES.CLOSED)
      return
    }

    ws.current.onopen = (e) => {
      setReadyState(WS_STATES.OPEN)
      reconnectAttempt.current = 0
      onOpen?.(e)
    }

    ws.current.onmessage = (e) => {
      setLastMessage(e)
      onMessage?.(e)
    }

    ws.current.onclose = (e) => {
      setReadyState(WS_STATES.CLOSED)
      onClose?.(e)
      // Don't reconnect on auth/not-found errors
      if (!shouldReconnect.current || e.code === 4001 || e.code === 4003 || e.code === 4004) return
      const delay = RECONNECT_DELAYS[Math.min(reconnectAttempt.current, RECONNECT_DELAYS.length - 1)]
      reconnectAttempt.current += 1
      reconnectTimer.current = setTimeout(connect, delay)
    }

    ws.current.onerror = (e) => {
      onError?.(e)
      ws.current?.close()
    }
  }, [enabled, onMessage, onOpen, onClose, onError])

  useEffect(() => {
    if (!enabled) return
    shouldReconnect.current = true
    connect()
    return () => {
      shouldReconnect.current = false
      clearTimeout(reconnectTimer.current)
      ws.current?.close()
    }
  }, [connect, enabled])

  const sendMessage = useCallback((data) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(typeof data === 'string' ? data : JSON.stringify(data))
      return true
    }
    return false
  }, [])

  const sendJSON = useCallback((obj) => sendMessage(JSON.stringify(obj)), [sendMessage])

  return { sendMessage, sendJSON, lastMessage, readyState }
}
