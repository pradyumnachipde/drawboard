import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { authAPI } from '../api'

const COLORS = [
  '#6366f1','#ec4899','#f97316','#10b981','#3b82f6',
  '#8b5cf6','#ef4444','#14b8a6','#f59e0b','#06b6d4',
]

function Field({ label, ...props }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input className="input-field" {...props} />
    </div>
  )
}

function Alert({ type, message }) {
  if (!message) return null
  const s = type === 'success'
    ? 'bg-green-50 border-green-200 text-green-700'
    : 'bg-red-50 border-red-200 text-red-700'
  return <div className={`border text-sm px-4 py-3 rounded-lg ${s}`}>{message}</div>
}

function BackIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
         strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
    </svg>
  )
}

export default function ProfilePage() {
  const { user, updateUser, logout } = useAuth()

  const [profile, setProfile] = useState({
    first_name:   user?.first_name   || '',
    last_name:    user?.last_name    || '',
    bio:          user?.bio          || '',
    avatar_color: user?.avatar_color || '#6366f1',
  })
  const [profileMsg, setProfileMsg] = useState({ type: '', text: '' })
  const [saving, setSaving] = useState(false)

  const [pwForm, setPwForm] = useState({ old_password: '', new_password: '', confirm: '' })
  const [pwMsg, setPwMsg]   = useState({ type: '', text: '' })
  const [pwSaving, setPwSaving] = useState(false)

  const handleProfileSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    setProfileMsg({ type: '', text: '' })
    const result = await updateUser({
      first_name:   profile.first_name,
      last_name:    profile.last_name,
      bio:          profile.bio,
      avatar_color: profile.avatar_color,
    })
    if (result.success) setProfileMsg({ type: 'success', text: 'Profile updated!' })
    else setProfileMsg({ type: 'error', text: 'Update failed. Please try again.' })
    setSaving(false)
  }

  const handlePasswordSave = async (e) => {
    e.preventDefault()
    if (pwForm.new_password !== pwForm.confirm) {
      setPwMsg({ type: 'error', text: 'New passwords do not match.' })
      return
    }
    setPwSaving(true)
    setPwMsg({ type: '', text: '' })
    try {
      await authAPI.changePassword({
        old_password: pwForm.old_password,
        new_password: pwForm.new_password,
      })
      setPwMsg({ type: 'success', text: 'Password changed successfully.' })
      setPwForm({ old_password: '', new_password: '', confirm: '' })
    } catch (err) {
      const msg = err.response?.data?.old_password?.[0]
        || err.response?.data?.new_password?.[0]
        || 'Failed to change password.'
      setPwMsg({ type: 'error', text: msg })
    } finally {
      setPwSaving(false)
    }
  }

  const initials = (profile.first_name?.[0] || user?.username?.[0] || '?').toUpperCase()

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Nav */}
      <nav className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-4">
        <Link to="/lobby" className="btn-ghost text-sm">
          <BackIcon />
          Back to Lobby
        </Link>
        <span className="text-gray-300">|</span>
        <span className="font-semibold text-gray-800">Profile</span>
      </nav>

      <main className="max-w-2xl mx-auto px-6 py-10 space-y-6">

        {/* Avatar preview */}
        <div className="card p-6 flex items-center gap-5">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-bold
                       text-white shadow-lg flex-shrink-0"
            style={{ background: profile.avatar_color }}
          >
            {initials}
          </div>
          <div>
            <p className="font-bold text-gray-900 text-lg">{user?.username}</p>
            <p className="text-sm text-gray-500">{user?.email}</p>
            {user?.is_guest && (
              <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium mt-1 inline-block">
                Guest account
              </span>
            )}
          </div>
        </div>

        {/* Profile form */}
        <div className="card p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-5">Edit Profile</h2>
          <form onSubmit={handleProfileSave} className="space-y-4">
            <Alert type={profileMsg.type} message={profileMsg.text} />
            <div className="grid grid-cols-2 gap-4">
              <Field label="First name" value={profile.first_name}
                     onChange={(e) => setProfile((p) => ({ ...p, first_name: e.target.value }))} />
              <Field label="Last name"  value={profile.last_name}
                     onChange={(e) => setProfile((p) => ({ ...p, last_name:  e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bio</label>
              <textarea
                value={profile.bio}
                onChange={(e) => setProfile((p) => ({ ...p, bio: e.target.value }))}
                rows={3}
                placeholder="Tell people a bit about yourself…"
                className="input-field resize-none"
              />
            </div>
            {/* Avatar color picker */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Avatar color</label>
              <div className="flex gap-2 flex-wrap">
                {COLORS.map((c) => (
                  <button
                    key={c} type="button"
                    onClick={() => setProfile((p) => ({ ...p, avatar_color: c }))}
                    className="w-8 h-8 rounded-full border-4 transition-transform hover:scale-110"
                    style={{
                      background: c,
                      borderColor: profile.avatar_color === c ? '#1e1b4b' : 'transparent',
                    }}
                  />
                ))}
              </div>
            </div>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </form>
        </div>

        {/* Change password (hidden for guest) */}
        {!user?.is_guest && (
          <div className="card p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-5">Change Password</h2>
            <form onSubmit={handlePasswordSave} className="space-y-4">
              <Alert type={pwMsg.type} message={pwMsg.text} />
              <Field label="Current password" type="password"
                     value={pwForm.old_password}
                     onChange={(e) => setPwForm((p) => ({ ...p, old_password: e.target.value }))}
                     autoComplete="current-password" />
              <Field label="New password" type="password"
                     value={pwForm.new_password}
                     onChange={(e) => setPwForm((p) => ({ ...p, new_password: e.target.value }))}
                     autoComplete="new-password" />
              <Field label="Confirm new password" type="password"
                     value={pwForm.confirm}
                     onChange={(e) => setPwForm((p) => ({ ...p, confirm: e.target.value }))}
                     autoComplete="new-password" />
              <button type="submit" disabled={pwSaving} className="btn-primary">
                {pwSaving ? 'Updating…' : 'Update password'}
              </button>
            </form>
          </div>
        )}

        {/* Danger zone */}
        <div className="card p-6 border-red-200">
          <h2 className="text-base font-semibold text-red-700 mb-2">Sign out</h2>
          <p className="text-sm text-gray-500 mb-4">
            You will be returned to the login page. Your rooms and whiteboards will be saved.
          </p>
          <button onClick={logout} className="px-4 py-2 rounded-lg border border-red-300 text-red-600
                                              text-sm font-medium hover:bg-red-50 transition-colors">
            Sign out everywhere
          </button>
        </div>
      </main>
    </div>
  )
}
