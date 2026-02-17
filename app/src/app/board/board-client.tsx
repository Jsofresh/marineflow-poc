'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'

type WorkOrder = {
  id: string
  status: string
  updatedAt?: string
  qbSyncStatus: string
  qbRetryCount: number
  qbInvoiceId: string | null
  qbLastError: string | null
  wallaceSyncStatus: string
  automationState?: string
  nextAction?: string
  intakeRequest: {
    customerName: string
    serviceRequest: string
    location: string
    vesselName?: string | null
  }
}

type QbPreview = {
  DocNumber: string
  CustomerRef: { name: string }
  CustomerMemo: { value: string }
  PrivateNote: string
  TxnDate: string
  Line: Array<{
    Amount: number
    Description: string
  }>
  BillEmail?: { Address: string }
}

type Intake = {
  id: string
  customerName: string
  serviceRequest: string
  location: string
  workOrders: { id: string }[]
}

type Notice =
  | { kind: 'success'; message: string }
  | { kind: 'error'; message: string }
  | null

const statuses = ['NEW', 'APPROVED', 'PARTS_ORDERED', 'IN_PROGRESS', 'COMPLETE', 'INVOICED'] as const

type Status = (typeof statuses)[number]

export default function BoardClient() {
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([])
  const [intakes, setIntakes] = useState<Intake[]>([])
  const [busyId, setBusyId] = useState<string | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [previewById, setPreviewById] = useState<Record<string, QbPreview | null>>({})
  const [expandedPreviewById, setExpandedPreviewById] = useState<Record<string, boolean>>({})
  const [showStuckOnly, setShowStuckOnly] = useState(false)
  const [stuckHours, setStuckHours] = useState(24)
  const [nowMs, setNowMs] = useState(0)
  const [notice, setNotice] = useState<Notice>(null)
  const [manualOverride, setManualOverride] = useState(false)

  async function load() {
    const [woRes, intakeRes] = await Promise.all([
      fetch('/api/work-orders/list', { cache: 'no-store' }),
      fetch('/api/intake/list', { cache: 'no-store' }),
    ])

    const woData = await woRes.json()
    const intakeData = await intakeRes.json()

    setWorkOrders(woData.workOrders || [])
    setIntakes(intakeData.intakes || [])
  }

  useEffect(() => {
    load()
    setNowMs(Date.now())
    const t = setInterval(() => setNowMs(Date.now()), 60000)
    return () => clearInterval(t)
  }, [])

  const filteredOrders = useMemo(() => {
    if (!showStuckOnly) return workOrders
    const thresholdMs = nowMs - stuckHours * 60 * 60 * 1000
    return workOrders.filter((wo: WorkOrder & { updatedAt?: string }) => {
      if (wo.status === 'INVOICED') return false
      const updatedAt = wo.updatedAt ? new Date(wo.updatedAt).getTime() : nowMs
      return updatedAt < thresholdMs
    })
  }, [workOrders, showStuckOnly, stuckHours, nowMs])

  const grouped = useMemo(() => {
    const map: Record<Status, WorkOrder[]> = {
      NEW: [],
      APPROVED: [],
      PARTS_ORDERED: [],
      IN_PROGRESS: [],
      COMPLETE: [],
      INVOICED: [],
    }
    for (const wo of filteredOrders) {
      const normalizedStatus = wo.status === 'QC' || wo.status === 'QUALITY_CONTROL' ? 'IN_PROGRESS' : wo.status
      const key = (statuses.includes(normalizedStatus as Status) ? normalizedStatus : 'NEW') as Status
      map[key].push(wo)
    }
    return map
  }, [filteredOrders])

  const unassigned = useMemo(() => intakes.filter((i) => i.workOrders.length === 0), [intakes])

  async function deleteIntake(intakeId: string, customerName: string) {
    const ok = window.confirm(`Delete intake for ${customerName}? This cannot be undone.`)
    if (!ok) return

    setBusyId(intakeId)
    setNotice(null)
    try {
      const res = await fetch(`/api/intake/${intakeId}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))

      if (res.ok && data?.ok) {
        setNotice({ kind: 'success', message: 'Intake deleted.' })
      } else {
        setNotice({ kind: 'error', message: data?.error ?? 'Could not delete intake.' })
      }
    } catch {
      setNotice({ kind: 'error', message: 'Network error while deleting intake.' })
    } finally {
      await load()
      setBusyId(null)
    }
  }

  async function createWorkOrder(intakeRequestId: string) {
    setBusyId(intakeRequestId)
    setNotice(null)
    try {
      const res = await fetch('/api/work-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intakeRequestId }),
      })
      const data = await res.json().catch(() => ({}))

      if (res.ok && data?.ok) {
        setNotice({ kind: 'success', message: 'Work order created.' })
      } else {
        setNotice({ kind: 'error', message: data?.error ?? 'Could not create work order.' })
      }
    } catch {
      setNotice({ kind: 'error', message: 'Network error while creating work order.' })
    } finally {
      await load()
      setBusyId(null)
    }
  }


  async function deleteWorkOrder(id: string, customerName: string) {
    const ok = window.confirm(`Delete work order for ${customerName}? This cannot be undone.`)
    if (!ok) return

    setBusyId(id)
    setNotice(null)
    try {
      const res = await fetch(`/api/work-orders/${id}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))

      if (res.ok && data?.ok) {
        setNotice({ kind: 'success', message: 'Work order deleted.' })
      } else {
        setNotice({ kind: 'error', message: data?.error ?? 'Could not delete work order.' })
      }
    } catch {
      setNotice({ kind: 'error', message: 'Network error while deleting work order.' })
    } finally {
      await load()
      setBusyId(null)
    }
  }

  async function setStatus(id: string, status: Status) {
    setBusyId(id)
    setNotice(null)
    try {
      const res = await fetch(`/api/work-orders/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      const data = await res.json().catch(() => ({}))

      if (res.ok && data?.ok) {
        setNotice({ kind: 'success', message: `Moved to ${status}.` })
      } else {
        setNotice({ kind: 'error', message: data?.error ?? 'Could not update status.' })
      }
    } catch {
      setNotice({ kind: 'error', message: 'Network error while updating status.' })
    } finally {
      await load()
      setBusyId(null)
    }
  }


  async function togglePreviewQB(id: string) {
    const isOpen = Boolean(expandedPreviewById[id])
    if (isOpen) {
      setExpandedPreviewById((prev) => ({ ...prev, [id]: false }))
      return
    }

    if (!previewById[id]) {
      setBusyId(id)
      setNotice(null)
      const res = await fetch(`/api/work-orders/${id}/qb-preview`, { cache: 'no-store' })
      const data = await res.json()
      setPreviewById((prev) => ({ ...prev, [id]: data?.payload ?? null }))
      setBusyId(null)
    }

    setExpandedPreviewById((prev) => ({ ...prev, [id]: true }))
  }

  async function approveInvoice(id: string) {
    setBusyId(id)
    setNotice(null)
    try {
      const res = await fetch(`/api/work-orders/${id}/approve-invoice`, { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data?.ok) {
        setNotice({ kind: 'success', message: 'Invoice approved. Wallace packet queued automatically.' })
      } else {
        setNotice({ kind: 'error', message: data?.error ?? 'Could not approve invoice.' })
      }
    } catch {
      setNotice({ kind: 'error', message: 'Network error while approving invoice.' })
    } finally {
      await load()
      setBusyId(null)
    }
  }


  async function runWorkOrderEvent(id: string, event: 'PARTS_ARRIVED' | 'TECH_COMPLETE') {
    setBusyId(id)
    setNotice(null)
    try {
      const res = await fetch(`/api/work-orders/${id}/event`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data?.ok) {
        setNotice({ kind: 'success', message: event === 'PARTS_ARRIVED' ? 'Parts arrived recorded.' : 'Technician completion recorded.' })
      } else {
        setNotice({ kind: 'error', message: data?.error ?? 'Could not process event.' })
      }
    } catch {
      setNotice({ kind: 'error', message: 'Network error while processing event.' })
    } finally {
      await load()
      setBusyId(null)
    }
  }

  async function onDropStatus(status: Status) {
    if (!draggingId) return
    await setStatus(draggingId, status)
    setDraggingId(null)
  }

  return (
    <main className="min-h-screen bg-slate-50 p-6 space-y-6">
      <div className="mx-auto max-w-7xl space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Work order board</h1>
            <p className="text-sm text-slate-600">Create work orders from requests, then drag cards to update status.</p>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Link href="/" className="underline">
              Home
            </Link>
            <Link href="/intake" className="underline">
              New request
            </Link>
            <Link href="/wallace-queue" className="underline">
              Wallace fallback
            </Link>
            <label className="text-xs flex items-center gap-1">
              <input type="checkbox" checked={manualOverride} onChange={(e) => setManualOverride(e.target.checked)} />
              Manual override
            </label>
            <a
              href="/api/work-orders/export.csv"
              className="text-xs px-2 py-1 rounded border bg-white hover:bg-slate-100"
            >
              Export CSV
            </a>
          </div>
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

        <section className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold">Unassigned requests</h2>
              <p className="text-sm text-slate-600">These are submitted intakes that still need a work order.</p>
            </div>
            <p className="text-xs text-slate-500">Tip: click “Create work order” to put it into NEW.</p>
          </div>

          {unassigned.length === 0 ? (
            <div className="rounded border bg-white p-4 text-sm text-slate-700">
              <p className="font-semibold">No unassigned requests</p>
              <p className="text-slate-600">New requests will appear here after they’re submitted.</p>
            </div>
          ) : (
            unassigned.map((i) => (
              <div key={i.id} className="border rounded bg-white p-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium">
                    {i.customerName} · {i.location}
                  </p>
                  <p className="text-sm text-slate-600">{i.serviceRequest}</p>
                  <p className="text-xs text-slate-500">Intake {i.id}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    className="px-3 py-1 rounded bg-blue-600 text-white disabled:opacity-50"
                    onClick={() => createWorkOrder(i.id)}
                    disabled={busyId === i.id}
                  >
                    {busyId === i.id ? 'Creating…' : 'Create work order'}
                  </button>
                  <button
                    className="px-3 py-1 rounded bg-red-600 text-white disabled:opacity-50"
                    onClick={() => deleteIntake(i.id, i.customerName)}
                    disabled={busyId === i.id}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </section>

        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold">Pipeline</h2>
              <p className="text-sm text-slate-600">Drag a card into a new column to update its stage.</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <label className="text-xs flex items-center gap-2">
                <input type="checkbox" checked={showStuckOnly} onChange={(e) => setShowStuckOnly(e.target.checked)} />
                Show stuck only
              </label>
              <label className="text-xs flex items-center gap-1">
                Stuck for
                <input
                  className="w-14 rounded border px-1 py-0.5"
                  type="number"
                  min={1}
                  value={stuckHours}
                  onChange={(e) => setStuckHours(Number(e.target.value || 24))}
                />
                hours
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {statuses.map((status) => (
              <div
                key={status}
                className="border rounded p-3 min-h-[220px] bg-white"
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => manualOverride && onDropStatus(status)}
              >
                <p className="font-semibold mb-2">{status}</p>
                <div className="space-y-2">
                  {grouped[status].map((wo) => (
                    <div
                      key={wo.id}
                      draggable={manualOverride}
                      onDragStart={() => setDraggingId(wo.id)}
                      onDragEnd={() => setDraggingId(null)}
                      className={`bg-slate-50 border rounded p-2 ${manualOverride ? 'cursor-move' : 'cursor-default'}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium">{wo.intakeRequest.customerName}</p>
                          <p className="text-xs text-gray-600">{wo.intakeRequest.location}</p>
                        </div>
                        <p className="text-[10px] text-slate-500">WO {wo.id}</p>
                      </div>
                      <p className="text-xs mt-1 text-slate-700">Boat: {wo.intakeRequest.vesselName ?? 'Unknown vessel'}</p>

                      <p className="text-xs mt-2">
                        QuickBooks: <b>{wo.qbSyncStatus}</b> · attempts {wo.qbRetryCount}
                      </p>
                      {wo.qbInvoiceId && <p className="text-xs">Invoice: {wo.qbInvoiceId}</p>}
                      <p className="text-xs mt-1">Automation: <b>{wo.automationState ?? 'IDLE'}</b></p>
                      <p className="text-xs text-slate-600">Next: {wo.nextAction ?? 'Await manager action'}</p>
                      {wo.qbLastError && <p className="text-xs text-red-700">{wo.qbLastError}</p>}

                      <div className="mt-2 flex flex-wrap gap-1">
                        <button
                          className="px-2 py-1 rounded bg-slate-700 text-white text-xs disabled:opacity-50"
                          onClick={() => togglePreviewQB(wo.id)}
                          disabled={busyId === wo.id}
                        >
                          {expandedPreviewById[wo.id] ? 'Hide invoice' : 'Invoice preview'}
                        </button>
                        <button
                          className="px-2 py-1 rounded bg-emerald-700 text-white text-xs disabled:opacity-50"
                          onClick={() => approveInvoice(wo.id)}
                          disabled={busyId === wo.id || !['NEW', 'APPROVED'].includes(wo.status)}
                        >
                          Approve invoice
                        </button>
                        <button
                          className="px-2 py-1 rounded bg-amber-600 text-white text-xs disabled:opacity-50"
                          onClick={() => runWorkOrderEvent(wo.id, 'PARTS_ARRIVED')}
                          disabled={busyId === wo.id || !['PARTS_ORDERED','APPROVED'].includes(wo.status)}
                        >
                          Parts arrived
                        </button>
                        <button
                          className="px-2 py-1 rounded bg-violet-700 text-white text-xs disabled:opacity-50"
                          onClick={() => runWorkOrderEvent(wo.id, 'TECH_COMPLETE')}
                          disabled={busyId === wo.id || wo.status !== 'IN_PROGRESS'}
                        >
                          Tech complete
                        </button>
                        <button
                          className="px-2 py-1 rounded bg-red-600 text-white text-xs disabled:opacity-50"
                          onClick={() => deleteWorkOrder(wo.id, wo.intakeRequest.customerName)}
                          disabled={busyId === wo.id}
                        >
                          Delete
                        </button>
                      </div>

                      {previewById[wo.id] && expandedPreviewById[wo.id] && (
                        <div className="mt-2 rounded border bg-white p-2 text-xs">
                          <p>
                            <b>Doc:</b> {previewById[wo.id]?.DocNumber}
                          </p>
                          <p>
                            <b>Customer:</b> {previewById[wo.id]?.CustomerRef.name}
                          </p>
                          <p>
                            <b>Email:</b> {previewById[wo.id]?.BillEmail?.Address ?? 'N/A'}
                          </p>
                          <p>
                            <b>Date:</b> {previewById[wo.id]?.TxnDate}
                          </p>
                          <p>
                            <b>Memo:</b> {previewById[wo.id]?.CustomerMemo.value}
                          </p>
                          <p className="mt-1">
                            <b>Boat:</b> {wo.intakeRequest.vesselName ?? 'Unknown vessel'}
                          </p>
                          <p className="mt-1 whitespace-pre-wrap">
                            <b>Full request:</b> {wo.intakeRequest.serviceRequest}
                          </p>
                          <ul className="list-disc ml-4 mt-1">
                            {previewById[wo.id]?.Line.map((line, idx) => (
                              <li key={idx}>
                                {line.Description} — ${line.Amount}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                    </div>
                  ))}
                  {grouped[status].length === 0 && (
                    <p className="text-xs text-slate-500">No work orders in this stage.</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  )
}
