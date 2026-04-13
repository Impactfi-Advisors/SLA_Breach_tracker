import { getOutages } from '@/lib/db'
import Link from 'next/link'

export const dynamic = 'force-dynamic'
import type { Outage } from '@/types'

function StatusBadge({ status, isActive }: { status: Outage['breach_status']; isActive: boolean }) {
  if (isActive) return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">ACTIVE</span>
  const s = status ?? 'pending'
  const styles: Record<string, string> = {
    within: 'bg-emerald-100 text-emerald-700',
    breached: 'bg-red-100 text-red-700',
    pending: 'bg-slate-100 text-slate-500',
  }
  return <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${styles[s]}`}>{s.toUpperCase()}</span>
}

function formatDuration(mins: number | null, resolvedAt: string | null): string {
  if (!resolvedAt) return 'Ongoing'
  if (mins == null) return '—'
  if (mins < 60) return `${mins}m`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

type Filter = 'all' | 'active' | 'breached' | 'within'

export default async function BreachLogPage({ searchParams }: { searchParams: { filter?: string } }) {
  const allOutages = await getOutages()
  const filter = (searchParams.filter ?? 'all') as Filter

  const outages = allOutages.filter(o => {
    if (filter === 'active') return !o.resolved_at
    if (filter === 'breached') return o.breach_status === 'breached'
    if (filter === 'within') return o.breach_status === 'within'
    return true
  })

  const counts: Record<Filter, number> = {
    all: allOutages.length,
    active: allOutages.filter(o => !o.resolved_at).length,
    breached: allOutages.filter(o => o.breach_status === 'breached').length,
    within: allOutages.filter(o => o.breach_status === 'within').length,
  }

  const tabs: { key: Filter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'active', label: 'Active' },
    { key: 'breached', label: 'Breached' },
    { key: 'within', label: 'Within SLA' },
  ]

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Breach Log</h1>
          <p className="text-sm text-slate-500 mt-1">{allOutages.length} total outage{allOutages.length !== 1 ? 's' : ''} recorded</p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {tabs.map(tab => (
          <Link
            key={tab.key}
            href={tab.key === 'all' ? '/breach-log' : `/breach-log?filter=${tab.key}`}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              filter === tab.key
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {tab.label}
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
              filter === tab.key ? 'bg-indigo-500 text-indigo-100' : 'bg-slate-100 text-slate-500'
            }`}>
              {counts[tab.key]}
            </span>
          </Link>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100">
              {['Vendor', 'Product', 'Start', 'End', 'Duration', 'Status', 'Penalty'].map(h => (
                <th key={h} className="text-left px-6 py-3.5 text-slate-400 font-medium text-xs uppercase tracking-wide whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {outages.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-14 text-center">
                  <p className="text-slate-400 font-medium text-sm">No outages match this filter.</p>
                  {filter !== 'all' && (
                    <Link href="/breach-log" className="text-xs text-indigo-600 hover:underline mt-1 inline-block">
                      View all outages
                    </Link>
                  )}
                </td>
              </tr>
            ) : null}
            {outages.map(o => (
              <tr key={o.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors">
                <td className="px-6 py-3.5 font-semibold text-slate-800">{o.vendor}</td>
                <td className="px-6 py-3.5 text-slate-600">{o.product}</td>
                <td className="px-6 py-3.5 text-slate-500 whitespace-nowrap">{new Date(o.started_at).toLocaleString()}</td>
                <td className="px-6 py-3.5 text-slate-500 whitespace-nowrap">
                  {o.resolved_at ? new Date(o.resolved_at).toLocaleString() : '—'}
                </td>
                <td className="px-6 py-3.5 text-slate-600 whitespace-nowrap">{formatDuration(o.duration_mins, o.resolved_at)}</td>
                <td className="px-6 py-3.5">
                  <StatusBadge status={o.breach_status} isActive={!o.resolved_at} />
                </td>
                <td className="px-6 py-3.5 whitespace-nowrap">
                  {o.penalty_usd != null ? (
                    <span className={o.penalty_usd > 0 ? 'text-red-600 font-semibold' : 'text-slate-500'}>
                      ${o.penalty_usd.toFixed(2)}
                    </span>
                  ) : <span className="text-slate-300">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
