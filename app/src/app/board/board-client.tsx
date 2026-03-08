'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'

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

const STORAGE_KEY = 'marineflow.board.v1'

type StoredPrefs = {
  savedView?: 'ALL' | 'EXCEPTIONS' | 'TODAY' | 'OVERDUE'
  manualOverride?: boolean
  showStuckOnly?: boolean
  stuckHours?: number
  query?: string
}

function loadPrefs(): StoredPrefs {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? (parsed as StoredPrefs) : {}
  } catch {
    return {}
  }
}

function savePrefs(next: StoredPrefs) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // ignore
  }
}

function safeCopy(text: string) {
  if (typeof window === 'undefined') return
  const doLegacy = async () => {
    try {
      const el = document.createElement('textarea')
      el.value = text
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
    } catch {
      // ignore
    }
  }

  if (navigator?.clipboard?.writeText) {
    navigator.clipboard.writeText(text).catch(() => void doLegacy())
  } else {
    void doLegacy()
  }
}

function ageHours(updatedAt: string | undefined, nowMs: number) {
  if (!updatedAt) return null
  const t = new Date(updatedAt).getTime()
  if (Number.isNaN(t)) return null
  return Math.floor((nowMs - t) / (60 * 60 * 1000))
}

type Props = {
  initialWorkOrders?: WorkOrder[]
  initialIntakes?: Intake[]
}

