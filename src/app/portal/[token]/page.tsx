'use client'

import { useState, useEffect, useRef, use } from 'react'
import type { Outage, SLARule } from '@/types'

interface PortalData {
  bank: { id: number; name: string }
  stats: {
    activeOutages: number; penaltyThisMonth: number; breachedThisMonth: number
    resolvedThisMonth: number; withinThisMonth: number; month: number; year: number
  }
  slaRules: SLARule[]
  outages: Outage[]
}

type Section = 'overview' | 'sla' | 'history' | 'reports' | 'vendor-email' | 'contact'
type FilterTab = 'all' | 'active' | 'breached' | 'within'
const MAX_USES = 2

const MONTHS = ['', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December']
const MONTHS_SHORT = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const NAV: { id: Section; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'sla', label: 'SLA Agreements' },
  { id: 'history', label: 'Outage History' },
  { id: 'reports', label: 'Reports' },
  { id: 'vendor-email', label: 'Vendor Email' },
  { id: 'contact', label: 'Contact' },
]

function curMonthYear() {
  const n = new Date(); return { month: n.getMonth() + 1, year: n.getFullYear() }
}
function usageKey(token: string, t: 'rpt' | 've') {
  const { month, year } = curMonthYear()
  return `portal_${t}_${token}_${year}_${month}`
}
function readUsage(key: string) {
  try { return parseInt(localStorage.getItem(key) ?? '0', 10) || 0 } catch { return 0 }
}
function bumpUsage(key: string) {
  try { const n = readUsage(key) + 1; localStorage.setItem(key, String(n)); return n } catch { return MAX_USES }
}

function fmt(ts: string) {
  return new Date(ts).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })
}
function fmtDur(mins: number | null, resolved: string | null) {
  if (!resolved) return 'Ongoing'
  if (mins == null) return '—'
  const h = Math.floor(mins / 60), m = mins % 60
  return mins < 60 ? `${mins}m` : m > 0 ? `${h}h ${m}m` : `${h}h`
}

