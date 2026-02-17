import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const [intakeCount, workOrders, retryCount, invoicedCount] = await Promise.all([
    prisma.intakeRequest.count(),
    prisma.workOrder.findMany({ include: { intakeRequest: true } }),
    prisma.workOrder.count({ where: { qbSyncStatus: 'RETRY_PENDING' } }),
    prisma.workOrder.count({ where: { status: 'INVOICED' } }),
  ])

  const byStatus = workOrders.reduce<Record<string, number>>((acc, w) => {
    acc[w.status] = (acc[w.status] ?? 0) + 1
    return acc
  }, {})

  const byLocation = workOrders.reduce<Record<string, number>>((acc, w) => {
    const loc = w.intakeRequest.location
    acc[loc] = (acc[loc] ?? 0) + 1
    return acc
  }, {})

  return NextResponse.json({
    ok: true,
    summary: {
      intakeCount,
      workOrderCount: workOrders.length,
      retryCount,
      invoicedCount,
      byStatus,
      byLocation,
    },
  })
}
