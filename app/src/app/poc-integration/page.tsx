'use client'

import { useEffect, useState } from 'react'

type WorkOrder = {
  id: string
  requestType: 'WORK_ORDER' | 'BOAT_LAUNCH'
  customerName: string
  vesselName?: string
  stage: 'INTAKE' | 'DISPATCH' | 'TIME_TRACKING' | 'INVOICE' | 'COMPLETION'
  status: string
  wallaceStatus?: string
  clockSharkStatus?: string
  quickBooksStatus?: string
  invoiceId?: string
  createdAt: string
  updatedAt: string
}

function KpiCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded border bg-white p-3">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  )
}

export default function PocIntegrationPage() {
  const [orders, setOrders] = useState<WorkOrder[]>([])
  const [loading, setLoading] = useState(false)

  async function refresh() {
    const r = await fetch('/api/mock/orchestrator/work-orders', { cache: 'no-store' })
    const d = await r.json()
    setOrders(d.workOrders ?? [])
  }

  useEffect(() => {
    let cancelled = false
    fetch('/api/mock/orchestrator/work-orders', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setOrders(d.workOrders ?? [])
      })

    return () => {
      cancelled = true
    }
  }, [])

  async function createDemo(requestType: 'WORK_ORDER' | 'BOAT_LAUNCH') {
    setLoading(true)
    await fetch('/api/mock/wordpress/intake', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        customerName: requestType === 'BOAT_LAUNCH' ? 'Seasonal Storage Customer' : 'Service Customer',
        vesselName: requestType === 'BOAT_LAUNCH' ? 'Winterized 34ft Cruiser' : 'Sea Ray 240',
        serviceRequest:
          requestType === 'BOAT_LAUNCH'
            ? 'Launch prep + splash scheduling + battery check'
            : 'Engine diagnostics and bilge pump repair',
        location: 'CMS Yard',
        requestType,
      }),
    })
    await refresh()
    setLoading(false)
  }

  async function step(path: string, workOrderId: string, payload: Record<string, unknown> = {}) {
    await fetch(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ workOrderId, ...payload }),
    })
    await refresh()
  }

  return (
    <main className="min-h-screen bg-slate-50 p-8">
      <div className="mx-auto max-w-6xl space-y-5">
        <div>
          <h1 className="text-2xl font-bold">Unified integration POC (Mock Systems)</h1>
          <p className="text-sm text-slate-600">
            Intake → Dispatch (Wallace) → Time Tracking (ClockShark) → Invoice (QuickBooks) → Completion
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button disabled={loading} onClick={() => createDemo('WORK_ORDER')} className="rounded border bg-white px-3 py-2 text-sm">
            + Create demo work order intake
          </button>
          <button disabled={loading} onClick={() => createDemo('BOAT_LAUNCH')} className="rounded border bg-white px-3 py-2 text-sm">
            + Create demo boat launch intake
          </button>
        </div>

        <section className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <KpiCard label="Total" value={orders.length} />
          <KpiCard label="In Dispatch" value={orders.filter((o) => o.stage === 'DISPATCH').length} />
          <KpiCard label="In Progress" value={orders.filter((o) => o.stage === 'TIME_TRACKING').length} />
          <KpiCard label="Invoiced" value={orders.filter((o) => o.stage === 'INVOICE').length} />
          <KpiCard label="Completed" value={orders.filter((o) => o.stage === 'COMPLETION').length} />
        </section>

        <div className="rounded border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
          Transition rule: Dispatch → Log Time → Invoice → Complete. Buttons unlock only when each prior step is done.
        </div>

        <div className="overflow-x-auto rounded border bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-100 text-left">
              <tr>
                <th className="p-2">Customer</th>
                <th className="p-2">Type</th>
                <th className="p-2">Stage</th>
                <th className="p-2">Wallace</th>
                <th className="p-2">ClockShark</th>
                <th className="p-2">QuickBooks</th>
                <th className="p-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="border-t">
                  <td className="p-2">{o.customerName}</td>
                  <td className="p-2">{o.requestType}</td>
                  <td className="p-2 font-medium">{o.stage}</td>
                  <td className="p-2">{o.wallaceStatus ?? '-'}</td>
                  <td className="p-2">{o.clockSharkStatus ?? '-'}</td>
                  <td className="p-2">{o.quickBooksStatus ?? '-'} {o.invoiceId ? `(${o.invoiceId})` : ''}</td>
                  <td className="p-2">
                    <div className="flex flex-wrap gap-1">
                      <button
                        disabled={!(o.stage === 'INTAKE' || o.stage === 'DISPATCH')}
                        className="rounded border px-2 py-1 disabled:opacity-40"
                        onClick={() => step('/api/mock/wallace/dispatch', o.id)}
                      >
                        Dispatch
                      </button>
                      <button
                        disabled={!(o.stage === 'DISPATCH' || o.stage === 'TIME_TRACKING')}
                        className="rounded border px-2 py-1 disabled:opacity-40"
                        onClick={() => step('/api/mock/clockshark/time-entry', o.id, { hours: 2 })}
                      >
                        Log Time
                      </button>
                      <button
                        disabled={!(o.stage === 'TIME_TRACKING' || o.stage === 'INVOICE')}
                        className="rounded border px-2 py-1 disabled:opacity-40"
                        onClick={() => step('/api/mock/quickbooks/invoice', o.id)}
                      >
                        Invoice
                      </button>
                      <button
                        disabled={!(o.stage === 'INVOICE' && o.quickBooksStatus === 'INVOICED')}
                        className="rounded border px-2 py-1 disabled:opacity-40"
                        onClick={() => step('/api/mock/quickbooks/invoice', o.id, { markPaid: true })}
                      >
                        Complete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {orders.length === 0 && (
                <tr>
                  <td className="p-4 text-slate-500" colSpan={7}>
                    No mock records yet. Create a demo intake to start the lifecycle.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  )
}
