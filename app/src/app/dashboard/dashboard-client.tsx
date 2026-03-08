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
  // Outcome metrics
  syncedToday: number
  billedToday: number
  minutesSavedToday: number
  attentionCount: number
  pendingReviewCount: number
}

function OutcomeCard({
  value,
  label,
  sub,
  accent,
}: {
  value: string
  label: string
  sub?: string
  accent?: 'green' | 'blue' | 'amber' | 'slate'
}) {
  const colors = {
    green: 'bg-emerald-50 border-emerald-200',
    blue: 'bg-sky-50 border-sky-200',
    amber: 'bg-amber-50 border-amber-200',
    slate: 'bg-white border-slate-200',
  }
  const valueColors = {
    green: 'text-emerald-700',
    blue: 'text-sky-700',
    amber: 'text-amber-700',
    slate: 'text-slate-900',
  }
  const cls = colors[accent ?? 'slate']
  const vcls = valueColors[accent ?? 'slate']

  return (
    <div className={`rounded-xl border p-5 ${cls}`}>
      <p className={`text-3xl font-bold ${vcls}`}>{value}</p>
      <p className="mt-1 text-sm font-medium text-slate-700">{label}</p>
      {sub && <p className="mt-0.5 text-xs text-slate-500">{sub}</p>}
    </div>
  )
}

function StatusPill({ label, count }: { label: string; count: number }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1">
      <span className="text-sm text-slate-600">{label}</span>
      <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">{count}</span>
    </div>
  )
}

