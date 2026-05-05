import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

// ── Input field ───────────────────────────────────────────────────────────────
function Field({ label, type = 'text', value, onChange, placeholder, autoComplete }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="input-field"
        required
      />
    </div>
  )
}

// ── Error alert ───────────────────────────────────────────────────────────────
function ErrorAlert({ message }) {
  if (!message) return null
  return (
    <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
      {message}
    </div>
  )
}

// ── Login form ────────────────────────────────────────────────────────────────
function LoginForm({ onSuccess }) {
  const { login, guestLogin } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const result = await login(username, password)
    if (result.success) onSuccess()
    else setError(result.error)
    setLoading(false)
  }

  const handleGuest = async () => {
    setLoading(true)
    const result = await guestLogin()
    if (result.success) onSuccess()
    else setError(result.error)
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <ErrorAlert message={error} />
      <Field label="Username" value={username} onChange={(e) => setUsername(e.target.value)}
             placeholder="your_username" autoComplete="username" />
      <Field label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)}
             placeholder="••••••••" autoComplete="current-password" />
      <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-2.5">
        {loading ? 'Signing in…' : 'Sign in'}
      </button>
      <div className="relative flex items-center">
        <div className="flex-1 border-t border-gray-200" />
        <span className="px-3 text-xs text-gray-400">or</span>
        <div className="flex-1 border-t border-gray-200" />
      </div>
      <button type="button" onClick={handleGuest} disabled={loading}
              className="btn-secondary w-full justify-center py-2.5">
        Continue as Guest
      </button>
    </form>
  )
}

// ── Register form ─────────────────────────────────────────────────────────────
function RegisterForm({ onSuccess }) {
  const { register } = useAuth()
  const [form, setForm] = useState({
    username: '', email: '', password: '', password2: '',
    first_name: '', last_name: '',
    avatar_color: '#6366f1',
  })
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  const set = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (form.password !== form.password2) {
      setError('Passwords do not match.')
      return
    }
    setLoading(true)
    setError('')
    const result = await register(form)
    if (result.success) onSuccess()
    else setError(result.error)
    setLoading(false)
  }

  const COLORS = ['#6366f1','#ec4899','#f97316','#10b981','#3b82f6','#8b5cf6','#ef4444','#14b8a6']

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <ErrorAlert message={error} />
      <div className="grid grid-cols-2 gap-3">
        <Field label="First name" value={form.first_name} onChange={set('first_name')} placeholder="Jane" />
        <Field label="Last name"  value={form.last_name}  onChange={set('last_name')}  placeholder="Doe" />
      </div>
      <Field label="Username" value={form.username} onChange={set('username')}
             placeholder="jane_doe" autoComplete="username" />
      <Field label="Email" type="email" value={form.email} onChange={set('email')}
             placeholder="jane@example.com" autoComplete="email" />
      <Field label="Password" type="password" value={form.password} onChange={set('password')}
             placeholder="Min 8 characters" autoComplete="new-password" />
      <Field label="Confirm password" type="password" value={form.password2} onChange={set('password2')}
             placeholder="Repeat password" autoComplete="new-password" />

      {/* Avatar color */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Avatar color</label>
        <div className="flex gap-2 flex-wrap">
          {COLORS.map((c) => (
            <button key={c} type="button" onClick={() => setForm((p) => ({ ...p, avatar_color: c }))}
                    className="w-7 h-7 rounded-full border-2 transition-transform hover:scale-110"
                    style={{ background: c, borderColor: form.avatar_color === c ? '#1e1b4b' : 'transparent' }} />
          ))}
        </div>
      </div>

      <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-2.5">
        {loading ? 'Creating account…' : 'Create account'}
      </button>
    </form>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function LoginPage() {
  const navigate = useNavigate()
  const [tab, setTab] = useState('login')

  const onSuccess = () => navigate('/lobby')

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 via-white to-purple-50
                    flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-brand-600
                          rounded-2xl shadow-lg mb-4">
            <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"
                 strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7">
              <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Drawboard</h1>
          <p className="text-gray-500 text-sm mt-1">Real-time collaborative whiteboard</p>
        </div>

        {/* Card */}
        <div className="card p-6 shadow-xl">
          {/* Tabs */}
          <div className="flex bg-gray-100 rounded-xl p-1 mb-6">
            {['login', 'register'].map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all duration-150
                  ${tab === t ? 'bg-white text-brand-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                {t === 'login' ? 'Sign in' : 'Create account'}
              </button>
            ))}
          </div>

          {tab === 'login'
            ? <LoginForm    onSuccess={onSuccess} />
            : <RegisterForm onSuccess={onSuccess} />
          }
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          By continuing you agree to our Terms of Service & Privacy Policy
        </p>
      </div>
    </div>
  )
}
