'use client'

import { useState } from 'react'
import type { ParsedEvent } from '@/types'

export default function InboxPage() {
  const [rawEmail, setRawEmail] = useState('')
  const [parsed, setParsed] = useState<ParsedEvent | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [parsing, setParsing] = useState(false)
  const [saving, setSaving] = useState(false)

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

      let msg: string
      if (data.warning) {
        msg = `Saved. Warning: ${data.warning}`
      } else if (data.breachStatus === 'breached') {
        msg = `Outage resolved. BREACH DETECTED. Penalty: $${(data.penaltyUsd as number)?.toFixed(2)}`
      } else if (data.breachStatus === 'within') {
        msg = 'Outage resolved. Within SLA.'
      } else if (parsed.event_type === 'down') {
        msg = 'New outage opened.'
      } else {
        msg = 'Event saved.'
      }

      setToast(msg)
      setRawEmail('')
      setParsed(null)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-bold mb-6 text-gray-800">Email Inbox</h1>

      {toast && (
        <div className="mb-4 p-3 bg-green-100 border border-green-400 rounded text-green-800 flex justify-between items-start">
          <span>{toast}</span>
          <button
            className="ml-3 text-green-600 hover:text-green-800"
            onClick={() => setToast(null)}
          >
            ✕
          </button>
        </div>
      )}

      <label className="block text-sm font-medium text-gray-700 mb-1">
        Paste raw vendor email
      </label>
      <textarea
        className="w-full h-48 p-3 border border-gray-300 rounded font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-y"
        placeholder="Paste the full email text here..."
        value={rawEmail}
        onChange={e => setRawEmail(e.target.value)}
      />

      <button
        className="mt-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 text-sm"
        onClick={handleParse}
        disabled={parsing || !rawEmail.trim()}
      >
        {parsing ? 'Parsing...' : 'Parse Email'}
      </button>

      {error && (
        <div className="mt-3 p-3 bg-red-100 border border-red-400 rounded text-red-700 text-sm">
          {error}
        </div>
      )}

      {parsed && (
        <div className="mt-4 p-4 bg-white border border-gray-200 rounded shadow-sm">
          <h2 className="font-semibold mb-3 text-gray-700">Parsed Result</h2>
          <table className="text-sm w-full mb-3">
            <tbody>
              <tr>
                <td className="text-gray-500 pr-4 py-1 w-24">Vendor</td>
                <td className="font-medium">{parsed.vendor}</td>
              </tr>
              <tr>
                <td className="text-gray-500 pr-4 py-1">Product</td>
                <td className="font-medium">{parsed.product}</td>
              </tr>
              <tr>
                <td className="text-gray-500 pr-4 py-1">Event</td>
                <td className={`font-bold ${parsed.event_type === 'down' ? 'text-red-600' : 'text-green-600'}`}>
                  {parsed.event_type.toUpperCase()}
                </td>
              </tr>
              <tr>
                <td className="text-gray-500 pr-4 py-1">Timestamp</td>
                <td className="font-medium">{new Date(parsed.timestamp).toLocaleString()}</td>
              </tr>
            </tbody>
          </table>
          <button
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 text-sm"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Log Event'}
          </button>
        </div>
      )}
    </div>
  )
}
