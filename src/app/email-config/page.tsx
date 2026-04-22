'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import type { EmailAccount } from '@/types'

export default function EmailConfigPage() {
  const [accounts, setAccounts] = useState<EmailAccount[]>([])
  const [form, setForm] = useState({ label: '', host: 'imap.gmail.com', port: '993', tls: true, username: '', password: '', mailbox: 'INBOX' })
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null)
  const [testing, setTesting] = useState<number | null>(null)
  const [polling, setPolling] = useState(false)

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 5000)
    return () => clearTimeout(t)
  }, [toast])

  async function loadAccounts() {
    const res = await fetch('/api/email-accounts')
    setAccounts(await res.json())
  }

  useEffect(() => { loadAccounts() }, [])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const res = await fetch('/api/email-accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, port: parseInt(form.port) }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error); return }
      setForm({ label: '', host: 'imap.gmail.com', port: '993', tls: true, username: '', password: '', mailbox: 'INBOX' })
      setToast({ msg: `Account "${form.label}" added`, type: 'success' })
      await loadAccounts()
    } finally {
      setSubmitting(false)
    }
  }

  async function handleTest(id: number) {
    setTesting(id)
    try {
      const res = await fetch(`/api/email-accounts/${id}/test`, { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        setToast({ msg: 'Connection successful', type: 'success' })
      } else {
        setToast({ msg: `Connection failed: ${data.error}`, type: 'error' })
      }
    } catch {
      setToast({ msg: 'Connection test failed', type: 'error' })
    } finally {
      setTesting(null)
    }
  }

  async function handleDelete(id: number) {
    await fetch(`/api/email-accounts/${id}`, { method: 'DELETE' })
    setConfirmDelete(null)
    await loadAccounts()
  }

  async function handlePollNow() {
    setPolling(true)
    try {
      const res = await fetch('/api/poll-now', { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        setToast({ msg: `Poll complete — processed: ${data.processed}, skipped: ${data.skipped}, errors: ${data.errors}`, type: 'success' })
      } else {
        setToast({ msg: data.error ?? 'Poll failed', type: 'error' })
      }
    } catch {
      setToast({ msg: 'Poll request failed', type: 'error' })
    } finally {
      setPolling(false)
    }
  }

  const inputClass = 'w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400 placeholder:text-slate-400'

  return (
    <div className="p-8">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Email Configuration</h1>
          <p className="text-sm text-slate-500 mt-1">Configure IMAP accounts to automatically ingest vendor notification emails.</p>
        </div>
        <div className="flex gap-3">
          <Link href="/email-config/poll-log"
            className="px-4 py-2.5 text-sm border border-slate-200 rounded-xl hover:bg-slate-50 font-medium text-slate-700">
            View Poll Log
          </Link>
          <button onClick={handlePollNow} disabled={polling}
            className="flex items-center gap-2 px-4 py-2.5 text-sm bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 font-semibold">
            {polling && <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
            {polling ? 'Polling…' : 'Poll Now'}
          </button>
        </div>
      </div>

      {toast && (
        <div className={`mb-6 p-4 rounded-xl flex justify-between items-center text-sm font-medium border ${
          toast.type === 'success'
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
            : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          <span>{toast.msg}</span>
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
            <h3 className="font-bold text-slate-900 text-center mb-1">Remove Email Account?</h3>
            <p className="text-sm text-slate-500 text-center mb-6">This account will no longer be polled for new emails.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(null)} className="flex-1 px-4 py-2.5 text-sm border border-slate-200 rounded-xl hover:bg-slate-50 font-medium">Cancel</button>
              <button onClick={() => handleDelete(confirmDelete)} className="flex-1 px-4 py-2.5 text-sm bg-red-600 text-white rounded-xl hover:bg-red-700 font-medium">Remove</button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden mb-6">
        <div className="px-6 py-4 border-b border-slate-100">
          <span className="font-semibold text-slate-800 text-sm">Monitored Accounts</span>
          <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-semibold">{accounts.length}</span>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100">
              {['Label', 'Host / Port', 'Username', 'Mailbox', 'Last UID', 'Status', ''].map(h => (
                <th key={h} className="text-left px-6 py-3 text-slate-400 font-medium text-xs uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {accounts.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center">
                  <p className="text-slate-400 text-sm font-medium">No email accounts configured.</p>
                  <p className="text-slate-400 text-xs mt-1">Add an IMAP account below to start automated ingestion.</p>
                </td>
              </tr>
            ) : null}
            {accounts.map(account => (
              <tr key={account.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors">
                <td className="px-6 py-3.5 font-semibold text-slate-800">{account.label}</td>
                <td className="px-6 py-3.5 text-slate-600 font-mono text-xs">{account.host}:{account.port}</td>
                <td className="px-6 py-3.5 text-slate-600">{account.username}</td>
                <td className="px-6 py-3.5 text-slate-500 font-mono text-xs">{account.mailbox}</td>
                <td className="px-6 py-3.5 text-slate-500 text-xs">{account.last_uid}</td>
                <td className="px-6 py-3.5">
                  <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${account.active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                    {account.active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-6 py-3.5 text-right">
                  <div className="flex gap-3 justify-end">
                    <button onClick={() => handleTest(account.id)} disabled={testing === account.id}
                      className="text-xs text-indigo-600 hover:text-indigo-800 font-medium disabled:opacity-50">
                      {testing === account.id ? 'Testing…' : 'Test'}
                    </button>
                    <button onClick={() => setConfirmDelete(account.id)} className="text-xs text-red-500 hover:text-red-700 font-medium">Remove</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 max-w-xl">
        <h2 className="font-bold text-slate-800 mb-5">Add IMAP Account</h2>
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{error}</div>
        )}
        <form onSubmit={handleAdd} className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Label</label>
            <input className={inputClass} placeholder="e.g. Vendor Alerts Gmail" value={form.label}
              onChange={e => setForm(f => ({ ...f, label: e.target.value }))} required />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">IMAP Host</label>
            <input className={inputClass} placeholder="imap.gmail.com" value={form.host}
              onChange={e => setForm(f => ({ ...f, host: e.target.value }))} required />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Port</label>
            <input className={inputClass} type="number" value={form.port}
              onChange={e => setForm(f => ({ ...f, port: e.target.value }))} required />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Username (email address)</label>
            <input className={inputClass} type="email" placeholder="youraccount@gmail.com" value={form.username}
              onChange={e => setForm(f => ({ ...f, username: e.target.value }))} required />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">App Password</label>
            <input className={inputClass} type="password" placeholder="Gmail app password (not your main password)" value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required />
            <p className="text-xs text-slate-400 mt-1">Use an app-specific password. For Gmail: Google Account → Security → 2FA → App Passwords.</p>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Mailbox</label>
            <input className={inputClass} placeholder="INBOX" value={form.mailbox}
              onChange={e => setForm(f => ({ ...f, mailbox: e.target.value }))} />
          </div>
          <div className="flex items-center gap-3 pt-6">
            <input type="checkbox" id="tls" checked={form.tls}
              onChange={e => setForm(f => ({ ...f, tls: e.target.checked }))}
              className="w-4 h-4 rounded border-slate-300 text-indigo-600" />
            <label htmlFor="tls" className="text-sm text-slate-700 font-medium">Use TLS</label>
          </div>
          <button type="submit" disabled={submitting}
            className="col-span-2 flex items-center justify-center gap-2 bg-indigo-600 text-white py-3 rounded-xl hover:bg-indigo-700 disabled:opacity-50 text-sm font-semibold transition-colors">
            {submitting && <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
            {submitting ? 'Saving…' : 'Add Account'}
          </button>
        </form>
      </div>
    </div>
  )
}
