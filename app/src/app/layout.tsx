import type { Metadata } from 'next'
import Link from 'next/link'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'MarineFlow POC',
  description: 'Intake → Work Orders → QuickBooks (mock) sync',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <header className="border-b bg-white">
          <div className="mx-auto max-w-6xl px-6 py-3 flex items-center justify-between gap-4">
            <Link href="/" className="font-bold">
              MarineFlow
            </Link>

            <nav className="hidden md:flex items-center gap-4 text-sm">
              <Link className="hover:underline" href="/intake">
                Intake
              </Link>
              <Link className="hover:underline" href="/board">
                Board
              </Link>
              <Link className="hover:underline" href="/dashboard">
                Dashboard
              </Link>
              <Link className="hover:underline" href="/wallace-queue">
                Wallace
              </Link>
              <Link className="hover:underline" href="/clockshark">
                ClockShark
              </Link>
            </nav>

            <Link href="/intake" className="text-sm px-3 py-1 rounded bg-blue-600 text-white">
              New request
            </Link>
          </div>

          <div className="md:hidden border-t bg-white">
            <div className="mx-auto max-w-6xl px-6 py-2 text-sm">
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                <Link className="underline" href="/board">
                  Board
                </Link>
                <Link className="underline" href="/dashboard">
                  Dashboard
                </Link>
                <Link className="underline" href="/wallace-queue">
                  Wallace
                </Link>
                <Link className="underline" href="/clockshark">
                  ClockShark
                </Link>
              </div>
            </div>
          </div>
        </header>

        {children}

        <details className="fixed right-0 top-1/2 z-50 -translate-y-1/2">
          <summary className="cursor-pointer list-none rounded-l border border-r-0 bg-slate-900 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-white shadow">
            ▶ Admin
          </summary>
          <div className="w-64 rounded-l border border-r-0 bg-white p-3 shadow-lg">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Admin links</p>
            <div className="space-y-2 text-sm">
              <Link className="block rounded border px-2 py-1 hover:bg-slate-50" href="/manager">
                Manager
              </Link>
              <Link className="block rounded border px-2 py-1 hover:bg-slate-50" href="/ceo">
                CEO
              </Link>
              <Link className="block rounded border px-2 py-1 hover:bg-slate-50" href="/webhook-test">
                Webhook Test
              </Link>
              <a className="block rounded border px-2 py-1 hover:bg-slate-50" href="/api/health" target="_blank" rel="noreferrer">
                Health
              </a>
            </div>
          </div>
        </details>
      </body>
    </html>
  )
}