export default function BoardClient({ initialWorkOrders = [], initialIntakes = [] }: Props) {
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>(initialWorkOrders)
  const [intakes, setIntakes] = useState<Intake[]>(initialIntakes)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [showStuckOnly, setShowStuckOnly] = useState(false)
  const [stuckHours, setStuckHours] = useState(24)
  const [nowMs, setNowMs] = useState(0)
  const [notice, setNotice] = useState<Notice>(null)
  const [manualOverride, setManualOverride] = useState(false)
  const [timelineById, setTimelineById] = useState<Record<string, TimelineEntry[]>>({})
  const [showTimelineById, setShowTimelineById] = useState<Record<string, boolean>>({})
  const [savedView, setSavedView] = useState<'ALL' | 'EXCEPTIONS' | 'TODAY' | 'OVERDUE'>('ALL')
  const [selectedWorkOrder, setSelectedWorkOrder] = useState<WorkOrder | null>(null)
  const [query, setQuery] = useState('')
  const [demoRunning, setDemoRunning] = useState(false)
  const [demoTick, setDemoTick] = useState(0)
  const demoStopRef = useRef(false)

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
    const prefs = loadPrefs()
    if (prefs.savedView) setSavedView(prefs.savedView)
    if (typeof prefs.manualOverride === 'boolean') setManualOverride(prefs.manualOverride)
    if (typeof prefs.showStuckOnly === 'boolean') setShowStuckOnly(prefs.showStuckOnly)
    if (typeof prefs.stuckHours === 'number') setStuckHours(prefs.stuckHours)
    if (typeof prefs.query === 'string') setQuery(prefs.query)

    // Use initial data if available, otherwise fetch
    if (initialWorkOrders.length > 0 && initialIntakes.length > 0) {
      setWorkOrders(initialWorkOrders)
      setIntakes(initialIntakes)
    } else {
      load()
    }
    
    setNowMs(Date.now())
    const t = setInterval(() => setNowMs(Date.now()), 60000)
    return () => clearInterval(t)
  }, [initialWorkOrders, initialIntakes])

  useEffect(() => {
    savePrefs({ savedView, manualOverride, showStuckOnly, stuckHours, query })
  }, [savedView, manualOverride, showStuckOnly, stuckHours, query])

  // Ensure any running demo stops if the component unmounts.
  useEffect(() => {
    return () => {
      demoStopRef.current = true
      setDemoRunning(false)
    }
  }, [])

  const attentionQueue = useMemo(() => {
    return workOrders.filter((wo) => {
      const blockedBySync = wo.qbSyncStatus === 'FAILED' || wo.wallaceSyncStatus === 'FAILED'
      const blockedByError = Boolean(wo.qbLastError)
      const blockedByState = wo.automationState?.toUpperCase().includes('BLOCK') ?? false
      return blockedBySync || blockedByError || blockedByState
    })
  }, [workOrders])

  const filteredOrders = useMemo(() => {
    let rows = workOrders

    if (savedView === 'EXCEPTIONS') {
      rows = attentionQueue
    }

    if (savedView === 'TODAY') {
      const since = nowMs - 24 * 60 * 60 * 1000
      rows = rows.filter((wo) => (wo.updatedAt ? new Date(wo.updatedAt).getTime() >= since : false))
    }

    if (savedView === 'OVERDUE') {
      const thresholdMs = nowMs - 24 * 60 * 60 * 1000
      rows = rows.filter((wo) => {
        if (wo.status === 'INVOICED') return false
        const updatedAt = wo.updatedAt ? new Date(wo.updatedAt).getTime() : nowMs
        return updatedAt < thresholdMs
      })
    }

    const q = query.trim().toLowerCase()
    if (q) {
      rows = rows.filter((wo) => {
        const hay = [
          wo.id,
          wo.status,
          wo.qbInvoiceId ?? '',
          wo.qbSyncStatus,
          wo.wallaceSyncStatus,
          wo.intakeRequest.customerName,
          wo.intakeRequest.location,
          wo.intakeRequest.vesselName ?? '',
          wo.intakeRequest.serviceRequest,
          wo.nextAction ?? '',
        ]
          .join(' | ')
          .toLowerCase()
        return hay.includes(q)
      })
    }

    if (!showStuckOnly) return rows
    const thresholdMs = nowMs - stuckHours * 60 * 60 * 1000
    return rows.filter((wo: WorkOrder & { updatedAt?: string }) => {
      if (wo.status === 'INVOICED') return false
      const updatedAt = wo.updatedAt ? new Date(wo.updatedAt).getTime() : nowMs
      return updatedAt < thresholdMs
    })
  }, [workOrders, showStuckOnly, stuckHours, nowMs, savedView, attentionQueue, query])

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

  // nextStatus() previously lived here; removed (unused).

  function randMs(min: number, max: number) {
    return Math.floor(min + Math.random() * (max - min + 1))
  }

  async function sleep(ms: number) {
    await new Promise((r) => setTimeout(r, ms))
  }

  async function runAutomationDemo(opts: { sampleSize?: number; minMs?: number; maxMs?: number } = {}) {
    const sampleSize = opts.sampleSize ?? 5
    const minMs = opts.minMs ?? 3000
    const maxMs = opts.maxMs ?? 5000

    // Reset stop flag and show UI state immediately.
    demoStopRef.current = false
    setDemoRunning(true)
    setDemoTick(0)

    // Pick a stable sample: oldest (non-invoiced) first so movement is visible.
    const candidates = [...workOrders]
      .filter((w) => w.status !== 'INVOICED')
      .sort((a, b) => {
        const ta = a.updatedAt ? new Date(a.updatedAt).getTime() : 0
        const tb = b.updatedAt ? new Date(b.updatedAt).getTime() : 0
        return ta - tb
      })
      .slice(0, sampleSize)
      .map((w) => w.id)

    if (candidates.length === 0) {
      setDemoRunning(false)
      setNotice({ kind: 'error', message: 'No eligible work orders to automate. Create one first.' })
      return
    }

    setNotice({ kind: 'success', message: `Automation demo started (${candidates.length} work orders).` })

    // Move a single work order through the remaining pipeline stages.
    const moveOne = async (id: string, staggerMs: number) => {
      // Stagger start so work orders don't all move at once.
      await sleep(staggerMs)

      if (demoStopRef.current) return

      // Fetch latest status for this work order.
      const snapshot = await fetch('/api/work-orders/list', { cache: 'no-store' })
        .then((r) => r.json())
        .catch(() => null)
      const rows: WorkOrder[] = snapshot?.workOrders ?? workOrders
      const wo = rows.find((w) => w.id === id)
      if (!wo) return

      const current = (statuses.includes(wo.status as Status) ? (wo.status as Status) : 'NEW') as Status
      const startIdx = statuses.indexOf(current)

      // Walk through remaining pipeline stages one step at a time.
      for (let i = Math.max(0, startIdx); i < statuses.length - 1; i++) {
        if (demoStopRef.current) break

        const next = statuses[i + 1]

        await setStatus(id, next, { quiet: true })
        setDemoTick((t) => t + 1)

        // Wait between each stage move (~3–5s base + extra pause after COMPLETE).
        await sleep(randMs(minMs, maxMs))

        if (next === 'COMPLETE') {
          // Brief extra pause at COMPLETE so it's visible before INVOICED.
          await sleep(randMs(1000, 2000))
        }
      }
    }

    try {
      // Workday simulation:
      // - all eligible work orders move through the pipeline simultaneously
      // - each starts with a random stagger (0–2s per position) so they don't move in lockstep
      // - each stage transition waits 3–5s so progress is clearly visible
      await Promise.all(
        candidates.map((id, idx) => moveOne(id, idx * randMs(800, 2000)))
      )
    } finally {
      setDemoRunning(false)
      demoStopRef.current = false
      await load()
    }

    setNotice({ kind: 'success', message: demoStopRef.current ? 'Automation demo stopped.' : 'Automation demo complete.' })
  }

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

  async function setStatus(id: string, status: Status, opts: { quiet?: boolean } = {}) {
    setBusyId(id)
    if (!opts.quiet) setNotice(null)
    try {
      const res = await fetch(`/api/work-orders/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-demo-automation': opts.quiet ? '1' : '0' },
        body: JSON.stringify({ status }),
      })
      const data = await res.json().catch(() => ({}))

      if (res.ok && data?.ok) {
        if (!opts.quiet) setNotice({ kind: 'success', message: `Moved to ${status}.` })
      } else {
        if (!opts.quiet) setNotice({ kind: 'error', message: data?.error ?? 'Could not update status.' })
      }
    } catch {
      if (!opts.quiet) setNotice({ kind: 'error', message: 'Network error while updating status.' })
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
        setNotice({
          kind: 'success',
          message: event === 'PARTS_ARRIVED' ? 'Parts arrived recorded.' : 'Technician completion recorded.',
        })
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
      const entries = Array.isArray(data?.timeline) ? data.timeline : ([] as TimelineEntry[])
      setTimelineById((prev) => ({ ...prev, [id]: entries }))
    }

    setShowTimelineById((prev) => ({ ...prev, [id]: true }))
  }

  async function onDropStatus(status: Status) {
    if (!draggingId) return
    await setStatus(draggingId, status)
    setDraggingId(null)
  }

  const totalVisible = filteredOrders.length

  return (
    <main className="min-h-screen p-6 space-y-6">
      <div className="mx-auto max-w-[1400px] space-y-4">
        <div className="card-soft flex flex-wrap items-start justify-between gap-3 p-4">
          <div>
            <h1 className="text-2xl font-bold">Work order board</h1>
            <p className="text-sm text-slate-600">
              Automation-first pipeline with exception-only manual controls. Showing <b>{totalVisible}</b> items.
            </p>
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
              <input
                type="checkbox"
                checked={manualOverride}
                onChange={(e) => setManualOverride(e.target.checked)}
              />
              Manual override
            </label>
            <a href="/api/work-orders/export.csv" className="text-xs px-2 py-1 rounded-lg border bg-white hover:bg-slate-100">
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
                  <Link
                    href={`/intake/${i.id}/edit`}
                    className="px-3 py-1 rounded-xl bg-emerald-600 text-white hover:bg-emerald-500 text-sm"
                  >
                    Edit
                  </Link>
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
              <p className="text-sm text-slate-600">Drag a card into a new column to update its stage (manual override).</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                className="rounded-xl border bg-white px-3 py-1.5 text-xs font-semibold hover:bg-slate-50 disabled:opacity-50"
                disabled={demoRunning}
                onClick={() => {
                  // Option 1 + workday: move a small sample with 2–4s jitter between each step.
                  void runAutomationDemo({ sampleSize: 5, minMs: 3000, maxMs: 5000 })
                }}
                title="Simulate a workday: slowly moves a few work orders across the pipeline to INVOICED"
              >
                {demoRunning ? `Automation running (${demoTick})` : 'Run automation demo'}
              </button>
              {demoRunning && (
                <button
                  className="rounded-xl border px-3 py-1.5 text-xs hover:bg-slate-50"
                  onClick={() => {
                    demoStopRef.current = true
                    setDemoRunning(false)
                  }}
                  title="Stop the automation demo"
                >
                  Stop
                </button>
              )}

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
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="font-semibold">{status}</p>
                  <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-700">
                    {grouped[status].length}
                  </span>
                </div>
                <div className="space-y-2">
                  {grouped[status].map((wo) => {
                    const hours = ageHours(wo.updatedAt, nowMs)
                    const overdue = hours !== null && hours >= 24 && wo.status !== 'INVOICED'
                    return (
                      <div
                        key={wo.id}
                        draggable={manualOverride}
                        onDragStart={() => setDraggingId(wo.id)}
                        onDragEnd={() => setDraggingId(null)}
                        className={`min-w-0 rounded-xl border bg-slate-50/80 p-2.5 shadow-sm ${
                          manualOverride ? 'cursor-move' : 'cursor-default'
                        } ${overdue ? 'border-rose-300' : 'border-slate-200'}`}
                      >
                        <div className="space-y-1">
                          <p className="text-sm font-medium break-words">{wo.intakeRequest.customerName}</p>
                          <p className="text-xs text-gray-600 break-words">{wo.intakeRequest.location}</p>
                          <div className="text-left">
                            <button
                              className="max-w-full break-all text-[10px] leading-tight text-slate-500 hover:underline"
                              onClick={() => {
                                safeCopy(wo.id)
                                setNotice({ kind: 'success', message: `Copied WO id: ${wo.id}` })
                              }}
                              title="Copy work order id"
                            >
                              WO {wo.id}
                            </button>
                            {hours !== null && (
                              <p className={`mt-0.5 text-[10px] ${overdue ? 'text-rose-700' : 'text-slate-500'}`}>
                                Updated {hours}h ago
                              </p>
                            )}
                          </div>
                        </div>

                        <p className="text-xs mt-1 text-slate-700 break-words">Boat: {wo.intakeRequest.vesselName ?? 'Unknown vessel'}</p>

                        <div className="mt-2 flex flex-wrap gap-1 text-[11px]">
                          <span className="rounded-full bg-slate-200 px-2 py-0.5 font-semibold">QB {wo.qbSyncStatus}</span>
                          <span className="rounded-full bg-indigo-100 px-2 py-0.5 font-semibold text-indigo-800">
                            Wallace {wo.wallaceSyncStatus ?? 'PENDING'}
                          </span>
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-800">
                            {wo.automationState ?? 'IDLE'}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-slate-600">Attempts: {wo.qbRetryCount}</p>
                        {wo.qbInvoiceId && (
                          <p className="text-xs">
                            Invoice:{' '}
                            <button
                              className="text-slate-900 hover:underline"
                              onClick={() => {
                                safeCopy(wo.qbInvoiceId as string)
                                setNotice({ kind: 'success', message: `Copied invoice id: ${wo.qbInvoiceId}` })
                              }}
                              title="Copy invoice id"
                            >
                              {wo.qbInvoiceId}
                            </button>
                          </p>
                        )}
                        <p className="mt-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs text-emerald-900">
                          Next action: <b>{wo.nextAction ?? 'Await manager action'}</b>
                        </p>
                        {wo.qbLastError && <p className="text-xs text-red-700">{wo.qbLastError}</p>}

                        <details className="mt-2 rounded-lg border border-slate-200 bg-white p-2">
                          <summary className="cursor-pointer list-none text-xs font-semibold text-slate-700">Actions ▾</summary>
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
                              disabled={busyId === wo.id || !['PARTS_ORDERED', 'APPROVED'].includes(wo.status)}
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
                              className="px-2 py-1 rounded-lg border border-slate-300 bg-white text-xs disabled:opacity-50"
                              onClick={() => setSelectedWorkOrder(wo)}
                              disabled={busyId === wo.id}
                            >
                              Details
                            </button>
                            <button
                              className="px-2 py-1 rounded-lg bg-rose-600 text-white text-xs disabled:opacity-50"
                              onClick={() => deleteWorkOrder(wo.id, wo.intakeRequest.customerName)}
                              disabled={busyId === wo.id}
                            >
                              Delete
                            </button>
                          </div>
                        </details>

                        {showTimelineById[wo.id] && (
                          <div className="mt-2 rounded-xl border bg-white p-2 text-xs">
                            <p className="font-semibold mb-1">Automation timeline</p>
                            {(timelineById[wo.id] ?? []).length === 0 ? (
                              <p className="text-slate-600">No events yet.</p>
                            ) : (
                              <ul className="space-y-1">
                                {(timelineById[wo.id] ?? []).slice(-8).reverse().map((t) => (
                                  <li key={t.id} className="border-b pb-1">
                                    <p>
                                      <b>{t.action}</b> · {new Date(t.createdAt).toLocaleString()}
                                    </p>
                                    <p className="text-slate-600">{t.message}</p>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                  {grouped[status].length === 0 && <p className="text-xs text-slate-500">No work orders in this stage.</p>}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {selectedWorkOrder && (
        <aside className="fixed right-0 top-0 z-50 h-full w-full max-w-md border-l bg-white p-4 shadow-2xl">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Work order details</p>
              <h2 className="text-lg font-semibold">{selectedWorkOrder.intakeRequest.customerName}</h2>
              <p className="text-sm text-slate-600">WO {selectedWorkOrder.id}</p>
            </div>
            <button className="rounded-lg border px-2 py-1 text-sm" onClick={() => setSelectedWorkOrder(null)}>
              Close
            </button>
          </div>

          <div className="mt-4 space-y-3 text-sm">
            <div className="rounded-lg border p-3">
              <p className="font-medium">Service</p>
              <p className="text-slate-700">{selectedWorkOrder.intakeRequest.serviceRequest}</p>
              <p className="text-xs text-slate-500">{selectedWorkOrder.intakeRequest.location}</p>
            </div>

            <div className="rounded-lg border p-3">
              <p className="font-medium">Status</p>
              <p>
                Pipeline: <b>{selectedWorkOrder.status}</b>
              </p>
              <p>
                QuickBooks: <b>{selectedWorkOrder.qbSyncStatus}</b>
              </p>
              <p>
                Wallace: <b>{selectedWorkOrder.wallaceSyncStatus}</b>
              </p>
              <p className="mt-2 rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs">
                Next best action: <b>{selectedWorkOrder.nextAction ?? 'Await manager action'}</b>
              </p>
            </div>

            <div className="rounded-lg border p-3">
              <p className="font-medium mb-2">Quick actions</p>
              <div className="flex flex-wrap gap-2">
                <button
                  className="rounded-lg bg-emerald-700 px-2 py-1 text-xs text-white"
                  onClick={() => approveInvoice(selectedWorkOrder.id)}
                >
                  Approve invoice
                </button>
                <button
                  className="rounded-lg bg-amber-600 px-2 py-1 text-xs text-white"
                  onClick={() => runWorkOrderEvent(selectedWorkOrder.id, 'PARTS_ARRIVED')}
                >
                  Parts arrived
                </button>
                <button
                  className="rounded-lg bg-violet-700 px-2 py-1 text-xs text-white"
                  onClick={() => runWorkOrderEvent(selectedWorkOrder.id, 'TECH_COMPLETE')}
                >
                  Tech complete
                </button>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  className="rounded-lg border bg-white px-2 py-1 text-xs hover:bg-slate-50"
                  onClick={() => {
                    safeCopy(selectedWorkOrder.id)
                    setNotice({ kind: 'success', message: `Copied WO id: ${selectedWorkOrder.id}` })
                  }}
                >
                  Copy WO id
                </button>
                {selectedWorkOrder.qbInvoiceId && (
                  <button
                    className="rounded-lg border bg-white px-2 py-1 text-xs hover:bg-slate-50"
                    onClick={() => {
                      safeCopy(selectedWorkOrder.qbInvoiceId as string)
                      setNotice({ kind: 'success', message: `Copied invoice id: ${selectedWorkOrder.qbInvoiceId}` })
                    }}
                  >
                    Copy invoice id
                  </button>
                )}
              </div>
            </div>
          </div>
        </aside>
      )}
    </main>
  )
}
