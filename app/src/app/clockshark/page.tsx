'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'

type Technician = {
  name: string
  clockIn: string
  clockOut?: string
  totalHours: number
  status: 'CLOCKED_IN' | 'CLOCKED_OUT'
}

type WallaceJob = {
  workOrderId: string
  wallaceJobCode: string
  customerName: string
  jobTitle: string
  technician: string
  wallaceHours: number
  status: string
}

type WindowKey = '1D' | '1W' | '2W' | '1M'

type DashboardData = {
  technicians: Technician[]
  wallaceJobs: WallaceJob[]
  summary: {
    totalClockedHours: number
    totalWallaceJobHours: number
    deltaHours: number
  }
}

export default function ClocksharkPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [selectedTech, setSelectedTech] = useState<string>('ALL')
  const [timeWindow, setTimeWindow] = useState<WindowKey>('1D')

  useEffect(() => {
    fetch('/api/mock/clockshark/dashboard', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => setData(d))
  }, [])

  const techOptions = useMemo(() => data?.technicians.map((t) => t.name) ?? [], [data])

  const visibleTechs = useMemo(() => {
    if (!data) return [] as Technician[]
    if (selectedTech === 'ALL') return data.technicians
    return data.technicians.filter((t) => t.name === selectedTech)
  }, [data, selectedTech])

  const visibleWallaceJobs = useMemo(() => {
    if (!data) return [] as WallaceJob[]
    if (selectedTech === 'ALL') return data.wallaceJobs
    return data.wallaceJobs.filter((j) => j.technician === selectedTech)
  }, [data, selectedTech])

  const focusedSummary = useMemo(() => {
    if (!data) return null

    const clocked = visibleTechs.reduce((sum, t) => sum + t.totalHours, 0)
    const wallace = visibleWallaceJobs.reduce((sum, j) => sum + j.wallaceHours, 0)
    return {
      totalClockedHours: Number(clocked.toFixed(1)),
      totalWallaceJobHours: Number(wallace.toFixed(1)),
      deltaHours: Number((clocked - wallace).toFixed(1)),
    }
  }, [data, visibleTechs, visibleWallaceJobs])


  const windowMultiplier: Record<WindowKey, number> = {
    '1D': 1,
    '1W': 5,
    '2W': 10,
    '1M': 22,
  }

  const scaledSummary = focusedSummary
    ? {
        totalClockedHours: Number((focusedSummary.totalClockedHours * windowMultiplier[timeWindow]).toFixed(1)),
        totalWallaceJobHours: Number((focusedSummary.totalWallaceJobHours * windowMultiplier[timeWindow]).toFixed(1)),
        deltaHours: Number((focusedSummary.deltaHours * windowMultiplier[timeWindow]).toFixed(1)),
      }
    : null

  return (
    <main className="min-h-screen bg-slate-50 p-8">
      <div className="mx-auto max-w-6xl space-y-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">ClockShark + Wallace Time View</h1>
            <p className="text-sm text-slate-600">
              Technician day totals (ClockShark) vs per-job logged time (Wallace).
            </p>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Link href="/" className="underline">Home</Link>
            <Link href="/board" className="underline">Board</Link>
          </div>
        </div>

        {!data && <div className="rounded border bg-white p-4 text-sm">Loading time dashboard…</div>}

        {data && scaledSummary && (
          <>
            <section className="rounded border bg-white p-4">
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Technician filter</label>
                  <select
                    className="mt-2 w-full rounded border p-2 text-sm"
                    value={selectedTech}
                    onChange={(e) => setSelectedTech(e.target.value)}
                  >
                    <option value="ALL">All technicians</option>
                    {techOptions.map((name) => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Time window</label>
                  <select
                    className="mt-2 w-full rounded border p-2 text-sm"
                    value={timeWindow}
                    onChange={(e) => setTimeWindow(e.target.value as WindowKey)}
                  >
                    <option value="1D">1 day</option>
                    <option value="1W">1 week</option>
                    <option value="2W">2 weeks</option>
                    <option value="1M">1 month</option>
                  </select>
                </div>
              </div>

              <p className="mt-2 text-xs text-slate-500">
                Select technician and window to reduce clutter and compare ClockShark totals vs Wallace job logs for the same period.
              </p>
            </section>

            <section className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <Kpi label="ClockShark total (day)" value={`${scaledSummary.totalClockedHours}h`} />
              <Kpi label="Wallace job hours" value={`${scaledSummary.totalWallaceJobHours}h`} />
              <Kpi label="Unallocated / overhead" value={`${scaledSummary.deltaHours}h`} />
            </section>

            <section className="rounded border bg-white p-4">
              <h2 className="mb-2 text-lg font-semibold">ClockShark — technician clocked time</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-100 text-left">
                    <tr>
                      <th className="p-2">Technician</th>
                      <th className="p-2">Clock in</th>
                      <th className="p-2">Clock out</th>
                      <th className="p-2">Total ({timeWindow === '1D' ? 'day' : timeWindow === '1W' ? 'week' : timeWindow === '2W' ? '2 weeks' : 'month'})</th>
                      <th className="p-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleTechs.map((t) => (
                      <tr key={t.name} className="border-t">
                        <td className="p-2 font-medium">{t.name}</td>
                        <td className="p-2">{t.clockIn}</td>
                        <td className="p-2">{t.clockOut ?? '-'}</td>
                        <td className="p-2">{(t.totalHours * windowMultiplier[timeWindow]).toFixed(1)}h</td>
                        <td className="p-2">{t.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="rounded border bg-white p-4">
              <h2 className="mb-2 text-lg font-semibold">Wallace — per-job logged time</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-100 text-left">
                    <tr>
                      <th className="p-2">Wallace job</th>
                      <th className="p-2">Customer</th>
                      <th className="p-2">Technician</th>
                      <th className="p-2">Job hours</th>
                      <th className="p-2">WO status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleWallaceJobs.map((j) => (
                      <tr key={j.workOrderId} className="border-t">
                        <td className="p-2 font-medium">{j.wallaceJobCode}</td>
                        <td className="p-2">{j.customerName}</td>
                        <td className="p-2">{j.technician}</td>
                        <td className="p-2">{(j.wallaceHours * windowMultiplier[timeWindow]).toFixed(1)}h</td>
                        <td className="p-2">{j.status}</td>
                      </tr>
                    ))}
                    {visibleWallaceJobs.length === 0 && (
                      <tr>
                        <td className="p-3 text-slate-500" colSpan={5}>No Wallace job logs for this technician yet.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  )
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border bg-white p-3">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  )
}
