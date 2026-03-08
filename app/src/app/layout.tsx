import type { Metadata } from 'next'
import Link from 'next/link'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
// WallaceNavStatus (E•C•R plumbing label) removed — Dashboard link replaces it

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
          <div className="mx-auto grid max-w-7xl grid-cols-[auto_1fr_auto] items-center gap-4 px-6 py-3">
            <Link href="/" className="flex items-center gap-2 font-semibold text-slate-900">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 text-sm font-bold text-white">M</span>
              MarineFlow
            </Link>

            <div className="hidden md:flex justify-center">
              <nav className="flex items-center gap-2 text-sm text-slate-700">
                <Link href="/intake" className="rounded-lg px-3 py-1.5 hover:bg-slate-100">Intake</Link>
                <Link href="/board" className="rounded-lg px-3 py-1.5 hover:bg-slate-100">Board</Link>
                <Link href="/wallace-export" className="rounded-lg px-3 py-1.5 hover:bg-slate-100">Wallace → QBO</Link>
                <Link href="/clockshark" className="rounded-lg px-3 py-1.5 hover:bg-slate-100">ClockShark</Link>
                <Link href="/quickbooks" className="rounded-lg px-3 py-1.5 hover:bg-slate-100">QuickBooks</Link>
                <Link href="/dashboard" className="rounded-lg px-3 py-1.5 hover:bg-slate-100">Dashboard</Link>
              </nav>
            </div>

            <div className="invisible hidden md:flex items-center gap-2 font-semibold" aria-hidden="true">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg">M</span>
              MarineFlow
            </div>
          </div>
        </header>

        {children}

      </body>
    </html>
  )
}
