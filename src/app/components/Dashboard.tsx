'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import type { Outage } from '@/types'

type Insight = { type: 'warning' | 'info' | 'success' | 'danger'; title: string; body: string }

function Skeleton({ className }: { className: string }) {
  return <div className={`animate-pulse bg-slate-200 rounded-xl ${className}`} />
}

function StatCard({
  title,
  value,
  sub,
  gradient,
  icon,
}: {
  title: string
  value: string | number
  sub: string
  gradient: string
  icon: React.ReactNode
}) {
  return (
    <div className={`${gradient} rounded-2xl p-6 text-white shadow-sm`}>
      <div className="flex items-start justify-between mb-3">
        <span className="text-xs font-semibold uppercase tracking-wide opacity-80">{title}</span>
        <span className="opacity-60">{icon}</span>
      </div>
      <div className="text-4xl font-bold mb-1 truncate">{value}</div>
      <div className="text-xs opacity-70">{sub}</div>
    </div>
  )
}

const INSIGHT_STYLE: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  success: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-800', dot: 'bg-emerald-500' },
  warning: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-800', dot: 'bg-amber-500' },
  danger:  { bg: 'bg-red-50',   border: 'border-red-200',   text: 'text-red-800',   dot: 'bg-red-500'   },
  info:    { bg: 'bg-blue-50',  border: 'border-blue-200',  text: 'text-blue-800',  dot: 'bg-blue-500'  },
}

