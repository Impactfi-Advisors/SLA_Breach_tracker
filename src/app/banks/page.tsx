'use client'

import { useState, useEffect } from 'react'
import type { Bank } from '@/types'

export default function BanksPage() {
  const [banks, setBanks] = useState<Bank[]>([])
  const [form, setForm] = useState({ name: '', email_alias: '' })
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null)
  const [regenerating, setRegenerating] = useState<number | null>(null)

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(t)
  }, [toast])

  async function loadBanks() {
    const res = await fetch('/api/banks')
    setBanks(await res.json())
  }

  useEffect(() => { loadBanks() }, [])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const res = await fetch('/api/banks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name, email_alias: form.email_alias }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error); return }
      setForm({ name: '', email_alias: '' })
      setToast(`Bank "${form.name}" added`)
      await loadBanks()
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(id: number) {
    await fetch(`/api/banks/${id}`, { method: 'DELETE' })
    setConfirmDelete(null)
    await loadBanks()
  }

  async function handleCopyLink(bank: Bank) {
    if (!bank.access_token) return
    const url = `${window.location.origin}/portal/${bank.access_token}`
    await navigator.clipboard.writeText(url)
    setToast(`Portal link copied for ${bank.name}`)
  }

  async function handleRegenerate(id: number, name: string) {
    setRegenerating(id)
    try {
      await fetch(`/api/banks/${id}/regenerate-token`, { method: 'POST' })
      setToast(`Portal link regenerated for ${name}`)
      await loadBanks()
    } finally {
      setRegenerating(null)
    }
  }

  const inputClass = 'w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400 placeholder:text-slate-400'

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Bank Registry</h1>
        <p className="text-sm text-slate-500 mt-1">
          Register client banks. Each bank gets a unique email alias (<span className="font-mono">sla+alias@impactfiadvisors.com</span>) and a read-only portal link.
        </p>
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
            <h3 className="font-bold text-slate-900 text-center mb-1">Remove Bank?</h3>
            <p className="text-sm text-slate-500 text-center mb-6">Portal link will stop working. SLA rules and outage history for this bank will remain.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(null)} className="flex-1 px-4 py-2.5 text-sm border border-slate-200 rounded-xl hover:bg-slate-50 font-medium">Cancel</button>
              <button onClick={() => handleDelete(confirmDelete)} className="flex-1 px-4 py-2.5 text-sm bg-red-600 text-white rounded-xl hover:bg-red-700 font-medium">Remove</button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden mb-6">
        <div className="px-6 py-4 border-b border-slate-100">
          <span className="font-semibold text-slate-800 text-sm">Registered Banks</span>
          <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-semibold">{banks.length}</span>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100">
              {['Bank Name', 'Email Alias', 'Portal Link', ''].map(h => (
                <th key={h} className="text-left px-6 py-3 text-slate-400 font-medium text-xs uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {banks.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center">
                  <p className="text-slate-400 text-sm font-medium">No banks registered yet.</p>
                  <p className="text-slate-400 text-xs mt-1">Add a bank below to enable SLA tracking and portal access.</p>
                </td>
              </tr>
            ) : null}
            {banks.map(bank => (
              <tr key={bank.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors">
                <td className="px-6 py-3.5 font-semibold text-slate-800">{bank.name}</td>
                <td className="px-6 py-3.5">
                  <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-xs font-mono">
                    sla+{bank.email_alias}@impactfiadvisors.com
                  </span>
                </td>
                <td className="px-6 py-3.5">
                  {bank.access_token ? (
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-600 text-xs font-mono truncate max-w-[160px]">
                        /portal/{bank.access_token.slice(0, 8)}…
                      </span>
                      <button onClick={() => handleCopyLink(bank)}
                        className="text-xs text-indigo-600 hover:text-indigo-800 font-medium whitespace-nowrap">
                        Copy
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400">No token</span>
                  )}
                </td>
                <td className="px-6 py-3.5 text-right">
                  <div className="flex gap-3 justify-end">
                    <button
                      onClick={() => handleRegenerate(bank.id, bank.name)}
                      disabled={regenerating === bank.id}
                      className="text-xs text-slate-500 hover:text-slate-800 font-medium disabled:opacity-50 whitespace-nowrap">
                      {regenerating === bank.id ? 'Regenerating…' : 'New Link'}
                    </button>
                    <button onClick={() => setConfirmDelete(bank.id)} className="text-xs text-red-500 hover:text-red-700 font-medium">Remove</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 max-w-xl">
        <h2 className="font-bold text-slate-800 mb-1">Add Bank</h2>
        <p className="text-xs text-slate-400 mb-5">A portal access link is generated automatically.</p>
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{error}</div>
        )}
        <form onSubmit={handleAdd} className="grid grid-cols-1 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Bank name</label>
            <input className={inputClass} placeholder="e.g. First National Bank" value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Email alias</label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-400 whitespace-nowrap font-mono">sla+</span>
              <input className={inputClass} placeholder="firstnational" value={form.email_alias}
                onChange={e => setForm(f => ({ ...f, email_alias: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '') }))}
                pattern="[a-z0-9_-]+" required />
              <span className="text-sm text-slate-400 whitespace-nowrap font-mono">@impactfiadvisors.com</span>
            </div>
            <p className="text-xs text-slate-400 mt-1">Vendor outage emails sent to this address are routed to this bank.</p>
          </div>
          <button type="submit" disabled={submitting}
            className="flex items-center justify-center gap-2 bg-indigo-600 text-white py-3 rounded-xl hover:bg-indigo-700 disabled:opacity-50 text-sm font-semibold transition-colors">
            {submitting && <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
            {submitting ? 'Saving…' : 'Add Bank'}
          </button>
        </form>
      </div>
    </div>
  )
}
