'use client'

import { useState, useEffect } from 'react'
import type { PollLogEntry } from '@/types'

const STATUS_STYLES = {
  processed: 'bg-emerald-50 text-emerald-700',
  skipped:   'bg-slate-100 text-slate-600',
  error:     'bg-red-50 text-red-700',
  duplicate: 'bg-amber-50 text-amber-700',
}

const TABS = ['all', 'processed', 'error', 'skipped', 'duplicate'] as const
type Tab = typeof TABS[number]

function fmt(ts: string) {
  return new Date(ts).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'medium' })
}

export default function PollLogPage() {
  const [entries, setEntries] = useState<PollLogEntry[]>([])
  const [tab, setTab] = useState<Tab>('all')
  const [loading, setLoading] = useState(true)

  async function loadLog(status?: string) {
    setLoading(true)
    const url = `/api/poll-log?limit=100${status ? `&status=${status}` : ''}`
    const res = await fetch(url)
    setEntries(await res.json())
    setLoading(false)
  }

  useEffect(() => {
    loadLog(tab === 'all' ? undefined : tab)
  }, [tab])

  const counts = entries.reduce((acc, e) => {
    acc[e.status] = (acc[e.status] ?? 0) + 1
    return acc
  }, {} as Record<string, number>)

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Email Poll Log</h1>
        <p className="text-sm text-slate-500 mt-1">Audit trail of all automated email processing attempts.</p>
      </div>

      <div className="flex gap-2 mb-6">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold capitalize transition-colors ${
              tab === t ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}>
            {t}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex gap-4">
          {Object.entries(counts).map(([s, n]) => (
            <span key={s} className="text-xs text-slate-500">
              <span className={`inline-block px-2 py-0.5 rounded-md font-semibold capitalize mr-1 ${STATUS_STYLES[s as keyof typeof STATUS_STYLES] ?? ''}`}>{s}</span>
              {n}
            </span>
          ))}
          {loading && <span className="text-xs text-slate-400 ml-auto">Loading…</span>}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                {['Time', 'Subject', 'Sender', 'Vendor', 'Status', 'Error'].map(h => (
                  <th key={h} className="text-left px-6 py-3 text-slate-400 font-medium text-xs uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entries.length === 0 && !loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400 text-sm">No log entries found.</td>
                </tr>
              ) : null}
              {entries.map(entry => (
                <tr key={entry.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-3.5 text-slate-500 text-xs whitespace-nowrap">{fmt(entry.processed_at)}</td>
                  <td className="px-6 py-3.5 text-slate-700 max-w-[200px] truncate">{entry.subject ?? '—'}</td>
                  <td className="px-6 py-3.5 text-slate-600 text-xs font-mono">{entry.sender ?? '—'}</td>
                  <td className="px-6 py-3.5 font-semibold text-slate-800">{entry.matched_vendor ?? <span className="text-slate-400 font-normal">—</span>}</td>
                  <td className="px-6 py-3.5">
                    <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold capitalize ${STATUS_STYLES[entry.status]}`}>
                      {entry.status}
                    </span>
                  </td>
                  <td className="px-6 py-3.5 text-red-600 text-xs max-w-[200px] truncate">{entry.error_msg ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
