'use client'

import { useState, useEffect, useRef, use } from 'react'
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

type Section = 'overview' | 'sla' | 'history' | 'reports' | 'vendor-email' | 'contact'
type FilterTab = 'all' | 'active' | 'breached' | 'within'

const MONTH_NAMES = ['', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December']
const MONTH_SHORT = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const NAV: { id: Section; label: string; icon: React.ReactNode }[] = [
  {
    id: 'overview', label: 'Overview',
    icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1" y="1" width="6" height="6" rx="1.5" fill="currentColor"/><rect x="9" y="1" width="6" height="6" rx="1.5" fill="currentColor"/><rect x="1" y="9" width="6" height="6" rx="1.5" fill="currentColor"/><rect x="9" y="9" width="6" height="6" rx="1.5" fill="currentColor"/></svg>,
  },
  {
    id: 'sla', label: 'SLA Agreements',
    icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2" y="1" width="12" height="14" rx="1.5" stroke="currentColor" strokeWidth="1.5" fill="none"/><path d="M5 5h6M5 8h6M5 11h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>,
  },
  {
    id: 'history', label: 'Outage History',
    icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5"/><path d="M8 4.5V8l2.5 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>,
  },
  {
    id: 'reports', label: 'Reports',
    icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 2h7l3 3v9a1 1 0 01-1 1H3a1 1 0 01-1-1V3a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.5" fill="none"/><path d="M10 2v3h3M5 9h6M5 11.5h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>,
  },
  {
    id: 'vendor-email', label: 'Vendor Email',
    icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1" y="3" width="14" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.5" fill="none"/><path d="M1 5.5l7 4.5 7-4.5" stroke="currentColor" strokeWidth="1.5"/></svg>,
  },
  {
    id: 'contact', label: 'Contact',
    icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="6" r="3" stroke="currentColor" strokeWidth="1.5"/><path d="M2 14c0-3.314 2.686-5 6-5s6 1.686 6 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>,
  },
]

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

function currentMonthYear() {
  const now = new Date()
  return { month: now.getMonth() + 1, year: now.getFullYear() }
}

function VendorMonthPicker({
  vendors, vendor, setVendor, month, setMonth, year, setYear,
}: {
  vendors: string[]
  vendor: string
  setVendor: (v: string) => void
  month: number
  setMonth: (m: number) => void
  year: number
  setYear: (y: number) => void
}) {
  const years = [2024, 2025, 2026]
  const selectCls = "border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
  return (
    <div className="flex flex-wrap gap-3 items-center">
      <select value={vendor} onChange={e => setVendor(e.target.value)} className={selectCls}>
        <option value="">Select vendor…</option>
        {vendors.map(v => <option key={v} value={v}>{v}</option>)}
      </select>
      <select value={month} onChange={e => setMonth(Number(e.target.value))} className={selectCls}>
        {MONTH_NAMES.slice(1).map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
      </select>
      <select value={year} onChange={e => setYear(Number(e.target.value))} className={selectCls}>
        {years.map(y => <option key={y} value={y}>{y}</option>)}
      </select>
    </div>
  )
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }
  return (
    <button onClick={copy}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors">
      {copied ? (
        <>
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M2 7l3 3 6-6" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          Copied
        </>
      ) : (
        <>
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><rect x="4" y="4" width="8" height="8" rx="1" stroke="currentColor" strokeWidth="1.3"/><path d="M1 9V2a1 1 0 011-1h7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
          Copy
        </>
      )}
    </button>
  )
}

export default function PortalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const [data, setData] = useState<PortalData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [activeSection, setActiveSection] = useState<Section>('overview')
  const [tab, setTab] = useState<FilterTab>('all')

  // Report state
  const { month: curMonth, year: curYear } = currentMonthYear()
  const [rptVendor, setRptVendor] = useState('')
  const [rptMonth, setRptMonth] = useState(curMonth)
  const [rptYear, setRptYear] = useState(curYear)
  const [rptLoading, setRptLoading] = useState(false)
  const [rptResult, setRptResult] = useState<{ letter: string; totalPenalty: number; outageCount: number } | null>(null)
  const [rptError, setRptError] = useState<string | null>(null)

  // Vendor email state
  const [veVendor, setVeVendor] = useState('')
  const [veMonth, setVeMonth] = useState(curMonth)
  const [veYear, setVeYear] = useState(curYear)
  const [veLoading, setVeLoading] = useState(false)
  const [veResult, setVeResult] = useState<{ email: string; totalPenalty: number; outageCount: number } | null>(null)
  const [veError, setVeError] = useState<string | null>(null)

  const sectionRefs = useRef<Record<Section, HTMLElement | null>>({
    overview: null, sla: null, history: null, reports: null, 'vendor-email': null, contact: null,
  })

  useEffect(() => {
    fetch(`/api/portal/${token}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) setError(d.error)
        else setData(d)
      })
      .catch(() => setError('Failed to load portal data'))
  }, [token])

  useEffect(() => {
    const obs = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          setActiveSection(entry.target.id as Section)
        }
      }
    }, { rootMargin: '-40% 0px -55% 0px' })

    Object.values(sectionRefs.current).forEach(el => { if (el) obs.observe(el) })
    return () => obs.disconnect()
  }, [data])

  const scrollTo = (id: Section) => {
    sectionRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setActiveSection(id)
  }

  const generateReport = async () => {
    if (!rptVendor) return
    setRptLoading(true); setRptError(null); setRptResult(null)
    try {
      const res = await fetch(`/api/portal/${token}/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vendor: rptVendor, month: rptMonth, year: rptYear }),
      })
      const d = await res.json()
      if (!res.ok) setRptError(d.error ?? 'Failed to generate report')
      else setRptResult(d)
    } catch {
      setRptError('Failed to generate report')
    } finally {
      setRptLoading(false)
    }
  }

  const generateVendorEmail = async () => {
    if (!veVendor) return
    setVeLoading(true); setVeError(null); setVeResult(null)
    try {
      const res = await fetch(`/api/portal/${token}/vendor-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vendor: veVendor, month: veMonth, year: veYear }),
      })
      const d = await res.json()
      if (!res.ok) setVeError(d.error ?? 'Failed to generate email')
      else setVeResult(d)
    } catch {
      setVeError('Failed to generate email')
    } finally {
      setVeLoading(false)
    }
  }

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
  const vendors = [...new Set(slaRules.map(r => r.vendor))].sort()

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

  const sectionHeader = (label: string) => (
    <h2 className="text-lg font-bold text-slate-900 mb-6">{label}</h2>
  )

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top header */}
      <div className="bg-white border-b border-slate-100 shadow-sm sticky top-0 z-20">
        <div className="px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 1L2 5v9h4V9h4v5h4V5L8 1z" fill="white"/></svg>
            </div>
            <div>
              <div className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest leading-none">SLA Portal</div>
              <div className="text-sm font-bold text-slate-900 leading-tight">{bank.name}</div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] text-slate-400 uppercase tracking-wide">Period</div>
            <div className="text-sm font-semibold text-slate-700">{MONTH_SHORT[stats.month]} {stats.year}</div>
          </div>
        </div>
        {/* Mobile nav tabs */}
        <div className="flex overflow-x-auto border-t border-slate-100 lg:hidden">
          {NAV.map(n => (
            <button key={n.id} onClick={() => scrollTo(n.id)}
              className={`flex-shrink-0 flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
                activeSection === n.id
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}>
              <span className="w-4 h-4">{n.icon}</span>
              {n.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex">
        {/* Desktop sidebar */}
        <aside className="hidden lg:flex flex-col w-56 shrink-0 sticky top-[69px] h-[calc(100vh-69px)] bg-white border-r border-slate-100 p-4 overflow-y-auto">
          <nav className="space-y-1">
            {NAV.map(n => (
              <button key={n.id} onClick={() => scrollTo(n.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left ${
                  activeSection === n.id
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                }`}>
                <span className={activeSection === n.id ? 'text-white' : 'text-slate-400'}>{n.icon}</span>
                {n.label}
              </button>
            ))}
          </nav>
          <div className="mt-auto pt-6 border-t border-slate-100">
            <div className="text-[10px] text-slate-400 text-center leading-relaxed">
              Powered by<br />
              <span className="font-semibold text-slate-500">Impact FI Advisors</span>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0 px-4 py-8 lg:px-10 lg:py-10 space-y-16 max-w-4xl">

          {/* Overview */}
          <section id="overview" ref={el => { sectionRefs.current.overview = el }}>
            {sectionHeader('Overview')}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className={`bg-white rounded-2xl border shadow-sm p-5 ${stats.activeOutages > 0 ? 'border-amber-200' : 'border-slate-100'}`}>
                <div className={`text-2xl font-bold mb-1 ${stats.activeOutages > 0 ? 'text-amber-600' : 'text-slate-900'}`}>{stats.activeOutages}</div>
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
          </section>

          {/* SLA Agreements */}
          <section id="sla" ref={el => { sectionRefs.current.sla = el }}>
            {sectionHeader('SLA Agreements')}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
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
                      {['Vendor', 'Product', 'Uptime SLA', 'Penalty / hr'].map(h => (
                        <th key={h} className="text-left px-6 py-3 text-slate-400 font-medium text-xs uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {slaRules.map(rule => (
                      <tr key={rule.id} className="border-b border-slate-50 last:border-0">
                        <td className="px-6 py-3.5 text-slate-600">{rule.vendor}</td>
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
          </section>

          {/* Outage History */}
          <section id="history" ref={el => { sectionRefs.current.history = el }}>
            {sectionHeader('Outage History')}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-3">
                <span className="font-semibold text-slate-800 text-sm">All Outages</span>
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
                      {['Vendor', 'Product', 'Start', 'End', 'Duration', 'Status', 'Penalty'].map(h => (
                        <th key={h} className="text-left px-6 py-3 text-slate-400 font-medium text-xs uppercase tracking-wide whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length === 0 ? (
                      <tr><td colSpan={7} className="px-6 py-12 text-center text-slate-400 text-sm">No outages match this filter.</td></tr>
                    ) : null}
                    {filtered.map(o => (
                      <tr key={o.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-3.5 text-slate-600">{o.vendor}</td>
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
          </section>

          {/* Reports */}
          <section id="reports" ref={el => { sectionRefs.current.reports = el }}>
            {sectionHeader('Chargeback Report')}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
              <p className="text-sm text-slate-500 mb-5">
                Generate a formal SLA chargeback letter for a specific vendor and month. This letter documents all breached outages and the total penalty owed.
              </p>
              <div className="space-y-4">
                <VendorMonthPicker
                  vendors={vendors}
                  vendor={rptVendor} setVendor={setRptVendor}
                  month={rptMonth} setMonth={setRptMonth}
                  year={rptYear} setYear={setRptYear}
                />
                <button
                  onClick={generateReport}
                  disabled={!rptVendor || rptLoading}
                  className="px-5 py-2.5 rounded-lg text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
                  {rptLoading ? (
                    <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Generating…</>
                  ) : 'Generate Report'}
                </button>
              </div>

              {rptError && (
                <div className="mt-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm">{rptError}</div>
              )}

              {rptResult && (
                <div className="mt-6">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-sm font-semibold text-slate-700">
                      Generated Report
                      <span className="ml-2 text-xs text-slate-400">
                        {rptResult.outageCount} breach{rptResult.outageCount !== 1 ? 'es' : ''} · Total penalty: ${rptResult.totalPenalty.toFixed(2)}
                      </span>
                    </div>
                    <CopyButton text={rptResult.letter} />
                  </div>
                  <pre className="bg-slate-50 border border-slate-200 rounded-xl p-5 text-xs text-slate-700 whitespace-pre-wrap font-mono leading-relaxed max-h-[500px] overflow-y-auto">
                    {rptResult.letter}
                  </pre>
                </div>
              )}
            </div>
          </section>

          {/* Vendor Email */}
          <section id="vendor-email" ref={el => { sectionRefs.current['vendor-email'] = el }}>
            {sectionHeader('Vendor Email')}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
              <p className="text-sm text-slate-500 mb-5">
                Draft a professional SLA breach notification email to send directly to your vendor. The email is tailored to {bank.name} and lists all breach incidents and penalties for the selected period.
              </p>
              <div className="space-y-4">
                <VendorMonthPicker
                  vendors={vendors}
                  vendor={veVendor} setVendor={setVeVendor}
                  month={veMonth} setMonth={setVeMonth}
                  year={veYear} setYear={setVeYear}
                />
                <button
                  onClick={generateVendorEmail}
                  disabled={!veVendor || veLoading}
                  className="px-5 py-2.5 rounded-lg text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
                  {veLoading ? (
                    <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Generating…</>
                  ) : 'Generate Email Draft'}
                </button>
              </div>

              {veError && (
                <div className="mt-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm">{veError}</div>
              )}

              {veResult && (
                <div className="mt-6">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-sm font-semibold text-slate-700">
                      Email Draft
                      <span className="ml-2 text-xs text-slate-400">
                        {veResult.outageCount} breach{veResult.outageCount !== 1 ? 'es' : ''} · Total penalty: ${veResult.totalPenalty.toFixed(2)}
                      </span>
                    </div>
                    <CopyButton text={veResult.email} />
                  </div>
                  <pre className="bg-slate-50 border border-slate-200 rounded-xl p-5 text-xs text-slate-700 whitespace-pre-wrap font-mono leading-relaxed max-h-[500px] overflow-y-auto">
                    {veResult.email}
                  </pre>
                </div>
              )}
            </div>
          </section>

          {/* Contact */}
          <section id="contact" ref={el => { sectionRefs.current.contact = el }}>
            {sectionHeader('Contact')}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
                  <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><circle cx="11" cy="8" r="4" stroke="#4f46e5" strokeWidth="1.5"/><path d="M3 20c0-4.418 3.582-7 8-7s8 2.582 8 7" stroke="#4f46e5" strokeWidth="1.5" strokeLinecap="round"/></svg>
                </div>
                <div>
                  <div className="font-semibold text-slate-900 mb-0.5">Impact FI Advisors</div>
                  <div className="text-sm text-slate-500 mb-3">SLA Monitoring &amp; Compliance Partner</div>
                  <a href="mailto:akash@impactfiadvisors.com"
                    className="inline-flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-700 font-medium">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1" y="2.5" width="12" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.3"/><path d="M1 4.5l6 4 6-4" stroke="currentColor" strokeWidth="1.3"/></svg>
                    akash@impactfiadvisors.com
                  </a>
                </div>
              </div>
              <div className="mt-5 pt-5 border-t border-slate-100 text-xs text-slate-400">
                This portal is read-only. For disputes or questions about your SLA data, please contact your account manager.
              </div>
            </div>
          </section>

        </main>
      </div>
    </div>
  )
}
