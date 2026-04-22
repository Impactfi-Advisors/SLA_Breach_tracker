'use client'

import { usePathname } from 'next/navigation'
import { NavLinks } from './NavLinks'
import { LogoutButton } from './LogoutButton'

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isPortal = pathname.startsWith('/portal/')

  if (isPortal) {
    return <>{children}</>
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <nav className="w-64 shrink-0 bg-slate-900 flex flex-col">
        <div className="px-6 py-6 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shrink-0">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M2 4h5v5H2zM9 4h5v5H9zM2 11h5v3H2zM9 11h5v3H9z" fill="white" fillOpacity="0.9"/>
              </svg>
            </div>
            <div>
              <div className="text-sm font-bold text-white leading-tight">SLA Tracker</div>
              <div className="text-xs text-slate-500 leading-tight">Breach Management</div>
            </div>
          </div>
        </div>
        <div className="flex-1 px-3 py-4">
          <NavLinks />
        </div>
        <div className="px-6 py-4 border-t border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-xs text-slate-500">System operational</span>
          </div>
          <LogoutButton />
        </div>
      </nav>
      <main className="flex-1 min-h-screen overflow-auto">{children}</main>
    </div>
  )
}
