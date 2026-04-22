'use client'

import { useState, useEffect } from 'react'
import type { SLARule, Bank } from '@/types'

export default function SLAConfigPage() {
  const [rules, setRules] = useState<SLARule[]>([])
  const [banks, setBanks] = useState<Bank[]>([])
  const [form, setForm] = useState({ bank_id: '', vendor: '', product: '', uptime_pct: '', penalty_per_hr: '' })
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null)

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(t)
  }, [toast])

  async function loadData() {
    const [rulesRes, banksRes] = await Promise.all([
      fetch('/api/sla-rules'),
      fetch('/api/banks'),
    ])
    setRules(await rulesRes.json())
    const banksData: Bank[] = await banksRes.json()
    setBanks(banksData)
    if (banksData.length > 0 && !form.bank_id) {
      setForm(f => ({ ...f, bank_id: String(banksData[0].id) }))
    }
  }

  useEffect(() => { loadData() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const res = await fetch('/api/sla-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bank_id: parseInt(form.bank_id, 10),
          vendor: form.vendor,
          product: form.product,
          uptime_pct: parseFloat(form.uptime_pct),
          penalty_per_hr: parseFloat(form.penalty_per_hr),
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error as string); return }
      setForm(f => ({ ...f, vendor: '', product: '', uptime_pct: '', penalty_per_hr: '' }))
      setToast(`Rule added for ${form.vendor} / ${form.product}`)
      await loadData()
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(id: number) {
    await fetch(`/api/sla-rules/${id}`, { method: 'DELETE' })
    setConfirmDelete(null)
    await loadData()
  }

  const bankMap = new Map(banks.map(b => [b.id, b.name]))
  const inputClass = 'w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400 placeholder:text-slate-400'

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">SLA Configuration</h1>
        <p className="text-sm text-slate-500 mt-1">Define SLA terms and penalty rates per bank and vendor product.</p>
      </div>

      {toast && (
        <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex justify-between items-center text-sm text-emerald-800 font-medium">
          <span>{toast}</span>
          <button className="ml-3 opacity-50 hover:opacity-100 text-lg leading-none" onClick={() => setToast(null)}>×</button>
        </div>
      )}

      {confirmDelete !== null && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4">
            <div className="w-12 h-12 rounded-2xl bg-red-100 flex items-center justify-center mx-auto mb-4">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M10 6v5M10 14h.01" stroke="#ef4444" strokeWidth="2" strokeLinecap="round"/>
                <circle cx="10" cy="10" r="8" stroke="#ef4444" strokeWidth="1.5"/>
              </svg>
            </div>
            <h3 className="font-bold text-slate-900 text-center mb-1">Delete SLA Rule?</h3>
            <p className="text-sm text-slate-500 text-center mb-6">This cannot be undone. Future outages for this product won&apos;t be evaluated for breaches.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(null)} className="flex-1 px-4 py-2.5 text-sm border border-slate-200 rounded-xl hover:bg-slate-50 font-medium">Cancel</button>
              <button onClick={() => handleDelete(confirmDelete)} className="flex-1 px-4 py-2.5 text-sm bg-red-600 text-white rounded-xl hover:bg-red-700 font-medium">Delete</button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden mb-6">
        <div className="px-6 py-4 border-b border-slate-100">
          <span className="font-semibold text-slate-800 text-sm">Active Rules</span>
          <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-semibold">{rules.length}</span>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100">
              {['Bank', 'Vendor', 'Product', 'Uptime SLA', 'Penalty / hr', ''].map(h => (
                <th key={h} className="text-left px-6 py-3 text-slate-400 font-medium text-xs uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rules.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center">
                  <p className="text-slate-400 text-sm font-medium">No rules defined yet.</p>
                  <p className="text-slate-400 text-xs mt-1">Add your first rule using the form below.</p>
                </td>
              </tr>
            ) : null}
            {rules.map(rule => (
              <tr key={rule.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors">
                <td className="px-6 py-3.5">
                  <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 text-xs font-semibold">
                    {rule.bank_id ? (bankMap.get(rule.bank_id) ?? `Bank #${rule.bank_id}`) : '—'}
                  </span>
                </td>
                <td className="px-6 py-3.5 font-semibold text-slate-800">{rule.vendor}</td>
                <td className="px-6 py-3.5 text-slate-600">{rule.product}</td>
                <td className="px-6 py-3.5">
                  <span className="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 font-semibold text-xs">{rule.uptime_pct}%</span>
                </td>
                <td className="px-6 py-3.5 text-slate-700 font-medium">${rule.penalty_per_hr.toFixed(2)}<span className="text-slate-400 font-normal">/hr</span></td>
                <td className="px-6 py-3.5 text-right">
                  <button onClick={() => setConfirmDelete(rule.id)} className="text-xs text-red-500 hover:text-red-700 font-medium">Remove</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 max-w-xl">
        <h2 className="font-bold text-slate-800 mb-5">Add SLA Rule</h2>
        {banks.length === 0 && (
          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-700 text-sm">
            No banks registered yet. <a href="/banks" className="underline font-medium">Add a bank first.</a>
          </div>
        )}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{error}</div>
        )}
        <form onSubmit={handleAdd} className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Bank</label>
            <select className={inputClass} value={form.bank_id}
              onChange={e => setForm(f => ({ ...f, bank_id: e.target.value }))} required>
              {banks.length === 0 && <option value="">No banks available</option>}
              {banks.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Vendor name</label>
            <input className={inputClass} placeholder="e.g. Fiserv" value={form.vendor}
              onChange={e => setForm(f => ({ ...f, vendor: e.target.value }))} required />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Product / service</label>
            <input className={inputClass} placeholder="e.g. Core Banking" value={form.product}
              onChange={e => setForm(f => ({ ...f, product: e.target.value }))} required />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Uptime SLA (%)</label>
            <input className={inputClass} type="number" step="0.001" min="0" max="100"
              placeholder="99.9" value={form.uptime_pct}
              onChange={e => setForm(f => ({ ...f, uptime_pct: e.target.value }))} required />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Penalty per hour ($)</label>
            <input className={inputClass} type="number" step="0.01" min="0.01"
              placeholder="500.00" value={form.penalty_per_hr}
              onChange={e => setForm(f => ({ ...f, penalty_per_hr: e.target.value }))} required />
          </div>
          <button type="submit" disabled={submitting || banks.length === 0}
            className="col-span-2 flex items-center justify-center gap-2 bg-indigo-600 text-white py-3 rounded-xl hover:bg-indigo-700 disabled:opacity-50 text-sm font-semibold transition-colors">
            {submitting && <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
            {submitting ? 'Saving…' : 'Save Rule'}
          </button>
        </form>
      </div>
    </div>
  )
}
