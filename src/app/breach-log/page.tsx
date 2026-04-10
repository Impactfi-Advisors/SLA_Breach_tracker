import { getOutages } from '@/lib/db'

export const dynamic = 'force-dynamic'
import type { Outage } from '@/types'

function StatusBadge({ status }: { status: Outage['breach_status'] }) {
  const styles: Record<NonNullable<Outage['breach_status']>, string> = {
    within: 'bg-green-100 text-green-700',
    breached: 'bg-red-100 text-red-700',
    pending: 'bg-yellow-100 text-yellow-700',
  }
  const s = status ?? 'pending'
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${styles[s]}`}>
      {s.toUpperCase()}
    </span>
  )
}

function formatDuration(mins: number | null, resolvedAt: string | null): string {
  if (!resolvedAt) return 'Ongoing'
  if (mins == null) return '—'
  if (mins < 60) return `${mins}m`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

export default async function BreachLogPage() {
  const outages = await getOutages()

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6 text-gray-800">Breach Log</h1>
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {['Vendor', 'Product', 'Start', 'End', 'Duration', 'Status', 'Penalty'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-gray-600 font-medium whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {outages.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                  No outages logged yet.
                </td>
              </tr>
            )}
            {outages.map(o => (
              <tr key={o.id} className="border-t border-gray-100 hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{o.vendor}</td>
                <td className="px-4 py-3">{o.product}</td>
                <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                  {new Date(o.started_at).toLocaleString()}
                </td>
                <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                  {o.resolved_at ? (
                    new Date(o.resolved_at).toLocaleString()
                  ) : (
                    <span className="text-yellow-600 font-medium">Active</span>
                  )}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {formatDuration(o.duration_mins, o.resolved_at)}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={o.breach_status} />
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {o.penalty_usd != null ? `$${o.penalty_usd.toFixed(2)}` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