export default function DashboardPage({ initialSummary }: { initialSummary?: Summary | null }) {
  const [summary, setSummary] = useState<Summary | null>(initialSummary ?? null)
  const [refreshing, setRefreshing] = useState(false)
  const [simulating, setSimulating] = useState(false)

  async function load() {
    const d = await fetch('/api/dashboard/summary', { cache: 'no-store' }).then((r) => r.json())
    setSummary(d.summary ?? null)
  }

  useEffect(() => {
    if (!initialSummary) {
      const t = setTimeout(() => load(), 0)
      return () => clearTimeout(t)
    }
  }, [])

  async function handleRefresh() {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }

  async function handleSimulate() {
    setSimulating(true)
    await fetch('/api/mock/wallace/simulate-workday', { method: 'POST' }).catch(() => null)
    await load()
    setSimulating(false)
  }

  if (!summary) {
    return (
      <main className="min-h-screen p-8">
        <div className="mx-auto max-w-5xl card-soft p-6 text-sm text-slate-500">Loading dashboard…</div>
      </main>
    )
  }

  const hoursStr =
    summary.minutesSavedToday >= 60
      ? `${(summary.minutesSavedToday / 60).toFixed(1)} hr`
      : `${summary.minutesSavedToday} min`

  const billedStr =
    summary.billedToday >= 1000
      ? `$${(summary.billedToday / 1000).toFixed(1)}k`
      : `$${summary.billedToday.toFixed(0)}`

  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto max-w-5xl space-y-6">

        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Dashboard</h1>
            <p className="text-sm text-slate-500">Today's automation results for Coastline Marine</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs text-white disabled:opacity-50"
              onClick={handleSimulate}
              disabled={simulating || refreshing}
              title="Simulate a full workday — moves work orders through the pipeline and pushes invoices to QuickBooks"
            >
              {simulating ? 'Running…' : 'Simulate workday →'}
            </button>
            <button
              className="rounded-lg border px-3 py-1.5 text-xs disabled:opacity-50"
              onClick={handleRefresh}
              disabled={refreshing || simulating}
            >
              {refreshing ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
        </div>

        {/* ── Outcome metrics (the headline) ─────────────────────────── */}
        <section>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Today at a glance</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <OutcomeCard
              value={String(summary.syncedToday)}
              label="Invoices pushed to QuickBooks"
              sub="Auto-synced today, no manual re-entry"
              accent="green"
            />
            <OutcomeCard
              value={billedStr}
              label="Estimated value billed"
              sub="Labor + parts across synced invoices"
              accent="blue"
            />
            <OutcomeCard
              value={hoursStr}
              label="Time saved"
              sub="~15 min per invoice vs. manual entry"
              accent="slate"
            />
          </div>
        </section>

        {/* ── Attention items ─────────────────────────────────────────── */}
        {(summary.attentionCount > 0 || summary.pendingReviewCount > 0) && (
          <section>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Needs your attention</p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {summary.attentionCount > 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <p className="text-2xl font-bold text-amber-700">{summary.attentionCount}</p>
                  <p className="mt-1 text-sm font-medium text-amber-900">Sync errors / retrying</p>
                  <p className="mt-0.5 text-xs text-amber-700">QuickBooks push failed — check the board for details</p>
                  <Link href="/board" className="mt-3 inline-block rounded-lg border border-amber-300 bg-white px-3 py-1 text-xs font-medium text-amber-800 hover:bg-amber-100">
                    View on board →
                  </Link>
                </div>
              )}
              {summary.pendingReviewCount > 0 && (
                <div className="rounded-xl border border-sky-200 bg-sky-50 p-4">
                  <p className="text-2xl font-bold text-sky-700">{summary.pendingReviewCount}</p>
                  <p className="mt-1 text-sm font-medium text-sky-900">Ready to push to QuickBooks</p>
                  <p className="mt-0.5 text-xs text-sky-700">Wallace complete — needs one-click invoice send</p>
                  <Link href="/wallace-export" className="mt-3 inline-block rounded-lg border border-sky-300 bg-white px-3 py-1 text-xs font-medium text-sky-800 hover:bg-sky-100">
                    Review & send →
                  </Link>
                </div>
              )}
            </div>
          </section>
        )}

        {/* ── Pipeline snapshot ───────────────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Pipeline snapshot</p>
            <Link href="/board" className="text-xs text-slate-500 hover:underline">
              Full board →
            </Link>
          </div>
          <div className="card-soft p-4 grid grid-cols-1 sm:grid-cols-2 gap-x-8 divide-y sm:divide-y-0 sm:divide-x divide-slate-100">
            <div className="pb-4 sm:pb-0 sm:pr-8">
              <p className="mb-2 text-xs font-medium text-slate-500">By stage</p>
              {Object.entries(summary.byStatus).length === 0 ? (
                <p className="text-sm text-slate-400">No work orders yet.</p>
              ) : (
                Object.entries(summary.byStatus).map(([k, v]) => (
                  <StatusPill key={k} label={k} count={v} />
                ))
              )}
            </div>
            <div className="pt-4 sm:pt-0 sm:pl-8">
              <p className="mb-2 text-xs font-medium text-slate-500">By location</p>
              {Object.entries(summary.byLocation).length === 0 ? (
                <p className="text-sm text-slate-400">No work orders yet.</p>
              ) : (
                Object.entries(summary.byLocation).map(([k, v]) => (
                  <StatusPill key={k} label={k} count={v} />
                ))
              )}
            </div>
          </div>
        </section>

        {/* ── Quick links ─────────────────────────────────────────────── */}
        <section className="flex flex-wrap gap-3 text-sm">
          <Link href="/board" className="rounded-xl border bg-white px-4 py-2 hover:bg-slate-50">
            Work order board
          </Link>
          <Link href="/wallace-export" className="rounded-xl border bg-white px-4 py-2 hover:bg-slate-50">
            Wallace → QuickBooks
          </Link>
          <Link href="/intake" className="rounded-xl border bg-white px-4 py-2 hover:bg-slate-50">
            New intake
          </Link>
          <Link href="/ceo" className="rounded-xl border bg-white px-4 py-2 hover:bg-slate-50">
            CEO snapshot
          </Link>
        </section>

      </div>
    </main>
  )
}
