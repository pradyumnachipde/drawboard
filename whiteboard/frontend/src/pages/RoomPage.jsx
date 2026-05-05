import React, { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { roomsAPI } from '../api'
import WhiteboardCanvas from '../components/WhiteboardCanvas'

function Spinner() {
  return (
    <div className="h-screen flex flex-col items-center justify-center bg-gray-50 gap-3">
      <div className="w-10 h-10 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
      <p className="text-sm text-gray-500">Loading room…</p>
    </div>
  )
}

function NotFound({ code }) {
  return (
    <div className="h-screen flex flex-col items-center justify-center bg-gray-50 gap-4">
      <div className="text-6xl">🚫</div>
      <h1 className="text-2xl font-bold text-gray-800">Room not found</h1>
      <p className="text-gray-500">Room <code className="font-mono bg-gray-100 px-2 py-0.5 rounded">{code}</code> doesn't exist or is no longer active.</p>
      <Link to="/lobby" className="btn-primary mt-2">Back to Lobby</Link>
    </div>
  )
}

export default function RoomPage() {
  const { code }   = useParams()
  const navigate   = useNavigate()
  const [room,     setRoom]     = useState(null)
  const [loading,  setLoading]  = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    const load = async () => {
      try {
        // Try to join (idempotent — returns 200 if already a member)
        await roomsAPI.join(code)
        const { data } = await roomsAPI.get(code)
        setRoom(data)
      } catch (err) {
        if (err.response?.status === 404) setNotFound(true)
        else {
          console.error(err)
          navigate('/lobby')
        }
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [code, navigate])

  if (loading)  return <Spinner />
  if (notFound) return <NotFound code={code} />

  return (
    <WhiteboardCanvas
      roomCode={code}
      roomName={room?.name}
    />
  )
}
