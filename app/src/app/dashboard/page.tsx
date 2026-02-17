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

const roles = ['jessica', 'manager', 'ceo'] as const

type Role = (typeof roles)[number]

export default function DashboardPage() {
  const [role, setRole] = useState<Role>('jessica')
  const [summary, setSummary] = useState<Summary | null>(null)
  const [quality, setQuality] = useState<{ avgScore: number; lowQualityCount: number } | null>(null)
  const [reviewCount, setReviewCount] = useState(0)

  useEffect(() => {
    Promise.all([
      fetch('/api/dashboard/summary', { cache: 'no-store' }).then((r) => r.json()),
      fetch('/api/intake/quality', { cache: 'no-store' }).then((r) => r.json()),
      fetch('/api/intake/review-queue', { cache: 'no-store' }).then((r) => r.json()),
    ]).then(([d, q, review]) => {
      setSummary(d.summary)
      setQuality(q.summary)
      setReviewCount(review.count ?? 0)
    })
  }, [])

  const priorityText = !summary
    ? 'Loading priorities...'
    : summary.retryCount > 0
      ? `Priority: ${summary.retryCount} invoice sync item(s) need retry.`
      : 'Priority: no billing blockers right now. Keep work moving to Complete.'

  return (
    <main className="min-h-screen bg-slate-50 p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Role dashboard</h1>
            <p className="text-sm text-slate-600">Simple, role-based view of what to do next.</p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/" className="text-sm underline">
              Home
            </Link>
            <div className="flex gap-2">
              {roles.map((r) => (
                <button
                  key={r}
                  onClick={() => setRole(r)}
                  className={`px-3 py-1 rounded border text-sm ${
                    role === r ? 'bg-slate-800 text-white' : 'bg-white'
                  }`}
                >
                  {r.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">{priorityText}</div>

        {!summary && <p className="text-sm text-slate-600">Loading…</p>}

        {summary && (
          <>
            <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card label="Requests" value={summary.intakeCount} helper="Customer requests received" />
              <Card label="Work orders" value={summary.workOrderCount} helper="Jobs in internal workflow" />
              <Card label="Invoiced" value={summary.invoicedCount} helper="Billing completed" />
              <Card label="Needs retry" value={summary.retryCount} helper="Billing action needed" alert={summary.retryCount > 0} />
            </section>

            {role === 'jessica' && (
              <section className="rounded border bg-white p-4 space-y-3">
                <h2 className="font-semibold">Jessica — Intake desk</h2>
                <div className="grid sm:grid-cols-2 gap-3 text-sm">
                  <ActionCard title="Capture new request" href="/intake" description="Use this for every incoming customer request." />
                  <ActionCard title="Create work order" href="/board" description="Convert intake into an internal work order." />
                  <ActionCard title="Fallback queue" href="/wallace-queue" description="Use this when external automation is unavailable." />
                </div>
                <p className="text-sm text-slate-700">
                  Intake quality score: <b>{quality?.avgScore ?? '-'}%</b> · Requests to improve: <b>{quality?.lowQualityCount ?? '-'}</b>
                </p>
                {reviewCount > 0 ? (
                  <div className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                    <p className="font-medium">Needs review: {reviewCount}</p>
                    <p>Some requests are missing key details. Review before creating work orders.</p>
                  </div>
                ) : (
                  <div className="rounded border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
                    Intake quality looks good. No review queue items right now.
                  </div>
                )}
              </section>
            )}

            {role === 'manager' && (
              <section className="rounded border bg-white p-4 space-y-3">
                <h2 className="font-semibold">Manager — Execution + billing</h2>
                <ol className="list-decimal ml-5 text-sm space-y-1">
                  <li>
                    Clear billing blockers in the <Link className="underline" href="/manager">Retry queue</Link>.
                  </li>
                  <li>
                    Resolve Wallace exceptions in the <Link className="underline" href="/wallace-exceptions">exceptions panel</Link>.
                  </li>
                  <li>
                    Move jobs forward on the <Link className="underline" href="/board">Board</Link>.
                  </li>
                  <li>Escalate jobs stuck over 24 hours.</li>
                </ol>
              </section>
            )}

            {role === 'ceo' && (
              <section className="rounded border bg-white p-4 space-y-3">
                <h2 className="font-semibold">CEO — Pilot health</h2>
                <p className="text-sm text-slate-700">Healthy signal: invoiced is rising and retry count is low.</p>
                <p className="text-sm">
                  Open the <Link className="underline" href="/ceo">CEO snapshot</Link> for read-only KPI view.
                </p>
              </section>
            )}
          </>
        )}
      </div>
    </main>
  )
}

function Card({ label, value, helper, alert }: { label: string; value: number; helper?: string; alert?: boolean }) {
  return (
    <div className={`rounded border bg-white p-4 ${alert ? 'border-amber-300' : ''}`}>
      <p className="text-sm text-slate-700 font-medium">{label}</p>
      {helper && <p className="text-xs text-slate-500">{helper}</p>}
      <p className="text-2xl font-bold mt-1">{value}</p>
    </div>
  )
}

function ActionCard({ title, description, href }: { title: string; description: string; href: string }) {
  return (
    <Link href={href} className="rounded border p-3 hover:bg-slate-50">
      <p className="font-medium">{title}</p>
      <p className="text-slate-600">{description}</p>
    </Link>
  )
}
