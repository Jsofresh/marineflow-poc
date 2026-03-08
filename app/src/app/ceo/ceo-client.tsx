'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

type Summary = {
  intakeCount: number
  workOrderCount: number
  retryCount: number
  invoicedCount: number
  byStatus: Record<string, number>
  byLocation: Record<string, number>
}

type Props = {
  initialSummary?: Summary
}

export default function CEOPage({ initialSummary }: Props) {
  const [summary, setSummary] = useState<Summary | null>(initialSummary ?? null)
  const [stuckCount, setStuckCount] = useState(initialSummary ? 0 : 0)

  useEffect(() => {
    if (!initialSummary) {
      Promise.all([
        fetch('/api/dashboard/summary', { cache: 'no-store' }).then((r) => r.json()),
        fetch('/api/work-orders/stuck?hours=24', { cache: 'no-store' }).then((r) => r.json()),
      ]).then(([s, stuck]) => {
        setSummary(s.summary)
        setStuckCount(stuck.count ?? 0)
      })
    }
  }, [initialSummary])

  if (!summary) return <main className="p-8">Loading CEO dashboard…</main>

  return (
    <main className="min-h-screen bg-slate-50 p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold">CEO: pilot health snapshot</h1>
            <p className="text-sm text-slate-600">
              Read-only view. Highlights throughput (invoiced), reliability (retries), and delays (stuck).
            </p>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Link href="/" className="underline">
              Home
            </Link>
            <a className="underline" href="/api/health" target="_blank" rel="noreferrer">
              Health
            </a>
          </div>
        </div>

        <section className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Kpi label="Requests" value={summary.intakeCount} />
          <Kpi label="Work orders" value={summary.workOrderCount} />
          <Kpi label="Invoiced" value={summary.invoicedCount} />
          <Kpi label="Needs retry" value={summary.retryCount} />
          <Kpi label="Stuck &gt; 24h" value={stuckCount} />
        </section>

        {stuckCount > 0 && (
          <div className="rounded border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <p className="font-semibold">Attention</p>
            <p>
              {stuckCount} item{stuckCount === 1 ? '' : 's'} haven’t moved in 24+ hours. This usually indicates
              a hand-off delay or missing information.
            </p>
          </div>
        )}

        <section className="grid md:grid-cols-2 gap-4">
          <Panel title="By status">
            <ul className="space-y-1 text-sm">
              {Object.entries(summary.byStatus).map(([k, v]) => (
                <li key={k}>
                  <b>{k}</b>: {v}
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="By location">
            <ul className="space-y-1 text-sm">
              {Object.entries(summary.byLocation).map(([k, v]) => (
                <li key={k}>
                  <b>{k}</b>: {v}
                </li>
              ))}
            </ul>
          </Panel>
        </section>
      </div>
    </main>
  )
}

function Kpi({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded border bg-white p-4">
      <p className="text-xs uppercase text-slate-500">{label}</p>
      <p className="text-3xl font-bold">{value}</p>
    </div>
  )
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded border bg-white p-4">
      <h2 className="font-semibold mb-2">{title}</h2>
      {children}
    </div>
  )
}
