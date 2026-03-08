'use client'

import { useEffect, useMemo, useState } from 'react'

type WorkOrderRow = {
  id: string
  status: string
  wallaceEntered: boolean
  wallaceExternalId: string | null
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
  const [notice, setNotice] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [qbResult, setQbResult] = useState<{ totalsMatch: boolean; workOrder: { qbInvoiceId: string | null } } | null>(null)
  const [reviewState, setReviewState] = useState<'idle' | 'reviewing' | 'ready'>('idle')
  const [advancing, setAdvancing] = useState(false)

  async function load() {
    const r = await fetch('/api/work-orders/list', { cache: 'no-store' })
    const d = await r.json()
    setWorkOrders(d.workOrders ?? [])
  }

  async function loadInvoices(workOrderId: string) {
    const r = await fetch(`/api/mock/wallace/invoices?workOrderId=${encodeURIComponent(workOrderId)}`, { cache: 'no-store' })
    const d = await r.json()
    return (d.invoices ?? []) as WallaceInvoice[]
  }

  useEffect(() => {
    load()
  }, [])

  // When selection changes, reset state and auto-load invoices for ready orders
  useEffect(() => {
    setPacket(null)
    setMapping(null)
    setQbResult(null)
    setInvoices([])
    setReviewState('idle')
    setNotice(null)

    if (!selectedId) return

    void loadInvoices(selectedId).then((invs) => {
      setInvoices(invs)
    })
  }, [selectedId])

  const selected = useMemo(() => workOrders.find((w) => w.id === selectedId) ?? null, [workOrders, selectedId])

  // Three groups reflecting Wallace's scan state
  const woGroups = useMemo(() => ({
    // Wallace has scanned + invoiced these — ready to push to QuickBooks
    readyForQB: workOrders.filter((w) => w.wallaceEntered && w.status === 'COMPLETE' && !w.qbInvoiceId),
    // Still in the shop / not yet fully processed by Wallace
    notReady:   workOrders.filter((w) => !w.qbInvoiceId && !(w.wallaceEntered && w.status === 'COMPLETE')),
    // Already exported to QuickBooks
    inBoth:     workOrders.filter((w) => !!w.qbInvoiceId),
  }), [workOrders])

  const selectedGroup = useMemo(() => {
    if (!selected) return null
    if (woGroups.readyForQB.some((w) => w.id === selected.id)) return 'ready'
    if (woGroups.inBoth.some((w) => w.id === selected.id)) return 'done'
    return 'notReady'
  }, [selected, woGroups])

  async function advanceToWallace() {
    if (!selectedId) return
    setAdvancing(true)
    setNotice(null)
    try {
      const r = await fetch('/api/mock/wallace/advance-order', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ workOrderId: selectedId }),
      })
      const d = await r.json()
      if (!r.ok || !d.ok) {
        setNotice({ kind: 'err', text: d?.error ?? 'Demo advance failed' })
        return
      }
      setNotice({ kind: 'ok', text: '✓ Demo override: order moved to Wallace · Ready for QuickBooks.' })
      await load()
      // Reload invoices now that a Wallace invoice was auto-created
      const invs = await loadInvoices(selectedId)
      setInvoices(invs)
    } finally {
      setAdvancing(false)
    }
  }

  async function reviewAndSend() {
    if (!selectedId || invoices.length === 0) {
      setNotice({ kind: 'err', text: 'No Wallace invoice found for this order. Try running Simulate Workday first.' })
      return
    }

    const invoice = invoices[0]
    setBusy(true)
    setReviewState('reviewing')
    setNotice(null)

    try {
      // Step 1: Build Wallace packet + QBO mapping
      const rReview = await fetch('/api/wallace/export-invoice', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ invoice }),
      })
      const dReview = await rReview.json()
      if (!rReview.ok || !dReview.ok) {
        setNotice({ kind: 'err', text: dReview?.error ?? 'Could not build Wallace packet' })
        setReviewState('idle')
        return
      }

      setPacket(dReview.packet)
      setMapping(dReview.mapping)
      setReviewState('ready')

      // Step 2: Send to QuickBooks
      const rSend = await fetch(`/api/work-orders/${selectedId}/qb-sync-wallace`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ packet: dReview.packet }),
      })
      const dSend = await rSend.json()
      if (!rSend.ok || !dSend.ok) {
        setNotice({ kind: 'err', text: dSend?.error ?? 'QuickBooks export failed' })
        return
      }

      setQbResult(dSend)
      setNotice({
        kind: 'ok',
        text: dSend.totalsMatch
          ? '✓ Sent to QuickBooks — totals match.'
          : '⚠ Sent to QuickBooks — totals mismatch flagged for review.',
      })
      await load()
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="card-soft p-6">
          <h1 className="text-2xl font-bold">Wallace → QuickBooks</h1>
          <p className="mt-1 text-sm text-slate-600">
            Wallace automatically scans completed jobs and generates invoices. Select a ready invoice below to review and export to QuickBooks Online.
          </p>
        </header>

        {notice && (
          <div className={`rounded border p-3 text-sm ${notice.kind === 'ok' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-800'}`}>
            {notice.text}
          </div>
        )}

        {/* ── Step 1: Work order picker ── */}
        <section className="card-soft p-5 space-y-4">
          <h2 className="font-semibold text-slate-800">1) Select a work order</h2>

          <div className="grid gap-4 md:grid-cols-3">
            {/* Group A — In Wallace, ready for QuickBooks */}
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 space-y-2">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                  In Wallace · Ready for QuickBooks
                </p>
              </div>
              <p className="text-xs text-emerald-600">Wallace scanned &amp; invoiced — awaiting QBO export</p>
              {woGroups.readyForQB.length === 0 ? (
                <p className="text-xs italic text-slate-400">None ready yet — run Simulate Workday</p>
              ) : (
                <ul className="space-y-1">
                  {woGroups.readyForQB.map((w) => (
                    <li key={w.id}>
                      <button
                        onClick={() => setSelectedId(w.id === selectedId ? '' : w.id)}
                        className={`w-full rounded border px-2 py-1.5 text-left text-xs transition-colors ${
                          w.id === selectedId
                            ? 'border-emerald-500 bg-emerald-100 font-semibold'
                            : 'border-transparent bg-white hover:border-emerald-300'
                        }`}
                      >
                        <span className="font-medium">{w.intakeRequest.customerName}</span>
                        <span className="text-slate-500"> · {w.intakeRequest.location}</span>
                        <span className="ml-1 font-mono text-slate-400">#{w.id.slice(-6)}</span>
                        {w.wallaceExternalId && (
                          <span className="ml-1 text-emerald-600 font-mono text-[10px]">{w.wallaceExternalId}</span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Group B — Not yet processed by Wallace */}
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-2">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-amber-400" />
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                  In Progress · Not Ready
                </p>
              </div>
              <p className="text-xs text-amber-600">Still in the shop — Wallace hasn't invoiced yet</p>
              {woGroups.notReady.length === 0 ? (
                <p className="text-xs italic text-slate-400">None</p>
              ) : (
                <ul className="space-y-1">
                  {woGroups.notReady.map((w) => (
                    <li key={w.id}>
                      <button
                        onClick={() => setSelectedId(w.id === selectedId ? '' : w.id)}
                        className={`w-full rounded border px-2 py-1.5 text-left text-xs transition-colors ${
                          w.id === selectedId
                            ? 'border-amber-500 bg-amber-100 font-semibold'
                            : 'border-transparent bg-white hover:border-amber-300'
                        }`}
                      >
                        <span className="font-medium">{w.intakeRequest.customerName}</span>
                        <span className="text-slate-500"> · {w.intakeRequest.location}</span>
                        <span className="ml-1 font-mono text-slate-400">#{w.id.slice(-6)}</span>
                        <span className="ml-1 text-amber-600">({w.status})</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Group C — Already in QuickBooks */}
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-slate-400" />
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                  In QuickBooks · Done
                </p>
              </div>
              <p className="text-xs text-slate-500">Exported to QuickBooks — invoice created</p>
              {woGroups.inBoth.length === 0 ? (
                <p className="text-xs italic text-slate-400">None yet</p>
              ) : (
                <ul className="space-y-1 max-h-48 overflow-y-auto">
                  {woGroups.inBoth.map((w) => (
                    <li key={w.id}>
                      <button
                        onClick={() => setSelectedId(w.id === selectedId ? '' : w.id)}
                        className={`w-full rounded border px-2 py-1.5 text-left text-xs transition-colors ${
                          w.id === selectedId
                            ? 'border-slate-500 bg-slate-200 font-semibold'
                            : 'border-transparent bg-white hover:border-slate-300'
                        }`}
                      >
                        <span className="font-medium">{w.intakeRequest.customerName}</span>
                        <span className="text-slate-500"> · {w.intakeRequest.location}</span>
                        <span className="ml-1 font-mono text-slate-400">#{w.id.slice(-6)}</span>
                        <span className="ml-1 font-mono text-slate-400">QBO: {w.qbInvoiceId?.slice(-8)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>

        {/* ── Step 2: Review & Send ── */}
        {selected && (
          <section className="card-soft p-5 space-y-4">
            <h2 className="font-semibold text-slate-800">2) Review &amp; Send to QuickBooks</h2>

            {selectedGroup === 'notReady' && (
              <div className="rounded border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-medium">⏳ Still in progress</p>
                    <p className="mt-1 text-xs">
                      This work order hasn't been fully processed by Wallace yet. Run <strong>Simulate Workday</strong> on the dashboard to advance it through the pipeline.
                    </p>
                  </div>
                  <button
                    onClick={advanceToWallace}
                    disabled={advancing}
                    title="Demo override: skip pipeline simulation and move this order directly to Wallace · Ready for QuickBooks"
                    className="shrink-0 rounded border border-amber-400 bg-white px-3 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-50 transition-colors whitespace-nowrap"
                  >
                    {advancing ? 'Moving…' : '⚡ Demo override →'}
                  </button>
                </div>
              </div>
            )}

            {selectedGroup === 'done' && (
              <div className="rounded border border-slate-200 bg-white p-4 text-sm">
                <p className="font-medium text-slate-700">✓ Already exported to QuickBooks</p>
                <p className="mt-1 text-xs text-slate-500">
                  QuickBooks invoice: <span className="font-mono">{selected.qbInvoiceId}</span>
                </p>
              </div>
            )}

            {selectedGroup === 'ready' && !qbResult && (
              <div className="space-y-3">
                {invoices.length > 0 ? (
                  <div className="rounded border bg-white p-4 space-y-2">
                    <p className="text-xs uppercase tracking-wide text-slate-500 font-semibold">Wallace Invoice</p>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
                      <span className="text-slate-500">Customer</span>
                      <span className="font-medium">{invoices[0].customerName}</span>
                      <span className="text-slate-500">Work order</span>
                      <span className="font-mono text-xs">{invoices[0].wallaceWorkOrderId}</span>
                      <span className="text-slate-500">Lines</span>
                      <span>{invoices[0].lines.length} ({invoices[0].lines.filter(l => l.lineType === 'LABOR').length} labor, {invoices[0].lines.filter(l => l.lineType === 'PART').length} parts)</span>
                      <span className="text-slate-500">Total</span>
                      <span className="font-semibold">
                        ${invoices[0].lines.reduce((s, l) => s + l.amount, 0).toFixed(2)}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="rounded border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
                    Wallace invoice not found in memory. Try running Simulate Workday again — invoices reset on server restart.
                  </div>
                )}

                <button
                  disabled={busy || invoices.length === 0}
                  onClick={reviewAndSend}
                  className="rounded border border-emerald-500 bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                >
                  {busy
                    ? reviewState === 'reviewing'
                      ? 'Building audit trail…'
                      : 'Sending to QuickBooks…'
                    : 'Send to QuickBooks →'}
                </button>
                <p className="text-xs text-slate-500">Builds Wallace packet + audit trail, then creates draft invoice in QuickBooks Online.</p>
              </div>
            )}

            {selectedGroup === 'ready' && qbResult?.workOrder?.qbInvoiceId && (
              <div className="rounded border border-emerald-200 bg-emerald-50 p-4 text-sm space-y-1">
                <p className="font-semibold text-emerald-800">✓ Sent to QuickBooks</p>
                <p className="text-xs text-emerald-700">Invoice ID: <span className="font-mono">{qbResult.workOrder.qbInvoiceId}</span></p>
                <p className="text-xs text-emerald-700">Totals match: <span className="font-medium">{String(qbResult.totalsMatch)}</span></p>
              </div>
            )}
          </section>
        )}

        {/* ── Audit trail (shown after review) ── */}
        {packet && (
          <section className="card-soft p-5 space-y-4">
            <h2 className="text-lg font-semibold">Wallace Packet + Audit Trail</h2>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded border bg-white p-3 text-sm">
                <p className="text-xs uppercase tracking-wide text-slate-500">Source</p>
                <p className="mt-1">File: <span className="font-mono text-xs">{packet.source.fileName}</span></p>
                <p>Imported: <span className="font-mono text-xs">{packet.source.importedAt}</span></p>
              </div>
              <div className="rounded border bg-white p-3 text-sm">
                <p className="text-xs uppercase tracking-wide text-slate-500">Totals</p>
                <p className="mt-1">Labor: <span className="font-mono">${packet.totals.labor}</span></p>
                <p>Parts: <span className="font-mono">${packet.totals.parts}</span></p>
                <p className="font-semibold">Total: <span className="font-mono">${packet.totals.total}</span></p>
              </div>
            </div>

            {mapping && (
              <div className="rounded border bg-white p-3">
                <p className="text-xs uppercase tracking-wide text-slate-500 mb-2">Mapping (Wallace → QBO)</p>
                <div className="overflow-x-auto">
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
                      {mapping.map((m, i) => (
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
            )}
          </section>
        )}
      </div>
    </main>
  )
}
