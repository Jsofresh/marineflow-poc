'use client'

import { useEffect, useMemo, useState } from 'react'

type WorkOrderRow = {
  id: string
  status: string
  qbInvoiceId: string | null
  intakeRequest: { customerName: string; vesselName: string | null; location: string }
}

type WallaceInvoice = {
  id: string
  wallaceWorkOrderId: string
  marineflowWorkOrderId: string
  customerName: string
  vesselName?: string | null
  location?: string | null
  createdAt: string
  status: 'DRAFT' | 'READY'
  lines: Array<{ lineType: 'LABOR' | 'PART'; itemCode?: string; description: string; qty: number; unitPrice: number; amount: number }>
}

export default function WallaceExportPage() {
  const [workOrders, setWorkOrders] = useState<WorkOrderRow[]>([])
  const [selectedId, setSelectedId] = useState<string>('')
  const [invoices, setInvoices] = useState<WallaceInvoice[]>([])
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>('')
  const [packet, setPacket] = useState<{
    source: { fileName: string; sha256: string; importedAt: string }
    header: { wallaceWorkOrderId: string; customerName: string; vesselName?: string; location?: string }
    lines: Array<{ lineType: 'LABOR' | 'PART'; itemCode?: string; description: string; qty: number; unitPrice: number; amount: number }>
    totals: { labor: number; parts: number; total: number }
  } | null>(null)
  const [mapping, setMapping] = useState<
    Array<{ lineType: 'LABOR' | 'PART'; itemCode: string | null; description: string; amount: number; qboItem: string; reason: string }> | null
  >(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [qbResult, setQbResult] = useState<
    | null
    | {
        totalsMatch: boolean
        workOrder: { qbInvoiceId: string | null }
      }
  >(null)
  const [showPicker, setShowPicker] = useState(false)

  async function load() {
    const r = await fetch('/api/work-orders/list', { cache: 'no-store' })
    const d = await r.json()
    setWorkOrders(d.workOrders ?? [])
  }

  async function loadInvoices(workOrderId: string) {
    const r = await fetch(`/api/mock/wallace/invoices?workOrderId=${encodeURIComponent(workOrderId)}`, { cache: 'no-store' })
    const d = await r.json()
    setInvoices(d.invoices ?? [])
  }

  useEffect(() => {
    load()
  }, [])

  useEffect(() => {
    if (!selectedId) {
      setInvoices([])
      setSelectedInvoiceId('')
      setPacket(null)
      setMapping(null)
      setQbResult(null)
      setShowPicker(false)
      return
    }
    void loadInvoices(selectedId)
  }, [selectedId])

  const selected = useMemo(() => workOrders.find((w) => w.id === selectedId) ?? null, [workOrders, selectedId])
  const selectedInvoice = useMemo(() => invoices.find((i) => i.id === selectedInvoiceId) ?? null, [invoices, selectedInvoiceId])

  async function createWallaceInvoice() {
    if (!selectedId) {
      setNotice('Select a work order first.')
      return
    }
    setBusy(true)
    setNotice(null)
    try {
      const r = await fetch('/api/mock/wallace/invoices', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ workOrderId: selectedId }),
      })
      const d = await r.json()
      if (!r.ok || !d.ok) {
        setNotice(d?.error ?? 'Could not create Wallace invoice')
        return
      }
      await loadInvoices(selectedId)
      setNotice('Created Wallace invoice (mock).')
    } finally {
      setBusy(false)
    }
  }

  async function openSendPicker() {
    setShowPicker(true)
    setPacket(null)
    setMapping(null)
    setQbResult(null)
    setSelectedInvoiceId('')
  }

  async function reviewSelectedInvoice() {
    if (!selectedInvoice) return
    setBusy(true)
    setNotice(null)
    try {
      // Convert invoice → packet using the server helper (via qb-sync endpoint building audit).
      // We call /api/wallace/export with a pseudo-file by sending JSON is overkill; instead we reuse the mapping logic client-side.
      // For the demo, we keep it simple: ask server to build packet+mapping by calling a small endpoint.
      const r = await fetch('/api/wallace/export-invoice', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ invoice: selectedInvoice }),
      })
      const d = await r.json()
      if (!r.ok || !d.ok) {
        setNotice(d?.error ?? 'Could not build Wallace packet')
        return
      }
      setPacket(d.packet)
      setMapping(d.mapping)
      setNotice('Ready to send to QuickBooks.')
    } finally {
      setBusy(false)
    }
  }

  async function sendToQboDraft() {
    if (!packet || !selectedId) {
      setNotice('Select and review a Wallace invoice first.')
      return
    }
    setBusy(true)
    setNotice(null)
    try {
      const r = await fetch(`/api/work-orders/${selectedId}/qb-sync-wallace`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ packet }),
      })
      const d = await r.json()
      if (!r.ok || !d.ok) {
        setNotice(d?.error ?? 'QBO draft creation failed')
        return
      }
      setQbResult(d)
      setNotice(d.totalsMatch ? 'Sent to QBO (totals match).' : 'Sent to QBO (totals mismatch flagged).')
      await load()
      setShowPicker(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="card-soft p-6">
          <h1 className="text-2xl font-bold">Wallace → QBO demo (mock Wallace invoices)</h1>
          <p className="mt-1 text-sm text-slate-600">
            Create a Wallace invoice from a work order (mock), review it, then send it to QuickBooks Online as a draft invoice (mock) with an audit trail.
          </p>
        </header>

        {notice && <div className="rounded border bg-white p-3 text-sm">{notice}</div>}

        <section className="grid gap-4 md:grid-cols-2">
          <div className="card-soft p-5 space-y-3">
            <h2 className="font-semibold">1) Select work order</h2>
            <select className="w-full rounded border bg-white p-2 text-sm" value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
              <option value="">Select…</option>
              {workOrders.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.intakeRequest.customerName} · {w.intakeRequest.location} · {w.id.slice(-6)} · {w.status}
                </option>
              ))}
            </select>
            {selected && (
              <div className="text-xs text-slate-600">
                Selected: <span className="font-medium">{selected.intakeRequest.customerName}</span> ({selected.id})
              </div>
            )}

            <div className="pt-2">
              <button disabled={busy || !selectedId} onClick={createWallaceInvoice} className="rounded border bg-white px-3 py-2 text-sm disabled:opacity-50">
                {busy ? 'Working…' : 'Create Wallace invoice →'}
              </button>
            </div>
          </div>

          <div className="card-soft p-5 space-y-3">
            <h2 className="font-semibold">2) Created Wallace invoices</h2>
            {invoices.length === 0 ? (
              <p className="text-sm text-slate-600">No Wallace invoices yet. Create one on the left.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {invoices.map((i) => (
                  <li key={i.id} className="rounded border bg-white p-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">{i.wallaceWorkOrderId}</span>
                      <span className="text-xs text-slate-500">{new Date(i.createdAt).toLocaleString()}</span>
                    </div>
                    <div className="text-xs text-slate-600">Lines: {i.lines.length} · Status: {i.status}</div>
                  </li>
                ))}
              </ul>
            )}

            <div className="pt-2">
              <button disabled={busy || !selectedId || invoices.length === 0} onClick={openSendPicker} className="rounded border bg-white px-3 py-2 text-sm disabled:opacity-50">
                {busy ? 'Working…' : 'Send invoice to QuickBooks →'}
              </button>
            </div>

            {showPicker && (
              <div className="mt-3 rounded border bg-white p-3 space-y-2">
                <p className="text-sm font-semibold">Select a Wallace invoice to review</p>
                <select className="w-full rounded border bg-white p-2 text-sm" value={selectedInvoiceId} onChange={(e) => setSelectedInvoiceId(e.target.value)}>
                  <option value="">Select…</option>
                  {invoices.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.wallaceWorkOrderId} · {i.id.slice(-6)} · {new Date(i.createdAt).toLocaleString()}
                    </option>
                  ))}
                </select>
                <div className="flex gap-2">
                  <button disabled={busy || !selectedInvoiceId} onClick={reviewSelectedInvoice} className="rounded border bg-white px-3 py-2 text-sm disabled:opacity-50">
                    Review →
                  </button>
                  <button disabled={busy || !packet} onClick={sendToQboDraft} className="rounded border bg-white px-3 py-2 text-sm disabled:opacity-50">
                    Finalize & send →
                  </button>
                </div>
                <p className="text-xs text-slate-600">Review builds the Wallace Packet + audit trail before sending.</p>
              </div>
            )}
          </div>
        </section>

        {packet && (
          <section className="card-soft p-5 space-y-4">
            <h2 className="text-lg font-semibold">Wallace Packet + Audit Trail</h2>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded border bg-white p-3 text-sm">
                <p className="text-xs uppercase tracking-wide text-slate-500">Source</p>
                <p className="mt-1">Source: <span className="font-mono text-xs">{packet.source.fileName}</span></p>
                <p>SHA256: <span className="font-mono text-xs">{packet.source.sha256}</span></p>
                <p>Imported: <span className="font-mono text-xs">{packet.source.importedAt}</span></p>
              </div>
              <div className="rounded border bg-white p-3 text-sm">
                <p className="text-xs uppercase tracking-wide text-slate-500">Totals</p>
                <p className="mt-1">Labor: <span className="font-mono">${packet.totals.labor}</span></p>
                <p>Parts: <span className="font-mono">${packet.totals.parts}</span></p>
                <p>Total: <span className="font-mono">${packet.totals.total}</span></p>
              </div>
            </div>

            <div className="rounded border bg-white p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Mapping (Wallace → QBO)</p>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-100 text-left">
                    <tr>
                      <th className="p-2">Type</th>
                      <th className="p-2">Item</th>
                      <th className="p-2">Description</th>
                      <th className="p-2">Amount</th>
                      <th className="p-2">QBO Item</th>
                      <th className="p-2">Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(mapping ?? []).map((m, i) => (
                      <tr key={i} className="border-t">
                        <td className="p-2">{m.lineType}</td>
                        <td className="p-2 font-mono text-xs">{m.itemCode ?? '—'}</td>
                        <td className="p-2">{m.description}</td>
                        <td className="p-2 font-mono">${m.amount}</td>
                        <td className="p-2 font-semibold">{m.qboItem}</td>
                        <td className="p-2 text-xs text-slate-600">{m.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {qbResult?.workOrder?.qbInvoiceId && (
              <div className="rounded border bg-white p-3 text-sm">
                <p className="text-xs uppercase tracking-wide text-slate-500">QuickBooks result</p>
                <p className="mt-1">Invoice ID: <span className="font-mono">{qbResult.workOrder.qbInvoiceId}</span></p>
                <p className="text-xs text-slate-600">Totals match: {String(qbResult.totalsMatch)}</p>
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  )
}
