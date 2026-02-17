'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'

type ExceptionJob = {
  id: string
  status: string
  wallaceSyncStatus: 'PENDING' | 'ERROR'
  wallaceExternalId: string | null
  updatedAt: string
  intakeRequest: {
    customerName: string
    location: string
    serviceRequest: string
  }
}

type Notice =
  | { kind: 'success'; message: string }
  | { kind: 'error'; message: string }
  | null

type ActionStatus = 'ENTERED' | 'CONFIRMED' | 'ERROR'

export default function WallaceExceptionsPage() {
  const [jobs, setJobs] = useState<ExceptionJob[]>([])
  const [busyId, setBusyId] = useState<string | null>(null)
  const [notice, setNotice] = useState<Notice>(null)
  const [wallaceRefs, setWallaceRefs] = useState<Record<string, string>>({})
  const [notes, setNotes] = useState<Record<string, string>>({})

  async function load() {
    const res = await fetch('/api/wallace/exceptions', { cache: 'no-store' })
    const data = await res.json()
    setJobs(data.jobs ?? [])
  }

  useEffect(() => {
    load()
  }, [])

  const counts = useMemo(() => {
    return jobs.reduce(
      (acc, job) => {
        if (job.wallaceSyncStatus === 'ERROR') acc.error += 1
        else acc.pending += 1
        return acc
      },
      { pending: 0, error: 0 },
    )
  }, [jobs])

  async function setWallaceStatus(id: string, status: ActionStatus) {
    setBusyId(id)
    setNotice(null)

    try {
      const wallaceExternalId = (wallaceRefs[id] ?? '').trim() || null
      const note = (notes[id] ?? '').trim() || null

      const res = await fetch(`/api/work-orders/${id}/wallace-status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, wallaceExternalId, note }),
      })

      const data = await res.json().catch(() => ({}))

      if (res.ok && data?.ok) {
        setNotice({ kind: 'success', message: `Wallace status set to ${status}.` })
      } else {
        setNotice({ kind: 'error', message: data?.error ?? 'Could not update Wallace status.' })
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
            <h1 className="text-2xl font-bold">Wallace exceptions</h1>
            <p className="text-sm text-slate-600">Manager panel for Wallace jobs in PENDING or ERROR state.</p>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Link href="/" className="underline">
              Home
            </Link>
            <Link href="/manager" className="underline">
              Manager
            </Link>
          </div>
        </div>

        <div className="rounded border bg-white p-4 text-sm">
          <p>
            Open exceptions: <b>{jobs.length}</b> · Pending: <b>{counts.pending}</b> · Error: <b>{counts.error}</b>
          </p>
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

        {jobs.length === 0 ? (
          <div className="rounded border bg-white p-4 text-sm text-slate-700">
            <p className="font-semibold">All caught up</p>
            <p>No Wallace exception jobs are waiting right now.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {jobs.map((job) => (
              <div key={job.id} className="rounded border bg-white p-4 space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">
                      {job.intakeRequest.customerName} · {job.intakeRequest.location}
                    </p>
                    <p className="text-sm text-slate-700">{job.intakeRequest.serviceRequest}</p>
                    <p className="text-xs text-slate-500">WO {job.id}</p>
                  </div>
                  <span
                    className={`rounded px-2 py-1 text-xs ${
                      job.wallaceSyncStatus === 'ERROR' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {job.wallaceSyncStatus}
                  </span>
                </div>

                <div className="grid gap-2 md:grid-cols-2">
                  <input
                    className="rounded border px-2 py-1 text-sm"
                    placeholder="Wallace job #"
                    value={wallaceRefs[job.id] ?? job.wallaceExternalId ?? ''}
                    onChange={(e) => setWallaceRefs((prev) => ({ ...prev, [job.id]: e.target.value }))}
                  />
                  <input
                    className="rounded border px-2 py-1 text-sm"
                    placeholder="Note (optional)"
                    value={notes[job.id] ?? ''}
                    onChange={(e) => setNotes((prev) => ({ ...prev, [job.id]: e.target.value }))}
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    className="px-3 py-1 rounded bg-emerald-600 text-white text-sm disabled:opacity-50"
                    disabled={busyId === job.id}
                    onClick={() => setWallaceStatus(job.id, 'ENTERED')}
                  >
                    {busyId === job.id ? 'Saving…' : 'Mark ENTERED'}
                  </button>
                  <button
                    className="px-3 py-1 rounded bg-blue-700 text-white text-sm disabled:opacity-50"
                    disabled={busyId === job.id}
                    onClick={() => setWallaceStatus(job.id, 'CONFIRMED')}
                  >
                    {busyId === job.id ? 'Saving…' : 'Mark CONFIRMED'}
                  </button>
                  <button
                    className="px-3 py-1 rounded bg-red-700 text-white text-sm disabled:opacity-50"
                    disabled={busyId === job.id}
                    onClick={() => setWallaceStatus(job.id, 'ERROR')}
                  >
                    {busyId === job.id ? 'Saving…' : 'Keep/mark ERROR'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
