import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import Link from 'next/link'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'SLA Breach Tracker',
  description: 'Track vendor SLA breaches and generate chargeback reports',
}

const navLinks = [
  { href: '/', label: 'Dashboard' },
  { href: '/inbox', label: 'Email Inbox' },
  { href: '/sla-config', label: 'SLA Config' },
  { href: '/breach-log', label: 'Breach Log' },
  { href: '/report', label: 'Reports' },
]

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <div className="flex min-h-screen">
          <nav className="w-56 shrink-0 bg-gray-900 text-white p-4 flex flex-col gap-1">
            <div className="text-lg font-bold mb-4 px-3 text-blue-400">SLA Tracker</div>
            {navLinks.map(link => (
              <Link
                key={link.href}
                href={link.href}
                className="px-3 py-2 rounded text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <main className="flex-1 bg-gray-50 min-h-screen">{children}</main>
        </div>
      </body>
    </html>
  )
}