function Badge({ status, active }: { status: Outage['breach_status']; active: boolean }) {
  if (active) return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-600 ring-1 ring-amber-200"><span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />Active</span>
  const map: Record<string, string> = { within: 'bg-emerald-50 text-emerald-700 ring-emerald-200', breached: 'bg-red-50 text-red-600 ring-red-200', pending: 'bg-slate-100 text-slate-500 ring-slate-200' }
  const s = status ?? 'pending'
  return <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ring-1 ${map[s]}`}>{s.charAt(0).toUpperCase() + s.slice(1)}</span>
}

function CopyBtn({ text }: { text: string }) {
  const [ok, setOk] = useState(false)
  return (
    <button onClick={() => { navigator.clipboard.writeText(text).then(() => { setOk(true); setTimeout(() => setOk(false), 2000) }) }}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors">
      {ok
        ? <><svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="#16a34a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>Copied</>
        : <><svg width="12" height="12" viewBox="0 0 12 12" fill="none"><rect x="4" y="4" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.3"/><path d="M1 8V2a1 1 0 011-1h6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>Copy</>}
    </button>
  )
}

function SectionHead({ title, desc }: { title: string; desc?: string }) {
  return (
    <div className="mb-6 flex items-start gap-3">
      <div className="w-1 h-8 rounded-full bg-indigo-500 shrink-0 mt-0.5" />
      <div>
        <h2 className="text-base font-bold text-slate-900 leading-tight">{title}</h2>
        {desc && <p className="text-xs text-slate-500 mt-0.5">{desc}</p>}
      </div>
    </div>
  )
}

function Picker({ vendors, vendor, setVendor, month, setMonth, year, setYear }: {
  vendors: string[]; vendor: string; setVendor: (v: string) => void
  month: number; setMonth: (m: number) => void; year: number; setYear: (y: number) => void
}) {
  const sel = "border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400 w-full"
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <div>
        <label className="block text-xs font-semibold text-slate-500 mb-1.5">Vendor</label>
        <select value={vendor} onChange={e => setVendor(e.target.value)} className={sel}>
          <option value="">Select vendor…</option>
          {vendors.map(v => <option key={v} value={v}>{v}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-xs font-semibold text-slate-500 mb-1.5">Month</label>
        <select value={month} onChange={e => setMonth(Number(e.target.value))} className={sel}>
          {MONTHS.slice(1).map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-xs font-semibold text-slate-500 mb-1.5">Year</label>
        <select value={year} onChange={e => setYear(Number(e.target.value))} className={sel}>
          {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>
    </div>
  )
}

export default function PortalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const [data, setData] = useState<PortalData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [activeSection, setActiveSection] = useState<Section>('overview')
  const [tab, setTab] = useState<FilterTab>('all')

  const { month: curMonth, year: curYear } = curMonthYear()
  const [rptVendor, setRptVendor] = useState(''); const [rptMonth, setRptMonth] = useState(curMonth); const [rptYear, setRptYear] = useState(curYear)
  const [rptLoading, setRptLoading] = useState(false); const [rptResult, setRptResult] = useState<{ letter: string; totalPenalty: number; outageCount: number } | null>(null)
  const [rptError, setRptError] = useState<string | null>(null); const [rptUses, setRptUses] = useState(0)

  const [veVendor, setVeVendor] = useState(''); const [veMonth, setVeMonth] = useState(curMonth); const [veYear, setVeYear] = useState(curYear)
  const [veLoading, setVeLoading] = useState(false); const [veResult, setVeResult] = useState<{ email: string; totalPenalty: number; outageCount: number } | null>(null)
  const [veError, setVeError] = useState<string | null>(null); const [veUses, setVeUses] = useState(0)

  const refs = useRef<Record<Section, HTMLElement | null>>({ overview: null, sla: null, history: null, reports: null, 'vendor-email': null, contact: null })

  useEffect(() => {
    setRptUses(readUsage(usageKey(token, 'rpt')))
    setVeUses(readUsage(usageKey(token, 've')))
  }, [token])

  useEffect(() => {
    fetch(`/api/portal/${token}`).then(r => r.json()).then(d => { if (d.error) setError(d.error); else setData(d) })
      .catch(() => setError('Failed to load portal data'))
  }, [token])

  useEffect(() => {
    const obs = new IntersectionObserver(entries => {
      for (const e of entries) { if (e.isIntersecting) setActiveSection(e.target.id as Section) }
    }, { rootMargin: '-40% 0px -55% 0px' })
    Object.values(refs.current).forEach(el => { if (el) obs.observe(el) })
    return () => obs.disconnect()
  }, [data])

  const scrollTo = (id: Section) => { refs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' }); setActiveSection(id) }

  const genReport = async () => {
    if (!rptVendor || rptUses >= MAX_USES) return
    setRptLoading(true); setRptError(null); setRptResult(null)
    try {
      const r = await fetch(`/api/portal/${token}/report`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ vendor: rptVendor, month: rptMonth, year: rptYear }) })
      const d = await r.json()
      if (!r.ok) setRptError(d.error ?? 'Failed'); else { setRptResult(d); setRptUses(bumpUsage(usageKey(token, 'rpt'))) }
    } catch { setRptError('Failed to generate report') } finally { setRptLoading(false) }
  }

  const genEmail = async () => {
    if (!veVendor || veUses >= MAX_USES) return
    setVeLoading(true); setVeError(null); setVeResult(null)
    try {
      const r = await fetch(`/api/portal/${token}/vendor-email`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ vendor: veVendor, month: veMonth, year: veYear }) })
      const d = await r.json()
      if (!r.ok) setVeError(d.error ?? 'Failed'); else { setVeResult(d); setVeUses(bumpUsage(usageKey(token, 've'))) }
    } catch { setVeError('Failed to generate email') } finally { setVeLoading(false) }
  }

  if (error) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="text-center max-w-sm">
        <div className="w-14 h-14 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center mx-auto mb-4">
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><circle cx="11" cy="11" r="9" stroke="#ef4444" strokeWidth="1.5"/><path d="M11 7v5M11 15h.01" stroke="#ef4444" strokeWidth="1.8" strokeLinecap="round"/></svg>
        </div>
        <h2 className="text-base font-bold text-slate-900 mb-1">Portal Unavailable</h2>
        <p className="text-sm text-slate-500">{error}</p>
      </div>
    </div>
  )

  if (!data) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="flex items-center gap-2.5 text-slate-500 text-sm">
        <span className="w-4 h-4 border-2 border-slate-300 border-t-indigo-500 rounded-full animate-spin" />Loading portal…
      </div>
    </div>
  )

  const { bank, stats, slaRules, outages } = data
  const vendors = [...new Set(slaRules.map(r => r.vendor))].sort()
  const filtered = outages.filter(o =>
    tab === 'active' ? !o.resolved_at : tab === 'breached' ? o.breach_status === 'breached' : tab === 'within' ? o.breach_status === 'within' : true
  )
  const counts: Record<FilterTab, number> = { all: outages.length, active: outages.filter(o => !o.resolved_at).length, breached: outages.filter(o => o.breach_status === 'breached').length, within: outages.filter(o => o.breach_status === 'within').length }

  const btnCls = (loading: boolean, disabled: boolean) =>
    `inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors ${disabled || loading ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 text-white'}`

  return (
    <div className="min-h-screen bg-slate-50">

      {/* ── Top bar ─────────────────────────────────────────────── */}
      <header className="h-14 bg-white border-b border-slate-200 sticky top-0 z-20 flex items-center justify-between px-5">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center shrink-0">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1L1 4.5v8h4V9h4v3.5h4v-8L7 1z" fill="white"/></svg>
          </div>
          <div>
            <div className="text-[9px] font-bold text-indigo-500 uppercase tracking-[0.12em] leading-none">SLA Portal</div>
            <div className="text-sm font-bold text-slate-900 leading-tight">{bank.name}</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:block text-right">
            <div className="text-[9px] font-semibold text-slate-400 uppercase tracking-wide">Reporting Period</div>
            <div className="text-xs font-bold text-slate-700">{MONTHS[stats.month]} {stats.year}</div>
          </div>
          <div className="h-4 w-px bg-slate-200 hidden sm:block" />
          <span className="text-[10px] text-slate-400 font-medium hidden sm:block">Impact FI Advisors</span>
        </div>
      </header>

      {/* ── Mobile tab bar ──────────────────────────────────────── */}
      <div className="flex overflow-x-auto bg-white border-b border-slate-200 md:hidden sticky top-14 z-10">
        {NAV.map(n => (
          <button key={n.id} onClick={() => scrollTo(n.id)}
            className={`flex-shrink-0 px-4 py-2.5 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors ${activeSection === n.id ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
            {n.label}
          </button>
        ))}
      </div>

      <div className="flex">
        {/* ── Desktop sidebar ─────────────────────────────────── */}
        <aside className="hidden md:flex flex-col w-52 shrink-0 sticky top-14 h-[calc(100vh-3.5rem)] bg-white border-r border-slate-200 overflow-y-auto">
          <div className="px-3 py-5 flex-1">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-3 mb-2">Navigation</p>
            <nav className="space-y-0.5">
              {NAV.map(n => (
                <button key={n.id} onClick={() => scrollTo(n.id)}
                  className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${activeSection === n.id ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}>
                  {n.label}
                </button>
              ))}
            </nav>
          </div>
          <div className="px-4 py-4 border-t border-slate-100 bg-slate-50">
            <div className="text-center">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Managed by</div>
              <div className="text-xs font-semibold text-indigo-600 mt-0.5">Impact FI Advisors</div>
            </div>
          </div>
        </aside>

        {/* ── Main content ─────────────────────────────────────── */}
        <main className="flex-1 min-w-0 max-w-4xl px-5 py-8 md:px-8 md:py-10 space-y-14">

          {/* Overview */}
          <section id="overview" ref={el => { refs.current.overview = el }}>
            <SectionHead title="Overview" desc={`SLA performance summary for ${MONTHS[stats.month]} ${stats.year}`} />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: 'Active Outages', value: stats.activeOutages, color: stats.activeOutages > 0 ? 'text-amber-600' : 'text-slate-900', border: stats.activeOutages > 0 ? 'border-amber-200 bg-amber-50/40' : 'border-slate-100 bg-white' },
                { label: 'Penalty This Month', value: `$${stats.penaltyThisMonth.toFixed(2)}`, color: stats.penaltyThisMonth > 0 ? 'text-red-600' : 'text-slate-900', border: stats.penaltyThisMonth > 0 ? 'border-red-200 bg-red-50/40' : 'border-slate-100 bg-white' },
                { label: 'SLA Breaches', value: stats.breachedThisMonth, color: 'text-slate-900', border: 'border-slate-100 bg-white' },
                { label: 'Within SLA', value: stats.withinThisMonth, color: 'text-emerald-600', border: 'border-emerald-100 bg-emerald-50/40' },
              ].map(c => (
                <div key={c.label} className={`rounded-2xl border p-4 ${c.border}`}>
                  <div className={`text-2xl font-bold tabular-nums ${c.color}`}>{c.value}</div>
                  <div className="text-xs text-slate-500 mt-1 font-medium leading-tight">{c.label}</div>
                </div>
              ))}
            </div>
          </section>

          {/* SLA Agreements */}
          <section id="sla" ref={el => { refs.current.sla = el }}>
            <SectionHead title="SLA Agreements" desc="Active service level commitments between your institution and each vendor" />
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
              {slaRules.length === 0
                ? <div className="py-12 text-center text-sm text-slate-400">No SLA agreements on file.</div>
                : <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      {['Vendor', 'Product', 'Uptime SLA', 'Penalty / hr'].map(h => (
                        <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {slaRules.map(r => (
                      <tr key={r.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-5 py-3.5 text-slate-600 font-medium">{r.vendor}</td>
                        <td className="px-5 py-3.5 font-semibold text-slate-800">{r.product}</td>
                        <td className="px-5 py-3.5"><span className="inline-flex px-2.5 py-1 rounded-md bg-indigo-50 text-indigo-700 font-semibold text-xs">{r.uptime_pct}%</span></td>
                        <td className="px-5 py-3.5 text-slate-700 font-medium tabular-nums">${r.penalty_per_hr.toFixed(2)}<span className="text-slate-400 font-normal text-xs">/hr</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>}
            </div>
          </section>

          {/* Outage History */}
          <section id="history" ref={el => { refs.current.history = el }}>
            <SectionHead title="Outage History" desc="All recorded incidents tracked against your SLA thresholds" />
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2">
                <span className="text-sm font-semibold text-slate-700">Incidents</span>
                <div className="flex gap-1.5">
                  {(['all', 'active', 'breached', 'within'] as FilterTab[]).map(t => (
                    <button key={t} onClick={() => setTab(t)}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold capitalize transition-colors ${tab === t ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                      {t} <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${tab === t ? 'bg-white/20 text-white' : 'bg-white text-slate-500'}`}>{counts[t]}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      {['Vendor', 'Product', 'Started', 'Resolved', 'Duration', 'Status', 'Penalty'].map(h => (
                        <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filtered.length === 0
                      ? <tr><td colSpan={7} className="px-5 py-10 text-center text-sm text-slate-400">No outages match this filter.</td></tr>
                      : filtered.map(o => (
                        <tr key={o.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="px-5 py-3.5 text-slate-600 font-medium">{o.vendor}</td>
                          <td className="px-5 py-3.5 font-semibold text-slate-800">{o.product}</td>
                          <td className="px-5 py-3.5 text-slate-500 text-xs whitespace-nowrap">{fmt(o.started_at)}</td>
                          <td className="px-5 py-3.5 text-slate-500 text-xs whitespace-nowrap">{o.resolved_at ? fmt(o.resolved_at) : <span className="text-slate-300">—</span>}</td>
                          <td className="px-5 py-3.5 text-slate-600 text-xs whitespace-nowrap">{fmtDur(o.duration_mins, o.resolved_at)}</td>
                          <td className="px-5 py-3.5"><Badge status={o.breach_status} active={!o.resolved_at} /></td>
                          <td className="px-5 py-3.5 text-xs whitespace-nowrap font-semibold tabular-nums">
                            {o.penalty_usd != null ? <span className={o.penalty_usd > 0 ? 'text-red-600' : 'text-slate-400'}>${o.penalty_usd.toFixed(2)}</span> : <span className="text-slate-300">—</span>}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {/* Reports */}
          <section id="reports" ref={el => { refs.current.reports = el }}>
            <SectionHead title="Chargeback Report" desc="Generate a formal SLA breach letter to submit for vendor credit or payment" />
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
              <Picker vendors={vendors} vendor={rptVendor} setVendor={setRptVendor} month={rptMonth} setMonth={setRptMonth} year={rptYear} setYear={setRptYear} />
              <div className="flex items-center gap-3 pt-1">
                <button onClick={genReport} disabled={!rptVendor || rptLoading || rptUses >= MAX_USES} className={btnCls(rptLoading, !rptVendor || rptUses >= MAX_USES)}>
                  {rptLoading && <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                  {rptLoading ? 'Generating…' : 'Generate Report'}
                </button>
                <span className={`text-xs font-medium ${rptUses >= MAX_USES ? 'text-red-500' : 'text-slate-400'}`}>
                  {rptUses >= MAX_USES ? 'Monthly limit reached' : `${MAX_USES - rptUses} of ${MAX_USES} uses remaining`}
                </span>
              </div>
              {rptError && <div className="p-3 rounded-lg bg-red-50 border border-red-100 text-red-700 text-sm">{rptError}</div>}
              {rptResult && (
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200">
                    <div className="text-sm font-semibold text-slate-700">Generated Report <span className="ml-1.5 text-xs font-normal text-slate-400">{rptResult.outageCount} breach{rptResult.outageCount !== 1 ? 'es' : ''} · ${rptResult.totalPenalty.toFixed(2)} total</span></div>
                    <CopyBtn text={rptResult.letter} />
                  </div>
                  <pre className="p-5 text-xs text-slate-700 whitespace-pre-wrap font-mono leading-relaxed max-h-96 overflow-y-auto bg-white">{rptResult.letter}</pre>
                </div>
              )}
            </div>
          </section>

          {/* Vendor Email */}
          <section id="vendor-email" ref={el => { refs.current['vendor-email'] = el }}>
            <SectionHead title="Vendor Email" desc="Draft an AI-written SLA breach notification email tailored to your institution" />
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
              <Picker vendors={vendors} vendor={veVendor} setVendor={setVeVendor} month={veMonth} setMonth={setVeMonth} year={veYear} setYear={setVeYear} />
              <div className="flex items-center gap-3 pt-1">
                <button onClick={genEmail} disabled={!veVendor || veLoading || veUses >= MAX_USES} className={btnCls(veLoading, !veVendor || veUses >= MAX_USES)}>
                  {veLoading && <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                  {veLoading ? 'Generating…' : 'Generate Email Draft'}
                </button>
                <span className={`text-xs font-medium ${veUses >= MAX_USES ? 'text-red-500' : 'text-slate-400'}`}>
                  {veUses >= MAX_USES ? 'Monthly limit reached' : `${MAX_USES - veUses} of ${MAX_USES} uses remaining`}
                </span>
              </div>
              {veError && <div className="p-3 rounded-lg bg-red-50 border border-red-100 text-red-700 text-sm">{veError}</div>}
              {veResult && (
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200">
                    <div className="text-sm font-semibold text-slate-700">Email Draft <span className="ml-1.5 text-xs font-normal text-slate-400">{veResult.outageCount} breach{veResult.outageCount !== 1 ? 'es' : ''} · ${veResult.totalPenalty.toFixed(2)} total</span></div>
                    <CopyBtn text={veResult.email} />
                  </div>
                  <pre className="p-5 text-xs text-slate-700 whitespace-pre-wrap font-mono leading-relaxed max-h-96 overflow-y-auto bg-white">{veResult.email}</pre>
                </div>
              )}
            </div>
          </section>

          {/* Contact */}
          <section id="contact" ref={el => { refs.current.contact = el }}>
            <SectionHead title="Contact" desc="Reach your SLA monitoring partner for disputes or questions" />
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-6 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-indigo-600 flex items-center justify-center shrink-0">
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="7" r="3.5" stroke="white" strokeWidth="1.5"/><path d="M3 18c0-3.866 3.134-6 7-6s7 2.134 7 6" stroke="white" strokeWidth="1.5" strokeLinecap="round"/></svg>
                </div>
                <div>
                  <div className="font-bold text-slate-900">Impact FI Advisors</div>
                  <div className="text-sm text-slate-500 mt-0.5">SLA Monitoring &amp; Compliance</div>
                  <a href="mailto:akash@impactfiadvisors.com" className="inline-flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-700 font-medium mt-2">
                    <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><rect x="1" y="2" width="11" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.3"/><path d="M1 4l5.5 4L12 4" stroke="currentColor" strokeWidth="1.3"/></svg>
                    akash@impactfiadvisors.com
                  </a>
                </div>
              </div>
              <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 text-xs text-slate-400">
                This portal is read-only. All data is managed by Impact FI Advisors on behalf of {bank.name}.
              </div>
            </div>
          </section>

          <div className="pb-8" />
        </main>
      </div>
    </div>
  )
}
