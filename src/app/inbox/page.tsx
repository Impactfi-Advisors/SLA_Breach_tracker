'use client'

import { useState, useEffect } from 'react'
import type { ParsedEvent } from '@/types'

type ToastType = 'success' | 'warning' | 'breach' | 'info'
interface ToastState { msg: string; type: ToastType }

const TOAST_STYLE: Record<ToastType, string> = {
  success: 'bg-emerald-50 border-emerald-300 text-emerald-800',
  warning: 'bg-amber-50 border-amber-300 text-amber-800',
  breach:  'bg-red-50 border-red-400 text-red-900',
  info:    'bg-blue-50 border-blue-300 text-blue-800',
}

export default function InboxPage() {
  const [rawEmail, setRawEmail] = useState('')
  const [parsed, setParsed] = useState<ParsedEvent | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<ToastState | null>(null)
  const [parsing, setParsing] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 6000)
    return () => clearTimeout(t)
  }, [toast])

  async function handleParse() {
    if (!rawEmail.trim()) return
    setParsing(true)
    setError(null)
    setParsed(null)
    try {
      const res = await fetch('/api/parse-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawEmail }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setParsed(data as ParsedEvent)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setParsing(false)
    }
  }

  async function handleSave() {
    if (!parsed) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...parsed, rawEmail }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      if (data.warning) {
        setToast({ msg: `Warning: ${data.warning}`, type: 'warning' })
      } else if (data.breachStatus === 'breached') {
        setToast({ msg: `SLA BREACH — Penalty: $${(data.penaltyUsd as number)?.toFixed(2)}`, type: 'breach' })
      } else if (data.breachStatus === 'within') {
        setToast({ msg: 'Outage resolved — within SLA.', type: 'success' })
      } else if (parsed.event_type === 'down') {
        setToast({ msg: 'Outage opened and logged.', type: 'info' })
      } else {
        setToast({ msg: 'Event saved successfully.', type: 'success' })
      }

      setRawEmail('')
      setParsed(null)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Email Inbox</h1>
        <p className="text-sm text-slate-500 mt-1">Parse a vendor notification email and log the outage event.</p>
      </div>

      {toast && (
        <div className={`mb-6 p-4 border rounded-xl flex justify-between items-start text-sm ${TOAST_STYLE[toast.type]}`}>
          <span className="font-medium leading-relaxed">{toast.msg}</span>
          <button className="ml-3 opacity-50 hover:opacity-100 shrink-0 text-lg leading-none" onClick={() => setToast(null)}>×</button>
        </div>
      )}

      {/* Step 1 */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm mb-4">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100">
          <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center shrink-0">1</span>
          <span className="font-semibold text-slate-800 text-sm">Paste vendor email</span>
        </div>
        <div className="p-6">
          <textarea
            className="w-full h-44 p-4 border border-slate-200 rounded-xl font-mono text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-y bg-slate-50 placeholder:text-slate-400"
            placeholder="Paste the full email text here..."
            value={rawEmail}
            onChange={e => setRawEmail(e.target.value)}
          />
          <div className="flex items-center justify-between mt-3">
            <span className="text-xs text-slate-400">{rawEmail.length.toLocaleString()} characters</span>
            <button
              className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm font-semibold transition-colors"
              onClick={handleParse}
              disabled={parsing || !rawEmail.trim()}
            >
              {parsing && <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              {parsing ? 'Parsing with AI…' : 'Parse Email'}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm font-medium">
          {error}
        </div>
      )}

      {/* Step 2 */}
      {parsed && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100">
            <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center shrink-0">2</span>
            <span className="font-semibold text-slate-800 text-sm">Review parsed result</span>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-slate-50 rounded-xl p-4">
                <div className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">Vendor</div>
                <div className="font-semibold text-slate-800">{parsed.vendor}</div>
              </div>
              <div className="bg-slate-50 rounded-xl p-4">
                <div className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">Product</div>
                <div className="font-semibold text-slate-800">{parsed.product}</div>
              </div>
              <div className="bg-slate-50 rounded-xl p-4">
                <div className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">Event Type</div>
                <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold ${
                  parsed.event_type === 'down' ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'
                }`}>
                  {parsed.event_type === 'down' ? '↓ DOWN' : '↑ UP'}
                </span>
              </div>
              <div className="bg-slate-50 rounded-xl p-4">
                <div className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">Timestamp</div>
                <div className="font-medium text-slate-700 text-sm">{new Date(parsed.timestamp).toLocaleString()}</div>
              </div>
            </div>
            <button
              className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:opacity-50 text-sm font-semibold transition-colors"
              onClick={handleSave}
              disabled={saving}
            >
              {saving && <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              {saving ? 'Logging event…' : 'Log Event'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