function formatDuration(mins: number | null, resolvedAt: string | null): string {
  if (!resolvedAt) return 'Ongoing'
  if (mins == null) return '—'
  if (mins < 60) return `${mins}m`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

export default function DashboardPage() {
  const [outages, setOutages] = useState<Outage[]>([])
  const [loading, setLoading] = useState(true)
  const [insights, setInsights] = useState<Insight[]>([])
  const [insightsLoading, setInsightsLoading] = useState(false)
  const [insightsFetched, setInsightsFetched] = useState(false)
  const [dateStr, setDateStr] = useState('')

  useEffect(() => {
    setDateStr(new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }))
    fetch('/api/outages')
      .then(r => r.json())
      .then((data: Outage[]) => setOutages(Array.isArray(data) ? data : []))
      .catch(() => setOutages([]))
      .finally(() => setLoading(false))
  }, [])

  async function fetchInsights() {
    setInsightsLoading(true)
    try {
      const res = await fetch('/api/insights')
      const data = await res.json()
      setInsights(Array.isArray(data.insights) ? data.insights : [])
      setInsightsFetched(true)
    } catch {
      setInsights([])
    } finally {
      setInsightsLoading(false)
    }
  }

  const currentMonth = new Date().getUTCMonth() + 1
  const currentYear = new Date().getUTCFullYear()

  const activeOutages = outages.filter(o => !o.resolved_at)
  const thisMonth = outages.filter(o => {
    const d = new Date(o.started_at)
    return d.getUTCMonth() + 1 === currentMonth && d.getUTCFullYear() === currentYear
  })
  const totalPenalties = thisMonth.reduce((s, o) => s + (o.penalty_usd ?? 0), 0)
  const breachCount = thisMonth.filter(o => o.breach_status === 'breached').length
  const recentOutages = outages.slice(0, 8)

  return (
    <div className="p-8 max-w-6xl">
      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        {dateStr && <p className="text-sm text-slate-500 mt-1">{dateStr}</p>}
      </div>

      {/* Active outage alert banner */}
      {!loading && activeOutages.length > 0 && (
        <div className="mb-6 flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm">
          <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0 animate-pulse" />
          <span className="font-semibold text-amber-900">
            {activeOutages.length} active outage{activeOutages.length > 1 ? 's' : ''}
          </span>
          <span className="text-amber-400">·</span>
          <span className="text-amber-700 truncate">
            {activeOutages.map(o => `${o.vendor} / ${o.product}`).join(', ')}
          </span>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {loading ? (
          <>
            <Skeleton className="h-40" />
            <Skeleton className="h-40" />
            <Skeleton className="h-40" />
          </>
        ) : (
          <>
            <StatCard
              title="Active Outages"
              value={activeOutages.length}
              sub={activeOutages.length === 0 ? 'All systems clear' : 'Requires attention'}
              gradient={activeOutages.length > 0
                ? 'bg-gradient-to-br from-amber-500 to-orange-600'
                : 'bg-gradient-to-br from-emerald-500 to-green-600'}
              icon={
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <circle cx="10" cy="10" r="8" stroke="white" strokeWidth="1.5"/>
                  <path d="M10 6v4l3 2" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              }
            />
            <StatCard
              title="Penalties This Month"
              value={`$${totalPenalties.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              sub={`${breachCount} SLA breach${breachCount !== 1 ? 'es' : ''} logged`}
              gradient="bg-gradient-to-br from-red-500 to-rose-600"
              icon={
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M10 2v2M10 16v2M4.22 4.22l1.42 1.42M14.36 14.36l1.42 1.42M2 10h2M16 10h2M4.22 15.78l1.42-1.42M14.36 5.64l1.42-1.42" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
                  <circle cx="10" cy="10" r="3" fill="white" fillOpacity="0.5"/>
                </svg>
              }
            />
            <StatCard
              title="Outages This Month"
              value={thisMonth.length}
              sub={`${thisMonth.filter(o => o.resolved_at).length} resolved`}
              gradient="bg-gradient-to-br from-indigo-500 to-violet-600"
              icon={
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <rect x="2" y="2" width="7" height="7" rx="1.5" fill="white" fillOpacity="0.5"/>
                  <rect x="11" y="2" width="7" height="7" rx="1.5" fill="white" fillOpacity="0.5"/>
                  <rect x="2" y="11" width="7" height="7" rx="1.5" fill="white" fillOpacity="0.5"/>
                  <rect x="11" y="11" width="7" height="7" rx="1.5" fill="white" fillOpacity="0.5"/>
                </svg>
              }
            />
          </>
        )}
      </div>

      {/* AI Insights */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm mb-6">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-md bg-indigo-100 flex items-center justify-center">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M6 1l1.2 3.6H11L8.1 6.7l1.1 3.4L6 8.1 2.9 10.1l1.1-3.4L1 4.6h3.8z" fill="#6366f1"/>
              </svg>
            </div>
            <span className="font-semibold text-slate-800 text-sm">AI Insights</span>
            <span className="text-xs text-slate-400 font-normal">powered by Claude</span>
          </div>
          <button
            onClick={fetchInsights}
            disabled={insightsLoading || loading}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium transition-colors"
          >
            {insightsLoading && (
              <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            )}
            {insightsLoading ? 'Analyzing…' : insightsFetched ? 'Refresh' : 'Generate Insights'}
          </button>
        </div>

        <div className="p-6">
          {!insightsFetched && !insightsLoading && (
            <div className="text-center py-6">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center mx-auto mb-3">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2l2.4 7.2H22L16.2 13.4l2.2 6.8L12 16.2l-6.4 4 2.2-6.8L2 9.2h7.6z" fill="#6366f1" fillOpacity="0.3"/>
                </svg>
              </div>
              <p className="text-slate-500 text-sm font-medium">No insights yet</p>
              <p className="text-slate-400 text-xs mt-1">Click &quot;Generate Insights&quot; to get AI-powered analysis of your SLA data.</p>
            </div>
          )}

          {insightsLoading && (
            <div className="space-y-3">
              <Skeleton className="h-16" />
              <Skeleton className="h-16" />
              <Skeleton className="h-16" />
            </div>
          )}

          {!insightsLoading && insights.length > 0 && (
            <div className="space-y-3">
              {insights.map((insight, i) => {
                const c = INSIGHT_STYLE[insight.type] ?? INSIGHT_STYLE.info
                return (
                  <div key={i} className={`${c.bg} ${c.border} border rounded-xl p-4`}>
                    <div className="flex items-start gap-3">
                      <span className={`w-2 h-2 rounded-full ${c.dot} mt-1.5 shrink-0`} />
                      <div>
                        <div className={`font-semibold text-sm ${c.text}`}>{insight.title}</div>
                        <div className={`text-sm ${c.text} opacity-80 mt-0.5 leading-relaxed`}>{insight.body}</div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Recent activity */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <span className="font-semibold text-slate-800 text-sm">Recent Activity</span>
          <Link href="/breach-log" className="text-xs text-indigo-600 hover:text-indigo-700 font-medium">
            View all →
          </Link>
        </div>

        {loading ? (
          <div className="p-6 space-y-3">
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
          </div>
        ) : outages.length === 0 ? (
          <div className="py-14 text-center">
            <div className="text-3xl mb-3">📭</div>
            <p className="text-slate-600 font-medium text-sm">No outages recorded yet</p>
            <p className="text-slate-400 text-xs mt-1 mb-5">Start by logging a vendor notification email.</p>
            <Link
              href="/inbox"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 font-medium"
            >
              Go to Email Inbox →
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  {['Vendor', 'Product', 'Started', 'Duration', 'Status', 'Penalty'].map(h => (
                    <th key={h} className="text-left px-6 py-3 text-slate-400 font-medium text-xs uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentOutages.map(o => {
                  const isActive = !o.resolved_at
                  const s = o.breach_status ?? 'pending'
                  const badge = isActive
                    ? 'bg-amber-100 text-amber-700'
                    : s === 'breached' ? 'bg-red-100 text-red-700'
                    : s === 'within' ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-slate-100 text-slate-500'
                  return (
                    <tr key={o.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-3.5 font-semibold text-slate-800">{o.vendor}</td>
                      <td className="px-6 py-3.5 text-slate-600">{o.product}</td>
                      <td className="px-6 py-3.5 text-slate-500 whitespace-nowrap">
                        {new Date(o.started_at).toLocaleString()}
                      </td>
                      <td className="px-6 py-3.5 text-slate-600 whitespace-nowrap">
                        {formatDuration(o.duration_mins, o.resolved_at)}
                      </td>
                      <td className="px-6 py-3.5">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${badge}`}>
                          {isActive ? 'ACTIVE' : s.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 whitespace-nowrap">
                        {o.penalty_usd != null ? (
                          <span className={o.penalty_usd > 0 ? 'text-red-600 font-semibold' : 'text-slate-500'}>
                            ${o.penalty_usd.toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
