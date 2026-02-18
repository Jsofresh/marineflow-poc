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

type TimelineEntry = {
  id: string
  action: string
  message: string
  createdAt: string
}

const statuses = ['NEW', 'APPROVED', 'PARTS_ORDERED', 'IN_PROGRESS', 'COMPLETE', 'INVOICED'] as const

type Status = (typeof statuses)[number]

export default function BoardClient() {
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([])
  const [intakes, setIntakes] = useState<Intake[]>([])
  const [busyId, setBusyId] = useState<string | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [showStuckOnly, setShowStuckOnly] = useState(false)
  const [stuckHours, setStuckHours] = useState(24)
  const [nowMs, setNowMs] = useState(0)
  const [notice, setNotice] = useState<Notice>(null)
  const [manualOverride, setManualOverride] = useState(false)
  const [timelineById, setTimelineById] = useState<Record<string, TimelineEntry[]>>({})
  const [showTimelineById, setShowTimelineById] = useState<Record<string, boolean>>({})

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

  async function toggleTimeline(id: string) {
    const open = Boolean(showTimelineById[id])
    if (open) {
      setShowTimelineById((prev) => ({ ...prev, [id]: false }))
      return
    }

    if (!timelineById[id]) {
      const res = await fetch(`/api/work-orders/${id}/timeline`, { cache: 'no-store' })
      const data = await res.json().catch(() => ({}))
      const entries = Array.isArray(data?.timeline) ? data.timeline : []
      setTimelineById((prev) => ({ ...prev, [id]: entries }))
    }

    setShowTimelineById((prev) => ({ ...prev, [id]: true }))
  }

  async function onDropStatus(status: Status) {
    if (!draggingId) return
    await setStatus(draggingId, status)
    setDraggingId(null)
  }

  return (
    <main className="min-h-screen p-6 space-y-6">
      <div className="mx-auto max-w-[1400px] space-y-4">
        <div className="card-soft flex flex-wrap items-start justify-between gap-3 p-4">
          <div>
            <h1 className="text-2xl font-bold">Work order board</h1>
            <p className="text-sm text-slate-600">Automation-first pipeline with exception-only manual controls.</p>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Link href="/" className="rounded-lg px-2 py-1 hover:bg-slate-100">
              Home
            </Link>
            <Link href="/intake" className="rounded-lg px-2 py-1 hover:bg-slate-100">
              New request
            </Link>
            <Link href="/wallace-queue" className="rounded-lg px-2 py-1 hover:bg-slate-100">
              Wallace fallback
            </Link>
            <label className="text-xs flex items-center gap-1">
              <input type="checkbox" checked={manualOverride} onChange={(e) => setManualOverride(e.target.checked)} />
              Manual override
            </label>
            <a
              href="/api/work-orders/export.csv"
              className="text-xs px-2 py-1 rounded-lg border bg-white hover:bg-slate-100"
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

        <section className="card-soft space-y-3 p-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold">Unassigned requests</h2>
              <p className="text-sm text-slate-600">These are submitted intakes that still need a work order.</p>
            </div>
            <p className="text-xs text-slate-500">Tip: click “Create work order” to put it into NEW.</p>
          </div>

          {unassigned.length === 0 ? (
            <div className="card-soft p-4 text-sm text-slate-700">
              <p className="font-semibold">No unassigned requests</p>
              <p className="text-slate-600">New requests will appear here after they’re submitted.</p>
            </div>
          ) : (
            unassigned.map((i) => (
              <div key={i.id} className="card-soft flex flex-wrap items-center justify-between gap-3 p-3">
                <div>
                  <p className="font-medium">
                    {i.customerName} · {i.location}
                  </p>
                  <p className="text-sm text-slate-600">{i.serviceRequest}</p>
                  <p className="text-xs text-slate-500">Intake {i.id}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    className="px-3 py-1 rounded-xl bg-slate-900 text-white disabled:opacity-50 hover:bg-slate-700"
                    onClick={() => createWorkOrder(i.id)}
                    disabled={busyId === i.id}
                  >
                    {busyId === i.id ? 'Creating…' : 'Create work order'}
                  </button>
                  <button
                    className="px-3 py-1 rounded-xl bg-rose-600 text-white disabled:opacity-50 hover:bg-rose-500"
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

        <section className="card-soft space-y-3 p-4">
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

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6 gap-4">
            {statuses.map((status) => (
              <div
                key={status}
                className="card-soft p-3 min-h-[240px]"
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
                      className={`min-w-0 rounded-xl border border-slate-200 bg-slate-50/80 p-2.5 shadow-sm ${manualOverride ? 'cursor-move' : 'cursor-default'}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium break-words">{wo.intakeRequest.customerName}</p>
                          <p className="text-xs text-gray-600 break-words">{wo.intakeRequest.location}</p>
                        </div>
                        <p className="max-w-[9rem] break-all text-[10px] leading-tight text-slate-500 text-right">WO {wo.id}</p>
                      </div>
                      <p className="text-xs mt-1 text-slate-700 break-words">Boat: {wo.intakeRequest.vesselName ?? 'Unknown vessel'}</p>

                      <p className="text-xs mt-2">
                        QuickBooks: <b>{wo.qbSyncStatus}</b> · attempts {wo.qbRetryCount}
                      </p>
                      {wo.qbInvoiceId && <p className="text-xs">Invoice: {wo.qbInvoiceId}</p>}
                      <p className="text-xs mt-1">Automation: <b>{wo.automationState ?? 'IDLE'}</b></p>
                      <p className="text-xs text-slate-600">Next: {wo.nextAction ?? 'Await manager action'}</p>
                      <p className="text-xs">Wallace: <b>{wo.wallaceSyncStatus ?? 'PENDING'}</b></p>
                      {wo.qbLastError && <p className="text-xs text-red-700">{wo.qbLastError}</p>}

                      <div className="mt-2 flex flex-wrap gap-1">
                        <Link
                          className="px-2 py-1 rounded-lg bg-slate-800 text-white text-xs"
                          href={`/board/invoice-preview/${wo.id}`}
                        >
                          Invoice preview
                        </Link>
                        <button
                          className="px-2 py-1 rounded-lg bg-emerald-700 text-white text-xs disabled:opacity-50"
                          onClick={() => approveInvoice(wo.id)}
                          disabled={busyId === wo.id || !['NEW', 'APPROVED'].includes(wo.status)}
                        >
                          Approve invoice
                        </button>
                        <button
                          className="px-2 py-1 rounded-lg bg-amber-600 text-white text-xs disabled:opacity-50"
                          onClick={() => runWorkOrderEvent(wo.id, 'PARTS_ARRIVED')}
                          disabled={busyId === wo.id || !['PARTS_ORDERED','APPROVED'].includes(wo.status)}
                        >
                          Parts arrived
                        </button>
                        <button
                          className="px-2 py-1 rounded-lg bg-violet-700 text-white text-xs disabled:opacity-50"
                          onClick={() => runWorkOrderEvent(wo.id, 'TECH_COMPLETE')}
                          disabled={busyId === wo.id || wo.status !== 'IN_PROGRESS'}
                        >
                          Tech complete
                        </button>
                        <button
                          className="px-2 py-1 rounded-lg bg-slate-600 text-white text-xs disabled:opacity-50"
                          onClick={() => toggleTimeline(wo.id)}
                          disabled={busyId === wo.id}
                        >
                          {showTimelineById[wo.id] ? 'Hide logs' : 'Wallace logs'}
                        </button>
                        <button
                          className="px-2 py-1 rounded-lg bg-rose-600 text-white text-xs disabled:opacity-50"
                          onClick={() => deleteWorkOrder(wo.id, wo.intakeRequest.customerName)}
                          disabled={busyId === wo.id}
                        >
                          Delete
                        </button>
                      </div>

                      {showTimelineById[wo.id] && (
                        <div className="mt-2 rounded-xl border bg-white p-2 text-xs">
                          <p className="font-semibold mb-1">Automation timeline</p>
                          {((timelineById[wo.id] ?? []) as TimelineEntry[]).length === 0 ? (
                            <p className="text-slate-600">No events yet.</p>
                          ) : (
                            <ul className="space-y-1">
                              {(timelineById[wo.id] ?? []).slice(-8).reverse().map((t) => (
                                <li key={t.id} className="border-b pb-1">
                                  <p><b>{t.action}</b> · {new Date(t.createdAt).toLocaleString()}</p>
                                  <p className="text-slate-600">{t.message}</p>
                                </li>
                              ))}
                            </ul>
                          )}
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
