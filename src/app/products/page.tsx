'use client'

import { useState, useEffect } from 'react'
import type { Product, Company } from '@/types'

const CATEGORIES = ['core', 'mobile', 'web', 'api', 'other'] as const
type Category = typeof CATEGORIES[number]

const CATEGORY_STYLES: Record<Category, string> = {
  core:   'bg-indigo-50 text-indigo-700',
  mobile: 'bg-violet-50 text-violet-700',
  web:    'bg-sky-50 text-sky-700',
  api:    'bg-emerald-50 text-emerald-700',
  other:  'bg-slate-100 text-slate-600',
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [form, setForm] = useState({ vendor: '', name: '', category: 'core' as Category })
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
    const [pRes, cRes] = await Promise.all([fetch('/api/products'), fetch('/api/companies')])
    setProducts(await pRes.json())
    const cos: Company[] = await cRes.json()
    setCompanies(cos)
    if (cos.length > 0 && !form.vendor) {
      setForm(f => ({ ...f, vendor: cos[0].name }))
    }
  }

  useEffect(() => { loadData() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error); return }
      setForm(f => ({ ...f, name: '' }))
      setToast(`Product "${form.name}" added`)
      await loadData()
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(id: number) {
    await fetch(`/api/products/${id}`, { method: 'DELETE' })
    setConfirmDelete(null)
    await loadData()
  }

  const inputClass = 'w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400 placeholder:text-slate-400'
  const selectClass = inputClass

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Product Catalog</h1>
        <p className="text-sm text-slate-500 mt-1">Define vendor products with category classifications for SLA management.</p>
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
            <h3 className="font-bold text-slate-900 text-center mb-1">Delete Product?</h3>
            <p className="text-sm text-slate-500 text-center mb-6">This removes the product from the catalog.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(null)} className="flex-1 px-4 py-2.5 text-sm border border-slate-200 rounded-xl hover:bg-slate-50 font-medium">Cancel</button>
              <button onClick={() => handleDelete(confirmDelete)} className="flex-1 px-4 py-2.5 text-sm bg-red-600 text-white rounded-xl hover:bg-red-700 font-medium">Delete</button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden mb-6">
        <div className="px-6 py-4 border-b border-slate-100">
          <span className="font-semibold text-slate-800 text-sm">Products</span>
          <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-semibold">{products.length}</span>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100">
              {['Vendor', 'Product Name', 'Category', ''].map(h => (
                <th key={h} className="text-left px-6 py-3 text-slate-400 font-medium text-xs uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {products.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center">
                  <p className="text-slate-400 text-sm font-medium">No products defined yet.</p>
                  <p className="text-slate-400 text-xs mt-1">Add products below to categorize your SLA coverage.</p>
                </td>
              </tr>
            ) : null}
            {products.map(product => (
              <tr key={product.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors">
                <td className="px-6 py-3.5 font-semibold text-slate-800">{product.vendor}</td>
                <td className="px-6 py-3.5 text-slate-600">{product.name}</td>
                <td className="px-6 py-3.5">
                  <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold capitalize ${CATEGORY_STYLES[product.category as Category] ?? CATEGORY_STYLES.other}`}>
                    {product.category}
                  </span>
                </td>
                <td className="px-6 py-3.5 text-right">
                  <button onClick={() => setConfirmDelete(product.id)} className="text-xs text-red-500 hover:text-red-700 font-medium">Remove</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 max-w-xl">
        <h2 className="font-bold text-slate-800 mb-5">Add Product</h2>
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{error}</div>
        )}
        <form onSubmit={handleAdd} className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Vendor</label>
            {companies.length > 0 ? (
              <select className={selectClass} value={form.vendor}
                onChange={e => setForm(f => ({ ...f, vendor: e.target.value }))}>
                {companies.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
            ) : (
              <input className={inputClass} placeholder="Add a company first" value={form.vendor}
                onChange={e => setForm(f => ({ ...f, vendor: e.target.value }))} required />
            )}
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Product name</label>
            <input className={inputClass} placeholder="e.g. Core API" value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Category</label>
            <select className={selectClass} value={form.category}
              onChange={e => setForm(f => ({ ...f, category: e.target.value as Category }))}>
              {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
            </select>
          </div>
          <button type="submit" disabled={submitting}
            className="col-span-2 flex items-center justify-center gap-2 bg-indigo-600 text-white py-3 rounded-xl hover:bg-indigo-700 disabled:opacity-50 text-sm font-semibold transition-colors">
            {submitting && <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
            {submitting ? 'Saving…' : 'Add Product'}
          </button>
        </form>
      </div>
    </div>
  )
}
