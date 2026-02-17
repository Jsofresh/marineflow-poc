'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { buildWallacePacket } from '@/lib/wallace-packet'

type Intake = {
  id: string
  customerName: string
  email: string | null
  phone: string | null
  vesselName: string | null
  serviceRequest: string
  location: string
  createdAt: string
}

type WorkOrder = {
  id: string
  status: string
  wallaceEntered: boolean
  wallaceExternalId?: string | null
  wallaceSyncStatus?: string
  intakeRequest: Intake
}

type Notice =
  | { kind: 'success'; message: string }
  | { kind: 'error'; message: string }
  | null

export default function WallaceQueuePage() {
  const [unassigned, setUnassigned] = useState<Intake[]>([])
  const [queue, setQueue] = useState<WorkOrder[]>([])
  const [busyId, setBusyId] = useState<string | null>(null)
  const [notice, setNotice] = useState<Notice>(null)
  const [wallaceRefs, setWallaceRefs] = useState<Record<string, string>>({})

  async function load() {
    const res = await fetch('/api/wallace/queue', { cache: 'no-store' })
    const data = await res.json()
    setUnassigned(data.unassignedIntakes ?? [])
    setQueue(data.wallaceQueue ?? [])
  }

  useEffect(() => {
    load()
  }, [])

  const unassignedCount = unassigned.length
  const queueCount = queue.length

  const headline = useMemo(() => {
    if (queueCount === 0 && unassignedCount === 0) return 'All clear — nothing needs manual entry.'
    if (queueCount > 0) return `${queueCount} work order${queueCount === 1 ? '' : 's'} waiting for Wallace entry.`
    return `${unassignedCount} intake${unassignedCount === 1 ? '' : 's'} ready to convert into work orders.`
  }, [queueCount, unassignedCount])

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
        setNotice({ kind: 'success', message: 'Work order created. Next: copy details into Wallace.' })
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

  function buildWallaceSummary(wo: WorkOrder) {
    const i = wo.intakeRequest
    return buildWallacePacket({
      workOrderId: wo.id,
      customerName: i.customerName,
      location: i.location,
      vesselName: i.vesselName,
      email: i.email,
      phone: i.phone,
      serviceRequest: i.serviceRequest,
      source: 'MarineFlow Wallace fallback queue',
    })
  }

  async function copySummary(wo: WorkOrder) {
    setBusyId(wo.id)
    setNotice(null)
    try {
      const text = buildWallaceSummary(wo)
      await navigator.clipboard.writeText(text)
      setNotice({ kind: 'success', message: 'Copied. Paste into Wallace, then click “Mark entered”.' })
    } catch {
      setNotice({ kind: 'error', message: 'Could not copy to clipboard. (Browser permission?)' })
    } finally {
      setBusyId(null)
    }
  }

  async function markEntered(id: string) {
    setBusyId(id)
    setNotice(null)
    try {
      const res = await fetch(`/api/work-orders/${id}/wallace-entered`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallaceExternalId: wallaceRefs[id] || null }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data?.ok) {
        setNotice({ kind: 'success', message: 'Marked as entered into Wallace.' })
      } else {
        setNotice({ kind: 'error', message: data?.error ?? 'Could not mark as entered.' })
      }
    } catch {
      setNotice({ kind: 'error', message: 'Network error while updating Wallace status.' })
    } finally {
      await load()
      setBusyId(null)
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Wallace fallback (manual)</h1>
            <p className="text-sm text-slate-600">{headline}</p>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Link href="/" className="underline">
              Home
            </Link>
            <Link href="/board" className="underline">
              Board
            </Link>
            <a
              href="/api/wallace/queue.csv"
              className="text-xs px-2 py-1 rounded border bg-white hover:bg-slate-100"
            >
              Export CSV
            </a>
          </div>
        </div>

        <div className="rounded border bg-white p-4 text-sm text-slate-700">
          <p className="font-semibold mb-2">How to use this page</p>
          <ol className="list-decimal ml-5 space-y-1">
            <li>Convert an intake into a work order (Step 1).</li>
            <li>Copy the summary (Step 2) and paste into Wallace.</li>
            <li>After saving in Wallace, click “Mark entered” so it disappears from this queue.</li>
          </ol>
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

        <section className="rounded border bg-white p-4 space-y-2">
          <h2 className="font-semibold">Step 1 — Convert unassigned intakes</h2>
          {unassigned.length === 0 ? (
            <div className="text-sm text-slate-600">
              <p className="font-medium text-slate-800">No unassigned intakes</p>
              <p>New requests will appear here after they’re submitted from the Intake form.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {unassigned.map((i) => (
                <div key={i.id} className="flex flex-wrap items-center justify-between gap-3 border rounded p-3">
                  <div>
                    <p className="font-medium">
                      {i.customerName} · {i.location}
                    </p>
                    <p className="text-sm text-slate-600">{i.serviceRequest}</p>
                    <p className="text-xs text-slate-500">Intake {i.id}</p>
                  </div>
                  <button
                    className="px-3 py-1 rounded bg-blue-600 text-white disabled:opacity-50"
                    disabled={busyId === i.id}
                    onClick={() => createWorkOrder(i.id)}
                  >
                    {busyId === i.id ? 'Creating…' : 'Create work order'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded border bg-white p-4 space-y-2">
          <h2 className="font-semibold">Step 2 — Enter these work orders into Wallace</h2>
          {queue.length === 0 ? (
            <div className="text-sm text-slate-600">
              <p className="font-medium text-slate-800">Queue is empty</p>
              <p>If a work order needs manual entry, it will show up here.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {queue.map((wo) => (
                <div key={wo.id} className="border rounded p-3 space-y-2">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">
                        {wo.intakeRequest.customerName} · {wo.intakeRequest.location}
                      </p>
                      <p className="text-sm text-slate-600">{wo.intakeRequest.serviceRequest}</p>
                      <p className="text-xs text-slate-500">WO {wo.id}</p>
                    </div>
                    <div className="text-xs text-slate-500 text-right">
                      <p>Status: {wo.status}</p>
                      <p>Wallace: {wo.wallaceSyncStatus ?? 'PENDING'}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      className="rounded border px-2 py-1 text-xs"
                      placeholder="Wallace job # (optional)"
                      value={wallaceRefs[wo.id] ?? wo.wallaceExternalId ?? ''}
                      onChange={(e) => setWallaceRefs((prev) => ({ ...prev, [wo.id]: e.target.value }))}
                    />
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      className="px-3 py-1 rounded border text-sm disabled:opacity-50"
                      onClick={() => copySummary(wo)}
                      disabled={busyId === wo.id}
                    >
                      {busyId === wo.id ? 'Copying…' : 'Copy handoff packet'}
                    </button>
                    <button
                      className="px-3 py-1 rounded bg-emerald-600 text-white text-sm disabled:opacity-50"
                      onClick={() => markEntered(wo.id)}
                      disabled={busyId === wo.id}
                    >
                      {busyId === wo.id ? 'Saving…' : 'Mark entered'}
                    </button>
                  </div>

                  <details className="text-xs text-slate-700">
                    <summary className="cursor-pointer select-none">Preview what will be copied</summary>
                    <pre className="mt-2 whitespace-pre-wrap rounded border bg-slate-50 p-2">
                      {buildWallaceSummary(wo)}
                    </pre>
                  </details>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
