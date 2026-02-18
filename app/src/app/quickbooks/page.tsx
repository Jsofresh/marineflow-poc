'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'

type InvoiceRow = {
  workOrderId: string
  invoiceId: string | null
  customerName: string
  email: string | null
  location: string
  status: string
  qbSyncStatus: string
  bucket: 'PAID' | 'WAITING' | 'DELINQUENT'
  ageDays: number
  updatedAt: string
}

type Data = {
  summary: { paid: number; waiting: number; delinquent: number; total: number }
  invoices: InvoiceRow[]
}

export default function QuickBooksPage() {
  const [data, setData] = useState<Data | null>(null)
  const [filter, setFilter] = useState<'ALL' | 'PAID' | 'WAITING' | 'DELINQUENT'>('ALL')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [bucketEditorFor, setBucketEditorFor] = useState<InvoiceRow | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  async function refresh() {
    const d = await fetch('/api/quickbooks/invoices', { cache: 'no-store' }).then((r) => r.json())
    setData({ summary: d.summary, invoices: d.invoices })
  }

  useEffect(() => {
    refresh()
  }, [])

  async function setBucket(workOrderId: string, bucket: 'PAID' | 'WAITING' | 'DELINQUENT') {
    setBusyId(workOrderId)
    try {
      const res = await fetch(`/api/quickbooks/invoices/${workOrderId}/bucket`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bucket }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok || !d?.ok) {
        alert(d?.error ?? 'Could not update invoice status bucket.')
      }
      await refresh()
      setBucketEditorFor(null)
    } finally {
      setBusyId(null)
    }
  }


  async function remindCustomer(workOrderId: string) {
    setBusyId(workOrderId)
    setNotice(null)
    try {
      const res = await fetch(`/api/quickbooks/invoices/${workOrderId}/remind`, {
        method: 'POST',
      })
      const d = await res.json().catch(() => ({}))
      if (res.ok && d?.ok) {
        setNotice(`Reminder queued for ${d?.reminder?.to ?? 'customer'} (mock).`)
      } else {
        setNotice(d?.error ?? 'Could not queue reminder.')
      }
    } finally {
      setBusyId(null)
    }
  }

  const visible = useMemo(() => {
    if (!data) return [] as InvoiceRow[]
    if (filter === 'ALL') return data.invoices
    return data.invoices.filter((i) => i.bucket === filter)
  }, [data, filter])

  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto max-w-6xl space-y-5">
        <div className="card-soft p-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">QuickBooks invoice monitor (mock)</h1>
            <p className="text-sm text-slate-600">Track paid, waiting, and delinquent customer invoices.</p>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Link href="/" className="underline">Home</Link>
            <Link href="/board" className="underline">Board</Link>
          </div>
        </div>

        {notice && <div className="card-soft p-3 text-sm">{notice}</div>}

        {!data && <div className="card-soft p-4 text-sm">Loading invoices…</div>}

        {data && (
          <>
            <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Kpi label="Total" value={data.summary.total} />
              <Kpi label="Paid" value={data.summary.paid} tone="emerald" />
              <Kpi label="Waiting" value={data.summary.waiting} tone="amber" />
              <Kpi label="Delinquent" value={data.summary.delinquent} tone="rose" />
            </section>

            <section className="card-soft p-4 space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-slate-600">Filter:</span>
                {(['ALL', 'PAID', 'WAITING', 'DELINQUENT'] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`rounded-lg border px-3 py-1 ${filter === f ? 'bg-slate-900 text-white' : 'bg-white'}`}
                  >
                    {f}
                  </button>
                ))}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-100 text-left">
                    <tr>
                      <th className="p-2">Customer</th>
                      <th className="p-2">Invoice</th>
                      <th className="p-2">QuickBooks status</th>
                      <th className="p-2">Bucket</th>
                      <th className="p-2">Age</th>
                      <th className="p-2">Updated</th>
                      <th className="p-2">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((i) => (
                      <tr key={i.workOrderId} className="border-t">
                        <td className="p-2">
                          <p className="font-medium">{i.customerName}</p>
                          <p className="text-xs text-slate-500">{i.location}</p>
                        </td>
                        <td className="p-2">{i.invoiceId ?? `WO-${i.workOrderId.slice(-6).toUpperCase()}`}</td>
                        <td className="p-2">{i.qbSyncStatus.replaceAll('QB', 'QuickBooks')}</td>
                        <td className="p-2">
                          <button
                            onClick={() => setBucketEditorFor(i)}
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                              i.bucket === 'PAID'
                                ? 'bg-emerald-100 text-emerald-800'
                                : i.bucket === 'DELINQUENT'
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-amber-100 text-amber-800'
                            }`}
                            title="Change payment bucket"
                          >
                            {i.bucket}
                          </button>
                        </td>
                        <td className="p-2">{i.ageDays}d</td>
                        <td className="p-2">{new Date(i.updatedAt).toLocaleDateString()}</td>
                        <td className="p-2">
                          <button
                            disabled={busyId === i.workOrderId || i.bucket !== 'DELINQUENT'}
                            onClick={() => remindCustomer(i.workOrderId)}
                            className="rounded-lg border px-2 py-1 text-xs disabled:opacity-40"
                            title="Queue reminder email (mock for now)"
                          >
                            {busyId === i.workOrderId ? 'Queuing…' : 'Remind customer'}
                          </button>
                        </td>
                      </tr>
                    ))}

                    {visible.length === 0 && (
                      <tr>
                        <td colSpan={7} className="p-4 text-slate-500">No invoices in this filter.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}

        {bucketEditorFor && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4">
            <div className="w-full max-w-sm rounded-2xl border bg-white p-4 shadow-lg">
              <p className="text-xs uppercase tracking-wide text-slate-500">Manual payment override</p>
              <h2 className="mt-1 text-lg font-semibold">{bucketEditorFor.customerName}</h2>
              <p className="text-sm text-slate-600">Choose the invoice payment bucket:</p>

              <div className="mt-3 grid gap-2">
                {(['PAID', 'WAITING', 'DELINQUENT'] as const).map((b) => (
                  <button
                    key={b}
                    disabled={busyId === bucketEditorFor.workOrderId}
                    onClick={() => setBucket(bucketEditorFor.workOrderId, b)}
                    className="rounded-lg border px-3 py-2 text-left hover:bg-slate-50 disabled:opacity-40"
                  >
                    Set to {b}
                  </button>
                ))}
              </div>

              <button
                className="mt-3 rounded-lg border px-3 py-2 text-sm"
                onClick={() => setBucketEditorFor(null)}
                disabled={busyId === bucketEditorFor.workOrderId}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}

function Kpi({ label, value, tone = 'slate' }: { label: string; value: number; tone?: 'slate' | 'emerald' | 'amber' | 'rose' }) {
  const tones: Record<string, string> = {
    slate: 'text-slate-900',
    emerald: 'text-emerald-700',
    amber: 'text-amber-700',
    rose: 'text-rose-700',
  }

  return (
    <div className="card-soft p-3">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`text-2xl font-bold ${tones[tone]}`}>{value}</p>
    </div>
  )
}
