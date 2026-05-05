import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { authAPI } from '../api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // ── Bootstrap: restore session from localStorage ──────────────────────────
  useEffect(() => {
    const restore = async () => {
      const accessToken = localStorage.getItem('access_token')
      if (!accessToken) {
        setLoading(false)
        return
      }
      try {
        const { data } = await authAPI.me()
        setUser(data)
      } catch {
        localStorage.removeItem('access_token')
        localStorage.removeItem('refresh_token')
        localStorage.removeItem('user')
      } finally {
        setLoading(false)
      }
    }
    restore()
  }, [])

  const storeTokens = (access, refresh, userData) => {
    localStorage.setItem('access_token', access)
    localStorage.setItem('refresh_token', refresh)
    localStorage.setItem('user', JSON.stringify(userData))
    setUser(userData)
    setError(null)
  }

  const login = useCallback(async (username, password) => {
    setError(null)
    try {
      const { data } = await authAPI.login({ username, password })
      storeTokens(data.access, data.refresh, data.user || (await authAPI.me()).data)
      return { success: true }
    } catch (err) {
      const msg = err.response?.data?.detail || err.response?.data?.non_field_errors?.[0] || 'Login failed.'
      setError(msg)
      return { success: false, error: msg }
    }
  }, [])

  const register = useCallback(async (formData) => {
    setError(null)
    try {
      const { data } = await authAPI.register(formData)
      storeTokens(data.access, data.refresh, data.user)
      return { success: true }
    } catch (err) {
      const errors = err.response?.data
      const msg = typeof errors === 'object'
        ? Object.values(errors).flat().join(' ')
        : 'Registration failed.'
      setError(msg)
      return { success: false, error: msg }
    }
  }, [])

  const guestLogin = useCallback(async () => {
    setError(null)
    try {
      const { data } = await authAPI.guestLogin()
      storeTokens(data.access, data.refresh, data.user)
      return { success: true }
    } catch (err) {
      const msg = 'Guest login failed.'
      setError(msg)
      return { success: false, error: msg }
    }
  }, [])

  const logout = useCallback(async () => {
    const refresh = localStorage.getItem('refresh_token')
    try {
      if (refresh) await authAPI.logout(refresh)
    } catch {
      // Best-effort
    } finally {
      localStorage.clear()
      setUser(null)
    }
  }, [])

  const updateUser = useCallback(async (data) => {
    try {
      const { data: updated } = await authAPI.updateMe(data)
      setUser(updated)
      localStorage.setItem('user', JSON.stringify(updated))
      return { success: true }
    } catch (err) {
      return { success: false, error: err.response?.data }
    }
  }, [])

  const getWsToken = () => localStorage.getItem('access_token')

  const value = {
    user,
    loading,
    error,
    isAuthenticated: !!user,
    isGuest: user?.is_guest ?? false,
    login,
    register,
    guestLogin,
    logout,
    updateUser,
    getWsToken,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
