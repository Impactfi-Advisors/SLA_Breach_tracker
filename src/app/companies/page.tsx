'use client'

import { useState, useEffect } from 'react'
import type { Company } from '@/types'

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [form, setForm] = useState({ name: '', domains: '' })
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

  async function loadCompanies() {
    const res = await fetch('/api/companies')
    setCompanies(await res.json())
  }

  useEffect(() => { loadCompanies() }, [])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const domainList = form.domains.split(',').map(d => d.trim()).filter(Boolean)
      const res = await fetch('/api/companies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name, domains: domainList }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error); return }
      setForm({ name: '', domains: '' })
      setToast(`Company "${form.name}" added`)
      await loadCompanies()
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(id: number) {
    await fetch(`/api/companies/${id}`, { method: 'DELETE' })
    setConfirmDelete(null)
    await loadCompanies()
  }

  async function handleCopyLink(company: Company) {
    const token = company.access_token
    if (!token) return
    const url = `${window.location.origin}/portal/${token}`
    await navigator.clipboard.writeText(url)
    setToast(`Portal link copied for ${company.name}`)
  }

  async function handleRegenerate(id: number, name: string) {
    setRegenerating(id)
    try {
      await fetch(`/api/companies/${id}/regenerate-token`, { method: 'POST' })
      setToast(`Portal link regenerated for ${name}`)
      await loadCompanies()
    } finally {
      setRegenerating(null)
    }
  }

  const inputClass = 'w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400 placeholder:text-slate-400'

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Company Registry</h1>
        <p className="text-sm text-slate-500 mt-1">Map vendor company names to email domains. Each company gets a portal link for read-only access to their SLA data.</p>
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
            <h3 className="font-bold text-slate-900 text-center mb-1">Delete Company?</h3>
            <p className="text-sm text-slate-500 text-center mb-6">Emails from this company&apos;s domains will no longer be auto-assigned. Portal link will stop working.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(null)} className="flex-1 px-4 py-2.5 text-sm border border-slate-200 rounded-xl hover:bg-slate-50 font-medium">Cancel</button>
              <button onClick={() => handleDelete(confirmDelete)} className="flex-1 px-4 py-2.5 text-sm bg-red-600 text-white rounded-xl hover:bg-red-700 font-medium">Delete</button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden mb-6">
        <div className="px-6 py-4 border-b border-slate-100">
          <span className="font-semibold text-slate-800 text-sm">Registered Companies</span>
          <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-semibold">{companies.length}</span>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100">
              {['Company Name', 'Email Domains', 'Portal Link', ''].map(h => (
                <th key={h} className="text-left px-6 py-3 text-slate-400 font-medium text-xs uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {companies.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center">
                  <p className="text-slate-400 text-sm font-medium">No companies registered yet.</p>
                  <p className="text-slate-400 text-xs mt-1">Add a company below to enable automatic email assignment and portal access.</p>
                </td>
              </tr>
            ) : null}
            {companies.map(company => {
              let domains: string[] = []
              try { domains = JSON.parse(company.domains) } catch { domains = [] }
              const hasToken = !!company.access_token
              return (
                <tr key={company.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-3.5 font-semibold text-slate-800">{company.name}</td>
                  <td className="px-6 py-3.5">
                    <div className="flex flex-wrap gap-1.5">
                      {domains.map(d => (
                        <span key={d} className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-xs font-mono">{d}</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-3.5">
                    {hasToken ? (
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-600 text-xs font-mono truncate max-w-[160px]">
                          /portal/{company.access_token?.slice(0, 8)}…
                        </span>
                        <button onClick={() => handleCopyLink(company)}
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
                        onClick={() => handleRegenerate(company.id, company.name)}
                        disabled={regenerating === company.id}
                        className="text-xs text-slate-500 hover:text-slate-800 font-medium disabled:opacity-50 whitespace-nowrap">
                        {regenerating === company.id ? 'Regenerating…' : 'New Link'}
                      </button>
                      <button onClick={() => setConfirmDelete(company.id)} className="text-xs text-red-500 hover:text-red-700 font-medium">Remove</button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 max-w-xl">
        <h2 className="font-bold text-slate-800 mb-1">Add Company</h2>
        <p className="text-xs text-slate-400 mb-5">A portal access link will be generated automatically.</p>
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{error}</div>
        )}
        <form onSubmit={handleAdd} className="grid grid-cols-1 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Company name</label>
            <input className={inputClass} placeholder="e.g. Acme Corp" value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
            <p className="text-xs text-slate-400 mt-1">Must match exactly the vendor name used in SLA rules.</p>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Email domains (comma-separated)</label>
            <input className={inputClass} placeholder="e.g. acme.com, status.acme.com" value={form.domains}
              onChange={e => setForm(f => ({ ...f, domains: e.target.value }))} required />
            <p className="text-xs text-slate-400 mt-1">Emails from these domains will be auto-assigned to this company.</p>
          </div>
          <button type="submit" disabled={submitting}
            className="flex items-center justify-center gap-2 bg-indigo-600 text-white py-3 rounded-xl hover:bg-indigo-700 disabled:opacity-50 text-sm font-semibold transition-colors">
            {submitting && <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
            {submitting ? 'Saving…' : 'Add Company'}
          </button>
        </form>
      </div>
    </div>
  )
}
