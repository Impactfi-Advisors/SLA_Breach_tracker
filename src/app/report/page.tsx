'use client'

import { useState, useEffect } from 'react'
import type { Outage } from '@/types'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export default function ReportPage() {
  const [vendors, setVendors] = useState<string[]>([])
  const [vendor, setVendor] = useState('')
  const [month, setMonth] = useState(new Date().getMonth() + 1)
  const [year, setYear] = useState(new Date().getFullYear())
  const [letter, setLetter] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    fetch('/api/outages')
      .then(r => r.json())
      .then((data: Outage[]) => {
        const unique = Array.from(new Set(data.map(o => o.vendor))).sort()
        setVendors(unique)
        if (unique.length > 0) setVendor(unique[0])
      })
  }, [])

  async function handleGenerate() {
    if (!vendor) return
    setLoading(true)
    setError(null)
    setLetter(null)
    try {
      const res = await fetch('/api/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vendor, month, year }),
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
    doc.save(
      `chargeback-${vendor.replace(/\s+/g, '-')}-${year}-${String(month).padStart(2, '0')}.pdf`
    )
  }

  const currentYear = new Date().getFullYear()
  const years = [currentYear - 1, currentYear]

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-bold mb-6 text-gray-800">Monthly Report</h1>

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5 mb-6">
        <div className="flex gap-3 items-end flex-wrap">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Vendor</label>
            <select
              className="border border-gray-300 rounded px-3 py-2 text-sm min-w-[140px]"
              value={vendor}
              onChange={e => setVendor(e.target.value)}
            >
              {vendors.length === 0 && <option value="">No vendors</option>}
              {vendors.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Month</label>
            <select
              className="border border-gray-300 rounded px-3 py-2 text-sm"
              value={month}
              onChange={e => setMonth(parseInt(e.target.value, 10))}
            >
              {MONTHS.map((m, i) => (
                <option key={m} value={i + 1}>{m}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Year</label>
            <select
              className="border border-gray-300 rounded px-3 py-2 text-sm"
              value={year}
              onChange={e => setYear(parseInt(e.target.value, 10))}
            >
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <button
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 text-sm"
            onClick={handleGenerate}
            disabled={loading || !vendor}
          >
            {loading ? 'Generating...' : 'Generate Report'}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-100 border border-red-400 rounded text-red-700 text-sm mb-4">
          {error}
        </div>
      )}

      {letter && (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
          <div className="px-4 py-3 border-b border-gray-100 flex justify-between items-center">
            <span className="font-semibold text-gray-700 text-sm">Chargeback Letter</span>
            <div className="flex gap-2">
              <button
                onClick={handleCopy}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50"
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
              <button
                onClick={handleExportPDF}
                className="px-3 py-1.5 text-sm bg-gray-800 text-white rounded hover:bg-gray-900"
              >
                Export PDF
              </button>
            </div>
          </div>
          <pre className="p-4 text-sm font-mono whitespace-pre-wrap text-gray-700 max-h-[500px] overflow-y-auto">
            {letter}
          </pre>
        </div>
      )}
    </div>
  )
}
