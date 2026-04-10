'use client'

import { useState, useEffect } from 'react'
import type { SLARule } from '@/types'

export default function SLAConfigPage() {
  const [rules, setRules] = useState<SLARule[]>([])
  const [form, setForm] = useState({
    vendor: '',
    product: '',
    uptime_pct: '',
    penalty_per_hr: '',
  })
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function loadRules() {
    const res = await fetch('/api/sla-rules')
    const data = await res.json()
    setRules(data as SLARule[])
  }

  useEffect(() => { loadRules() }, [])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const res = await fetch('/api/sla-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vendor: form.vendor,
          product: form.product,
          uptime_pct: parseFloat(form.uptime_pct),
          penalty_per_hr: parseFloat(form.penalty_per_hr),
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error as string); return }
      setForm({ vendor: '', product: '', uptime_pct: '', penalty_per_hr: '' })
      await loadRules()
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(id: number) {
    await fetch(`/api/sla-rules/${id}`, { method: 'DELETE' })
    await loadRules()
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6 text-gray-800">SLA Configuration</h1>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden mb-6">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {['Vendor', 'Product', 'Uptime %', 'Penalty / hr', ''].map(h => (
                <th key={h} className="text-left px-4 py-3 text-gray-600 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rules.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                  No SLA rules defined yet.
                </td>
              </tr>
            )}
            {rules.map(rule => (
              <tr key={rule.id} className="border-t border-gray-100 hover:bg-gray-50">
                <td className="px-4 py-3">{rule.vendor}</td>
                <td className="px-4 py-3">{rule.product}</td>
                <td className="px-4 py-3">{rule.uptime_pct}%</td>
                <td className="px-4 py-3">${rule.penalty_per_hr.toFixed(2)}/hr</td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => handleDelete(rule.id)}
                    className="text-red-600 hover:text-red-800 text-xs"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5 max-w-lg">
        <h2 className="font-semibold mb-4 text-gray-700">Add SLA Rule</h2>
        {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
        <form onSubmit={handleAdd} className="grid grid-cols-2 gap-3">
          <input
            className="border border-gray-300 rounded px-3 py-2 text-sm col-span-1"
            placeholder="Vendor name"
            value={form.vendor}
            onChange={e => setForm(f => ({ ...f, vendor: e.target.value }))}
            required
          />
          <input
            className="border border-gray-300 rounded px-3 py-2 text-sm col-span-1"
            placeholder="Product name"
            value={form.product}
            onChange={e => setForm(f => ({ ...f, product: e.target.value }))}
            required
          />
          <input
            className="border border-gray-300 rounded px-3 py-2 text-sm col-span-1"
            type="number"
            step="0.001"
            min="0"
            max="100"
            placeholder="Uptime % (e.g. 99.9)"
            value={form.uptime_pct}
            onChange={e => setForm(f => ({ ...f, uptime_pct: e.target.value }))}
            required
          />
          <input
            className="border border-gray-300 rounded px-3 py-2 text-sm col-span-1"
            type="number"
            step="0.01"
            min="0.01"
            placeholder="Penalty per hour ($)"
            value={form.penalty_per_hr}
            onChange={e => setForm(f => ({ ...f, penalty_per_hr: e.target.value }))}
            required
          />
          <button
            type="submit"
            disabled={submitting}
            className="col-span-2 bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-50 text-sm"
          >
            {submitting ? 'Saving...' : 'Save Rule'}
          </button>
        </form>
      </div>
    </div>
  )
}
