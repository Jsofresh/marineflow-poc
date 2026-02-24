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
  totalBill: number | null
  wallacePaid: boolean
  wallacePaymentUpdatedAt: string | null
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
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null)
  const [reminderFor, setReminderFor] = useState<InvoiceRow | null>(null)

  async function refresh() {
    const d = await fetch('/api/quickbooks/invoices', { cache: 'no-store' }).then((r) => r.json())
    setData({ summary: d.summary, invoices: d.invoices })
    setLastSyncedAt(new Date().toISOString())
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
        setNotice(`Mock email queued for ${d?.reminder?.to ?? 'customer'}.`)
      } else {
        setNotice(d?.error ?? 'Could not queue reminder.')
      }
    } finally {
      setBusyId(null)
    }
  }

  function formatDate(d: Date) {
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
  }

  function buildReminderEmail(i: InvoiceRow) {
    const invoiceId = i.invoiceId ?? `WO-${i.workOrderId.slice(-6).toUpperCase()}`
    const invoiceDate = new Date(i.updatedAt)
    const dueDate = new Date(invoiceDate.getTime() + 7 * 24 * 60 * 60 * 1000)

    const to = i.email ?? ''
    const customer = i.customerName

    if (i.bucket === 'PAID') {
      return {
        to,
        subject: `Payment received — Invoice ${invoiceId}`,
        body:
          `Hi ${customer},\n\n` +
          `Thank you — we’ve received your payment for invoice ${invoiceId}.\n\n` +
          `If you have any questions, just reply to this email and we’ll help.\n\n` +
          `Best,\nCoastline Marine Service`,
        invoiceDate,
        dueDate,
      }
    }

    if (i.bucket === 'DELINQUENT') {
      return {
        to,
        subject: `Past due reminder — Invoice ${invoiceId}`,
        body:
          `Hi ${customer},\n\n` +
          `This is a friendly reminder that invoice ${invoiceId} was due by ${formatDate(dueDate)}. ` +
          `If you’ve already sent payment, please disregard this notice.\n\n` +
          `If you need a copy of the invoice or would like to confirm payment details, reply here and we’ll help.\n\n` +
          `Best,\nCoastline Marine Service`,
        invoiceDate,
        dueDate,
      }
    }

    // WAITING
    return {
      to,
      subject: `Payment reminder — Invoice ${invoiceId}`,
      body:
        `Hi ${customer},\n\n` +
        `A quick reminder that invoice ${invoiceId} is due by ${formatDate(dueDate)}.\n\n` +
        `If you have any questions or need a copy of the invoice, just reply to this email and we’ll help.\n\n` +
        `Best,\nCoastline Marine Service`,
      invoiceDate,
      dueDate,
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

        <div className="card-soft flex flex-wrap items-center justify-between gap-3 p-3 text-sm">
          <div>
            <p className="font-medium">Sync status</p>
            <p className="text-slate-600">Last sync: {lastSyncedAt ? new Date(lastSyncedAt).toLocaleString() : 'Not synced yet'}</p>
          </div>
          <button className="rounded-lg border px-3 py-1 text-xs" onClick={() => refresh()}>Retry sync check</button>
        </div>

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
                      {/* Next action removed */}
                      <th className="p-2">Age</th>
                      <th className="p-2">Updated</th>
                      <th className="p-2">Total bill</th>
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
                        <td className="p-2">
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                              i.qbSyncStatus.includes('FAILED')
                                ? 'bg-rose-100 text-rose-800'
                                : i.qbSyncStatus.includes('PENDING')
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-emerald-100 text-emerald-800'
                            }`}
                            title="Stripe-style lifecycle clarity: pending/failed/success"
                          >
                            {i.qbSyncStatus.replaceAll('QB', 'QuickBooks')}
                          </span>
                        </td>
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
                        {/* Next action removed */}
                        <td className="p-2">{i.ageDays}d</td>
                        <td className="p-2">{new Date(i.updatedAt).toLocaleDateString()}</td>
                        <td className="p-2 font-medium">
                          {typeof i.totalBill === 'number' ? `$${i.totalBill.toFixed(2)}` : '—'}
                        </td>
                        <td className="p-2">
                          <button
                            disabled={busyId === i.workOrderId}
                            onClick={() => setReminderFor(i)}
                            className="rounded-lg border px-2 py-1 text-xs disabled:opacity-40"
                            title="Open reminder email (mock)"
                          >
                            {busyId === i.workOrderId ? 'Working…' : 'Remind customer'}
                          </button>
                        </td>
                      </tr>
                    ))}

                    {visible.length === 0 && (
                      <tr>
                        <td colSpan={8} className="p-4 text-slate-500">No invoices in this filter.</td>
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

        {reminderFor && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4">
            <div className="w-full max-w-2xl rounded-2xl border bg-white p-4 shadow-lg">
              <p className="text-xs uppercase tracking-wide text-slate-500">Mock email</p>
              <h2 className="mt-1 text-lg font-semibold">Payment reminder</h2>
              <p className="text-sm text-slate-600">
                Drafted email for <span className="font-medium">{reminderFor.customerName}</span>
              </p>

              {(() => {
                const draft = buildReminderEmail(reminderFor)
                const canSend = Boolean(draft.to)

                return (
                  <div className="mt-4 space-y-3 text-sm">
                    <div className="grid gap-2 md:grid-cols-2">
                      <div>
                        <p className="text-xs text-slate-500">To</p>
                        <div className="rounded-lg border bg-slate-50 px-3 py-2">{draft.to || 'Customer email missing'}</div>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Subject</p>
                        <div className="rounded-lg border bg-slate-50 px-3 py-2">{draft.subject}</div>
                      </div>
                    </div>

                    <div>
                      <p className="text-xs text-slate-500">Body</p>
                      <textarea
                        className="mt-1 w-full rounded-lg border bg-white p-3 font-mono text-xs"
                        rows={10}
                        value={draft.body}
                        readOnly
                      />
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-xs text-slate-500">
                        Invoice updated: {formatDate(new Date(reminderFor.updatedAt))} • Due date example: {formatDate(draft.dueDate)}
                      </div>

                      <div className="flex gap-2">
                        <button
                          className="rounded-lg border px-3 py-2 text-sm"
                          onClick={() => setReminderFor(null)}
                          disabled={busyId === reminderFor.workOrderId}
                        >
                          Close
                        </button>
                        <button
                          className="rounded-lg bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-40"
                          disabled={!canSend || busyId === reminderFor.workOrderId}
                          onClick={async () => {
                            await remindCustomer(reminderFor.workOrderId)
                            setReminderFor(null)
                          }}
                        >
                          {busyId === reminderFor.workOrderId ? 'Sending…' : 'Send (mock)'}
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })()}
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
