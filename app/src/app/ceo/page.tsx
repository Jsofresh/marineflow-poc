export const dynamic = 'force-dynamic'

import { prisma } from '@/lib/prisma'
import CEOClient from './ceo-client'

async function getCEOData() {
  const now = new Date()
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)

  const [intakeCount, workOrders, retryCount, invoicedCount, stuckCount] = await Promise.all([
    prisma.intakeRequest.count(),
    prisma.workOrder.findMany({ include: { intakeRequest: true } }),
    prisma.workOrder.count({ where: { qbSyncStatus: 'RETRY_PENDING' } }),
    prisma.workOrder.count({ where: { status: 'INVOICED' } }),
    prisma.workOrder.count({
      where: {
        status: { not: 'INVOICED' },
        updatedAt: { lt: twentyFourHoursAgo },
      },
    }),
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

  return {
    intakeCount,
    workOrderCount: workOrders.length,
    retryCount,
    invoicedCount,
    byStatus,
    byLocation,
    stuckCount,
  }
}

export default async function CEOPage() {
  const summary = await getCEOData()
  return <CEOClient initialSummary={summary} />
}
