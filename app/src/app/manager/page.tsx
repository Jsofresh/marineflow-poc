'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

type QueueItem = {
  id: string
  status: string
  qbRetryCount: number
  qbLastError: string | null
  intakeRequest: {
    customerName: string
    location: string
    serviceRequest: string
  }
}

type Notice =
  | { kind: 'success'; message: string }
  | { kind: 'error'; message: string }
  | null

export default function ManagerPage() {
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [busyId, setBusyId] = useState<string | null>(null)
  const [notice, setNotice] = useState<Notice>(null)

  async function load() {
    const res = await fetch('/api/work-orders/retry-queue', { cache: 'no-store' })
    const data = await res.json()
    setQueue(data.queue ?? [])
  }

  useEffect(() => {
    load()
  }, [])

  async function retry(id: string) {
    setBusyId(id)
    setNotice(null)

    try {
      const res = await fetch(`/api/work-orders/${id}/qb-sync`, { method: 'POST' })
      const data = await res.json().catch(() => ({}))

      if (res.ok && data?.ok) {
        setNotice({ kind: 'success', message: `QuickBooks sync succeeded (Invoice ${data.workOrder?.qbInvoiceId ?? 'created'}).` })
      } else {
        setNotice({ kind: 'error', message: data?.error ?? 'QuickBooks sync failed. It will remain in the retry queue.' })
      }
    } catch {
      setNotice({ kind: 'error', message: 'Network error while retrying QuickBooks sync.' })
    } finally {
      await load()
      setBusyId(null)
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 p-8">
      <div className="mx-auto max-w-4xl space-y-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Manager: billing retry queue</h1>
            <p className="text-sm text-slate-600">Start here first each day. Clear failed invoice syncs before new billing.</p>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Link className="underline" href="/">
              Home
            </Link>
            <Link className="underline" href="/board">
              Board
            </Link>
            <Link className="underline" href="/wallace-exceptions">
              Wallace exceptions
            </Link>
          </div>
        </div>

        <div className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Recommended order: retry highest-attempt items first, then clear newest failures.
        </div>

        {notice && (
          <div
            className={`rounded border p-3 text-sm ${
              notice.kind === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                : 'border-red-200 bg-red-50 text-red-900'
            }`}
          >
            {notice.message}
          </div>
        )}

        {queue.length === 0 ? (
          <div className="rounded border bg-white p-4">
            <p className="font-semibold">All caught up</p>
            <p className="text-sm text-slate-600">No work orders are waiting on a billing retry.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {queue.map((q) => (
              <div key={q.id} className="rounded border bg-white p-4 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">
                      {q.intakeRequest.customerName} · {q.intakeRequest.location}
                    </p>
                    <p className="text-sm text-slate-700">{q.intakeRequest.serviceRequest}</p>
                  </div>
                  <p className="text-xs text-slate-500">WO {q.id}</p>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="rounded bg-slate-100 px-2 py-1">Attempts: <b>{q.qbRetryCount}</b></span>
                  {q.qbRetryCount >= 3 ? <span className="rounded bg-rose-100 px-2 py-1 text-rose-800">High priority</span> : null}
                </div>

                {q.qbLastError && <p className="text-sm text-red-700">Last error: {q.qbLastError}</p>}

                <button
                  onClick={() => retry(q.id)}
                  disabled={busyId === q.id}
                  className="px-3 py-1 rounded bg-amber-600 text-white disabled:opacity-50"
                >
                  {busyId === q.id ? 'Retrying…' : 'Retry QuickBooks sync'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
