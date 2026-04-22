'use client'

import { useState, useEffect } from 'react'
import type { Outage, SLARule } from '@/types'

interface PortalData {
  bank: { id: number; name: string }
  stats: {
    activeOutages: number
    penaltyThisMonth: number
    breachedThisMonth: number
    resolvedThisMonth: number
    withinThisMonth: number
    month: number
    year: number
  }
  slaRules: SLARule[]
  outages: Outage[]
}

type FilterTab = 'all' | 'active' | 'breached' | 'within'

function StatusBadge({ status, isActive }: { status: Outage['breach_status']; isActive: boolean }) {
  if (isActive) return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">ACTIVE</span>
  const styles: Record<string, string> = {
    within: 'bg-emerald-100 text-emerald-700',
    breached: 'bg-red-100 text-red-700',
    pending: 'bg-slate-100 text-slate-500',
  }
  const s = status ?? 'pending'
  return <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${styles[s]}`}>{s.toUpperCase()}</span>
}

function formatDuration(mins: number | null, resolvedAt: string | null): string {
  if (!resolvedAt) return 'Ongoing'
  if (mins == null) return '—'
  if (mins < 60) return `${mins}m`
  const h = Math.floor(mins / 60), m = mins % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

function fmt(ts: string) {
  return new Date(ts).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })
}

const MONTH_NAMES = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export default function PortalPage({ params }: { params: { token: string } }) {
  const [data, setData] = useState<PortalData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<FilterTab>('all')

  useEffect(() => {
    fetch(`/api/portal/${params.token}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) setError(d.error)
        else setData(d)
      })
      .catch(() => setError('Failed to load portal data'))
  }, [params.token])

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center p-8">
          <div className="w-16 h-16 rounded-2xl bg-red-100 flex items-center justify-center mx-auto mb-4">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="#ef4444" strokeWidth="1.5"/>
              <path d="M12 8v5M12 16h.01" stroke="#ef4444" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
          <h2 className="text-lg font-bold text-slate-900 mb-2">Portal Unavailable</h2>
          <p className="text-slate-500 text-sm">{error}</p>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex items-center gap-3 text-slate-500">
          <span className="w-5 h-5 border-2 border-slate-300 border-t-indigo-500 rounded-full animate-spin" />
          Loading…
        </div>
      </div>
    )
  }

  const { bank, stats, slaRules, outages } = data

  const filtered = outages.filter(o => {
    if (tab === 'active') return !o.resolved_at
    if (tab === 'breached') return o.breach_status === 'breached'
    if (tab === 'within') return o.breach_status === 'within'
    return true
  })

  const tabCounts: Record<FilterTab, number> = {
    all: outages.length,
    active: outages.filter(o => !o.resolved_at).length,
    breached: outages.filter(o => o.breach_status === 'breached').length,
    within: outages.filter(o => o.breach_status === 'within').length,
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-100 shadow-sm">
        <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-indigo-600 uppercase tracking-widest mb-1">SLA Portal</div>
            <h1 className="text-xl font-bold text-slate-900">{bank.name}</h1>
          </div>
          <div className="text-right">
            <div className="text-xs text-slate-400">Viewing period</div>
            <div className="text-sm font-semibold text-slate-700">
              {MONTH_NAMES[stats.month]} {stats.year}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 mb-8 sm:grid-cols-4">
          <div className={`bg-white rounded-2xl border shadow-sm p-5 ${stats.activeOutages > 0 ? 'border-amber-200' : 'border-slate-100'}`}>
            <div className={`text-2xl font-bold mb-1 ${stats.activeOutages > 0 ? 'text-amber-600' : 'text-slate-900'}`}>
              {stats.activeOutages}
            </div>
            <div className="text-xs text-slate-500 font-medium">Active Outages</div>
          </div>
          <div className={`bg-white rounded-2xl border shadow-sm p-5 ${stats.penaltyThisMonth > 0 ? 'border-red-200' : 'border-slate-100'}`}>
            <div className={`text-2xl font-bold mb-1 ${stats.penaltyThisMonth > 0 ? 'text-red-600' : 'text-slate-900'}`}>
              ${stats.penaltyThisMonth.toFixed(2)}
            </div>
            <div className="text-xs text-slate-500 font-medium">Penalties This Month</div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <div className="text-2xl font-bold text-slate-900 mb-1">{stats.breachedThisMonth}</div>
            <div className="text-xs text-slate-500 font-medium">Breaches This Month</div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <div className="text-2xl font-bold text-emerald-600 mb-1">{stats.withinThisMonth}</div>
            <div className="text-xs text-slate-500 font-medium">Within SLA This Month</div>
          </div>
        </div>

        {/* SLA Agreements */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden mb-8">
          <div className="px-6 py-4 border-b border-slate-100">
            <span className="font-semibold text-slate-800 text-sm">Your SLA Agreements</span>
            <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-semibold">{slaRules.length}</span>
          </div>
          {slaRules.length === 0 ? (
            <div className="px-6 py-10 text-center text-slate-400 text-sm">No SLA agreements on file.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  {['Product', 'Uptime SLA', 'Penalty / hr'].map(h => (
                    <th key={h} className="text-left px-6 py-3 text-slate-400 font-medium text-xs uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {slaRules.map(rule => (
                  <tr key={rule.id} className="border-b border-slate-50 last:border-0">
                    <td className="px-6 py-3.5 font-semibold text-slate-800">{rule.product}</td>
                    <td className="px-6 py-3.5">
                      <span className="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 font-semibold text-xs">{rule.uptime_pct}%</span>
                    </td>
                    <td className="px-6 py-3.5 text-slate-700 font-medium">${rule.penalty_per_hr.toFixed(2)}<span className="text-slate-400 font-normal">/hr</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Outage History */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-3">
            <span className="font-semibold text-slate-800 text-sm">Outage History</span>
            <div className="flex gap-2">
              {(['all', 'active', 'breached', 'within'] as FilterTab[]).map(t => (
                <button key={t} onClick={() => setTab(t)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors ${
                    tab === t ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}>
                  {t}
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${tab === t ? 'bg-indigo-500 text-indigo-100' : 'bg-white text-slate-500'}`}>
                    {tabCounts[t]}
                  </span>
                </button>
              ))}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  {['Product', 'Start', 'End', 'Duration', 'Status', 'Penalty'].map(h => (
                    <th key={h} className="text-left px-6 py-3 text-slate-400 font-medium text-xs uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-400 text-sm">No outages match this filter.</td>
                  </tr>
                ) : null}
                {filtered.map(o => (
                  <tr key={o.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-3.5 font-semibold text-slate-800">{o.product}</td>
                    <td className="px-6 py-3.5 text-slate-500 whitespace-nowrap">{fmt(o.started_at)}</td>
                    <td className="px-6 py-3.5 text-slate-500 whitespace-nowrap">{o.resolved_at ? fmt(o.resolved_at) : '—'}</td>
                    <td className="px-6 py-3.5 text-slate-600 whitespace-nowrap">{formatDuration(o.duration_mins, o.resolved_at)}</td>
                    <td className="px-6 py-3.5"><StatusBadge status={o.breach_status} isActive={!o.resolved_at} /></td>
                    <td className="px-6 py-3.5 whitespace-nowrap">
                      {o.penalty_usd != null
                        ? <span className={o.penalty_usd > 0 ? 'text-red-600 font-semibold' : 'text-slate-500'}>${o.penalty_usd.toFixed(2)}</span>
                        : <span className="text-slate-300">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <p className="text-center text-xs text-slate-400 mt-8">
          This portal is read-only. Contact your account manager for disputes.
        </p>
      </div>
    </div>
  )
}
