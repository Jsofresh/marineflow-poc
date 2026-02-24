'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'

type Data = {
  lastScanAt: string | null
  counts: { notInWallace: number; inWallace: number; completed: number; ready: number }
}

export function WallaceNavStatus() {
  const [data, setData] = useState<Data | null>(null)

  async function refresh() {
    const d = await fetch('/api/mock/wallace/scan-status', { cache: 'no-store' }).then((r) => r.json())
    if (d?.ok) setData({ lastScanAt: d.lastScanAt, counts: d.counts })
  }

  useEffect(() => {
    const t = setTimeout(() => {
      refresh()
    }, 0)
    return () => clearTimeout(t)
  }, [])

  const label = useMemo(() => {
    if (!data) return 'Wallace'
    const c = data.counts
    return `Wallace: E${c.inWallace} • C${c.completed} • R${c.ready}`
  }, [data])

  const title = useMemo(() => {
    if (!data?.lastScanAt) return 'Wallace status'
    return `Last scan: ${new Date(data.lastScanAt).toLocaleString()}`
  }, [data])

  return (
    <Link href="/dashboard" className="rounded-lg px-3 py-1.5 hover:bg-slate-100" title={title}>
      {label}
    </Link>
  )
}
