import React, { Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'

// Lazy-load pages for code splitting
const LoginPage    = lazy(() => import('./pages/LoginPage'))
const LobbyPage    = lazy(() => import('./pages/LobbyPage'))
const RoomPage     = lazy(() => import('./pages/RoomPage'))
const ProfilePage  = lazy(() => import('./pages/ProfilePage'))

// ── Spinner ───────────────────────────────────────────────────────────────────
function Spinner({ fullscreen = false }) {
  return (
    <div className={`flex items-center justify-center ${fullscreen ? 'h-screen' : 'h-full'}`}>
      <div className="w-8 h-8 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
    </div>
  )
}

// ── Protected route wrapper ───────────────────────────────────────────────────
function ProtectedLayout() {
  const { isAuthenticated, loading } = useAuth()
  if (loading) return <Spinner fullscreen />
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <Outlet />
}

// ── Public-only route (redirect authed users away from login) ─────────────────
function PublicLayout() {
  const { isAuthenticated, loading } = useAuth()
  if (loading) return <Spinner fullscreen />
  if (isAuthenticated) return <Navigate to="/lobby" replace />
  return <Outlet />
}

// ── App shell ─────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Suspense fallback={<Spinner fullscreen />}>
          <Routes>
            {/* Public */}
            <Route element={<PublicLayout />}>
              <Route path="/login"    element={<LoginPage />} />
            </Route>

            {/* Protected */}
            <Route element={<ProtectedLayout />}>
              <Route path="/lobby"          element={<LobbyPage />} />
              <Route path="/room/:code"     element={<RoomPage />} />
              <Route path="/profile"        element={<ProfilePage />} />
            </Route>

            {/* Catch-all */}
            <Route path="*" element={<Navigate to="/lobby" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  )
}
