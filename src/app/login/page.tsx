'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

function LoginForm() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      if (res.ok) {
        const next = searchParams.get('next') ?? '/'
        router.push(next)
        router.refresh()
      } else {
        const data = await res.json()
        setError(data.error ?? 'Login failed')
      }
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs font-semibold text-slate-500 mb-1.5">
          Admin Password
        </label>
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="Enter admin password"
          required
          autoFocus
          className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400 placeholder:text-slate-400"
        />
      </div>
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          {error}
        </div>
      )}
      <button
        type="submit"
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-3 rounded-xl hover:bg-indigo-700 disabled:opacity-50 text-sm font-semibold transition-colors"
      >
        {loading && <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
        {loading ? 'Signing in…' : 'Sign In'}
      </button>
    </form>
  )
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center mx-auto mb-4">
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
              <rect x="3" y="3" width="7" height="7" rx="1.5" fill="white" fillOpacity="0.9"/>
              <rect x="12" y="3" width="7" height="7" rx="1.5" fill="white" fillOpacity="0.9"/>
              <rect x="3" y="12" width="7" height="7" rx="1.5" fill="white" fillOpacity="0.9"/>
              <rect x="12" y="12" width="7" height="7" rx="1.5" fill="white" fillOpacity="0.9"/>
            </svg>
          </div>
          <h1 className="text-xl font-bold text-slate-900">SLA Tracker</h1>
          <p className="text-sm text-slate-500 mt-1">Admin access</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <Suspense>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </div>
  )
}
