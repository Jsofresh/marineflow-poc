'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'

type WorkOrder = {
  id: string
  status: string
  qbSyncStatus: string
  wallaceEntered: boolean
  wallaceSyncStatus: string
  updatedAt: string
  intakeRequest: {
    customerName: string
    location: string
    vesselName: string | null
  }
}

type Data = { workOrders: WorkOrder[] }

type Section = {
  key: string
  title: string
  subtitle: string
  rows: WorkOrder[]
}

export default function DashboardPage() {
  const [data, setData] = useState<Data | null>(null)
  const [lastScanAt, setLastScanAt] = useState<string | null>(null)

  async function refresh() {
    const d = await fetch('/api/work-orders/list', { cache: 'no-store' }).then((r) => r.json())
    setData({ workOrders: d.workOrders ?? [] })
    // In the real product, this would come from the Wallace scanner.
    setLastScanAt(new Date().toISOString())
  }

  useEffect(() => {
    // Defer to the next tick to satisfy lint rule against setState-in-effect.
    const t = setTimeout(() => {
      refresh()
    }, 0)
    return () => clearTimeout(t)
  }, [])

  const sections: Section[] = useMemo(() => {
    const orders = data?.workOrders ?? []

    const notInWallace = orders.filter((w) => !w.wallaceEntered && w.status !== 'INVOICED')
    const inWallace = orders.filter((w) => w.wallaceEntered && w.status !== 'COMPLETE' && w.status !== 'INVOICED')
    const completedInWallace = orders.filter((w) => w.wallaceEntered && w.status === 'COMPLETE')
    const readyForReview = orders.filter(
      (w) => w.wallaceEntered && w.status === 'COMPLETE' && w.qbSyncStatus !== 'SYNCED'
    )

    return [
      {
        key: 'not-in-wallace',
        title: 'Not in Wallace',
        subtitle: 'Work orders created in MarineFlow but not yet detected in Wallace.',
        rows: notInWallace,
      },
      {
        key: 'in-wallace',
        title: 'In Wallace (in progress)',
        subtitle: 'Detected in Wallace; parts/labor still in motion.',
        rows: inWallace,
      },
      {
        key: 'completed',
        title: 'Completed in Wallace',
        subtitle: 'Complete in Wallace; should be ready for billing review.',
        rows: completedInWallace,
      },
      {
        key: 'review',
        title: 'Ready for review → send to QuickBooks',
        subtitle: 'Final confirmation before pushing the draft invoice to QBO.',
        rows: readyForReview,
      },
    ]
  }, [data])

  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto max-w-6xl space-y-5">
        <div className="card-soft p-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Dashboard</h1>
            <p className="text-sm text-slate-600">Wallace scanning + billing review pipeline (mock).</p>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Link href="/board" className="underline">Board</Link>
            <Link href="/wallace-queue" className="underline">Wallace queue</Link>
            <Link href="/wallace-export" className="underline">Wallace → QBO</Link>
          </div>
        </div>

        <div className="card-soft flex flex-wrap items-center justify-between gap-3 p-3 text-sm">
          <div>
            <p className="font-medium">Wallace scan status</p>
            <p className="text-slate-600">
              Last scan: {lastScanAt ? new Date(lastScanAt).toLocaleString() : 'Not scanned yet'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="rounded-lg bg-slate-900 px-3 py-1 text-xs text-white"
              onClick={async () => {
                await fetch('/api/mock/wallace/simulate-workday', { method: 'POST' }).catch(() => null)
                await refresh()
              }}
              title="Simulate a full workday: scan Wallace, move work orders, and snapshot packet totals for ready items"
            >
              Simulate workday →
            </button>
            <button className="rounded-lg border px-3 py-1 text-xs" onClick={() => refresh()}>
              Refresh
            </button>
          </div>
        </div>

        {!data && <div className="card-soft p-4 text-sm">Loading…</div>}

        {data && (
          <div className="grid gap-4">
            {sections.map((s) => (
              <section key={s.key} className="card-soft p-4 space-y-2">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h2 className="text-base font-semibold">{s.title}</h2>
                    <p className="text-xs text-slate-600">{s.subtitle}</p>
                  </div>
                  <div className="text-xs text-slate-500">{s.rows.length} work order{s.rows.length === 1 ? '' : 's'}</div>
                </div>

                {s.rows.length === 0 ? (
                  <div className="text-sm text-slate-500">No work orders in this section.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-100 text-left">
                        <tr>
                          <th className="p-2">Customer</th>
                          <th className="p-2">Location</th>
                          <th className="p-2">Status</th>
                          <th className="p-2">Wallace</th>
                          <th className="p-2">Updated</th>
                          <th className="p-2">Next</th>
                        </tr>
                      </thead>
                      <tbody>
                        {s.rows.map((w) => (
                          <tr key={w.id} className="border-t">
                            <td className="p-2 font-medium">{w.intakeRequest.customerName}</td>
                            <td className="p-2 text-xs text-slate-600">{w.intakeRequest.location}</td>
                            <td className="p-2">{w.status}</td>
                            <td className="p-2 text-xs text-slate-600">{w.wallaceEntered ? (w.wallaceSyncStatus || 'ENTERED') : 'NOT_DETECTED'}</td>
                            <td className="p-2">{new Date(w.updatedAt).toLocaleDateString()}</td>
                            <td className="p-2">
                              {s.key === 'review' ? (
                                <Link href="/wallace-export" className="rounded-lg border px-2 py-1 text-xs hover:bg-slate-50">
                                  Review & send
                                </Link>
                              ) : (
                                <span className="text-xs text-slate-500">—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
