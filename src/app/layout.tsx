import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { AdminShell } from './components/AdminShell'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'SLA Breach Tracker',
  description: 'Track vendor SLA breaches and generate chargeback reports',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AdminShell>{children}</AdminShell>
      </body>
    </html>
  )
}
