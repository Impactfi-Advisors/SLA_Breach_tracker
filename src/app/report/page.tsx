'use client'

import { useState, useEffect } from 'react'
import type { Bank, SLARule } from '@/types'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export default function ReportPage() {
  const [banks, setBanks] = useState<Bank[]>([])
  const [bankId, setBankId] = useState<number | null>(null)
  const [vendors, setVendors] = useState<string[]>([])
  const [vendor, setVendor] = useState('')
  const [month, setMonth] = useState(new Date().getMonth() + 1)
  const [year, setYear] = useState(new Date().getFullYear())
  const [letter, setLetter] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    fetch('/api/banks').then(r => r.json()).then((data: Bank[]) => {
      setBanks(data)
      if (data.length > 0) setBankId(data[0].id)
    })
  }, [])

  useEffect(() => {
    if (!bankId) { setVendors([]); setVendor(''); return }
    fetch('/api/sla-rules').then(r => r.json()).then((rules: SLARule[]) => {
      const bankVendors = Array.from(new Set(rules.filter(r => r.bank_id === bankId).map(r => r.vendor))).sort()
      setVendors(bankVendors)
      setVendor(bankVendors[0] ?? '')
    })
  }, [bankId])

  async function handleGenerate() {
    if (!bankId || !vendor) return
    setLoading(true)
    setError(null)
    setLetter(null)
    try {
      const res = await fetch('/api/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bank_id: bankId, vendor, month, year }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error as string)
      setLetter(data.letter as string)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  async function handleCopy() {
    if (!letter) return
    await navigator.clipboard.writeText(letter)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleExportPDF() {
    if (!letter) return
    const { jsPDF } = await import('jspdf')
    const doc = new jsPDF()
    doc.setFont('courier', 'normal')
    doc.setFontSize(10)
    const lines = doc.splitTextToSize(letter, 180)
    doc.text(lines, 15, 20)
    doc.save(`chargeback-${vendor.replace(/\s+/g, '-')}-${year}-${String(month).padStart(2, '0')}.pdf`)
  }

  const currentYear = new Date().getFullYear()
  const years = [currentYear - 1, currentYear]
  const selectClass = 'border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400'

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Monthly Report</h1>
        <p className="text-sm text-slate-500 mt-1">Generate an AI-written chargeback letter for a vendor&apos;s breached outages.</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 mb-6">
        <div className="flex gap-4 items-end flex-wrap">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Bank</label>
            <select className={selectClass} value={bankId ?? ''} onChange={e => setBankId(parseInt(e.target.value, 10))}>
              {banks.length === 0 && <option value="">No banks</option>}
              {banks.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Vendor</label>
            <select className={selectClass} value={vendor} onChange={e => setVendor(e.target.value)}>
              {vendors.length === 0 && <option value="">No vendors</option>}
              {vendors.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Month</label>
            <select className={selectClass} value={month} onChange={e => setMonth(parseInt(e.target.value, 10))}>
              {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Year</label>
            <select className={selectClass} value={year} onChange={e => setYear(parseInt(e.target.value, 10))}>
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <button
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 text-sm font-semibold transition-colors"
            onClick={handleGenerate}
            disabled={loading || !vendor || !bankId}
          >
            {loading && <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
            {loading ? 'Generating…' : 'Generate with AI'}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-5 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm font-medium">{error}</div>
      )}

      {loading && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-12 text-center mb-5">
          <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-700 font-semibold">Generating chargeback letter…</p>
          <p className="text-slate-400 text-xs mt-1">Claude is drafting the letter with breach details.</p>
        </div>
      )}

      {letter && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-indigo-100 flex items-center justify-center">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M6 1l1.2 3.6H11L8.1 6.7l1.1 3.4L6 8.1 2.9 10.1l1.1-3.4L1 4.6h3.8z" fill="#6366f1"/>
                </svg>
              </div>
              <span className="font-semibold text-slate-800 text-sm">Chargeback Letter</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleCopy}
                className="px-4 py-2 text-sm border border-slate-200 rounded-xl hover:bg-slate-50 font-medium text-slate-700 transition-colors"
              >
                {copied ? '✓ Copied' : 'Copy'}
              </button>
              <button
                onClick={handleExportPDF}
                className="px-4 py-2 text-sm bg-slate-800 text-white rounded-xl hover:bg-slate-900 font-medium transition-colors"
              >
                Export PDF
              </button>
            </div>
          </div>
          <pre className="p-6 text-sm font-mono whitespace-pre-wrap text-slate-700 max-h-[600px] overflow-y-auto leading-relaxed">
            {letter}
          </pre>
        </div>
      )}
    </div>
  )
}
