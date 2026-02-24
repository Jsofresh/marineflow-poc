import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const [orders, lastScan] = await Promise.all([
    prisma.workOrder.findMany({
      select: { id: true, status: true, wallaceEntered: true, wallaceSyncStatus: true, qbSyncStatus: true },
    }),
    prisma.activityLog.findFirst({
      where: { action: 'WALLACE_SCAN_RAN' },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    }),
  ])

  const notInWallace = orders.filter((w) => !w.wallaceEntered && w.status !== 'INVOICED').length
  const inWallace = orders.filter((w) => w.wallaceEntered && w.status !== 'COMPLETE' && w.status !== 'INVOICED').length
  const completed = orders.filter((w) => w.wallaceEntered && w.status === 'COMPLETE').length

  // "Ready" = has a Wallace packet snapshot; use ActivityLog existence.
  const ready = await prisma.activityLog.count({ where: { action: 'WALLACE_PACKET_SNAPSHOT' } })

  return NextResponse.json({
    ok: true,
    lastScanAt: lastScan?.createdAt?.toISOString() ?? null,
    counts: { notInWallace, inWallace, completed, ready },
  })
}
