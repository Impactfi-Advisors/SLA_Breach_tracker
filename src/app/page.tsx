import { getOutages } from '@/lib/db'

export const dynamic = 'force-dynamic'

function StatCard({
  title,
  value,
  colorClass,
}: {
  title: string
  value: string | number
  colorClass: string
}) {
  return (
    <div className={`rounded-lg p-6 text-white shadow-sm ${colorClass}`}>
      <div className="text-sm font-medium opacity-80">{title}</div>
      <div className="text-3xl font-bold mt-2 truncate">{value}</div>
    </div>
  )
}

export default async function DashboardPage() {
  const outages = await getOutages()

  const now = new Date()
  const currentMonth = now.getUTCMonth() + 1
  const currentYear = now.getUTCFullYear()

  const activeOutages = outages.filter(o => !o.resolved_at)

  const thisMonthOutages = outages.filter(o => {
    const d = new Date(o.started_at)
    return (
      d.getUTCMonth() + 1 === currentMonth &&
      d.getUTCFullYear() === currentYear
    )
  })

  const totalPenalties = thisMonthOutages.reduce(
    (sum, o) => sum + (o.penalty_usd ?? 0),
    0
  )

  const vendorPenalties: Record<string, number> = {}
  thisMonthOutages.forEach(o => {
    vendorPenalties[o.vendor] = (vendorPenalties[o.vendor] ?? 0) + (o.penalty_usd ?? 0)
  })
  const topVendor =
    Object.entries(vendorPenalties).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'None'

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-2 text-gray-800">Dashboard</h1>
      <p className="text-sm text-gray-500 mb-6">
        {now.toLocaleString('en-US', { month: 'long', year: 'numeric' })}
      </p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          title="Active Outages"
          value={activeOutages.length}
          colorClass="bg-yellow-500"
        />
        <StatCard
          title="Penalties This Month"
          value={`$${totalPenalties.toFixed(2)}`}
          colorClass="bg-red-500"
        />
        <StatCard
          title="Top Offending Vendor"
          value={topVendor}
          colorClass="bg-orange-500"
        />
      </div>
    </div>
  )
}
