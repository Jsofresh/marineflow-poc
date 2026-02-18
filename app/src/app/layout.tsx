import type { Metadata } from 'next'
import Link from 'next/link'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'MarineFlow POC',
  description: 'Intake → Work Orders → QuickBooks (mock) sync',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-3">
            <Link href="/" className="flex items-center gap-2 font-semibold text-slate-900">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 text-sm font-bold text-white">M</span>
              MarineFlow
            </Link>

            <nav className="hidden md:flex items-center gap-2 text-sm text-slate-700">
              {[
                ['Intake', '/intake'],
                ['Board', '/board'],
                ['Dashboard', '/dashboard'],
                ['Wallace', '/wallace-queue'],
                ['ClockShark', '/clockshark'],
                ['QuickBooks', '/quickbooks'],
              ].map(([label, href]) => (
                <Link key={href} href={href} className="rounded-lg px-3 py-1.5 hover:bg-slate-100">
                  {label}
                </Link>
              ))}
            </nav>

            <Link href="/intake" className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm text-white hover:bg-slate-700">
              New Request
            </Link>
          </div>
        </header>

        {children}

        <details className="fixed right-0 top-1/2 z-50 -translate-y-1/2">
          <summary className="cursor-pointer list-none rounded-l-xl border border-r-0 border-slate-300 bg-slate-900 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-white shadow">
            Admin
          </summary>
          <div className="w-64 rounded-l-2xl border border-r-0 border-slate-200 bg-white p-3 shadow-lg">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Admin links</p>
            <div className="space-y-2 text-sm">
              <Link className="block rounded-lg border px-2 py-1 hover:bg-slate-50" href="/manager">Manager</Link>
              <Link className="block rounded-lg border px-2 py-1 hover:bg-slate-50" href="/ceo">CEO</Link>
              <Link className="block rounded-lg border px-2 py-1 hover:bg-slate-50" href="/webhook-test">Webhook Test</Link>
              <a className="block rounded-lg border px-2 py-1 hover:bg-slate-50" href="/api/health" target="_blank" rel="noreferrer">Health</a>
            </div>
          </div>
        </details>
      </body>
    </html>
  )
}
