export const dynamic = 'force-dynamic'

import { prisma } from '@/lib/prisma'
import DashboardClient from './dashboard-client'

// Minutes saved per auto-synced invoice
const MINUTES_SAVED_PER_INVOICE = 15

async function getSummary() {
  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)

  const [
    intakeCount,
    workOrders,
    retryCount,
    invoicedCount,
    syncedTodayRows,
    attentionCount,
    pendingReviewCount,
  ] = await Promise.all([
    prisma.intakeRequest.count(),
    prisma.workOrder.findMany({ include: { intakeRequest: true } }),
    prisma.workOrder.count({ where: { qbSyncStatus: 'RETRY_PENDING' } }),
    prisma.workOrder.count({ where: { status: 'INVOICED' } }),
    prisma.workOrder.findMany({
      where: { qbSyncStatus: 'SYNCED', updatedAt: { gte: startOfDay } },
      include: { intakeRequest: true },
    }),
    prisma.workOrder.count({
      where: {
        OR: [{ qbSyncStatus: 'FAILED' }, { qbSyncStatus: 'RETRY_PENDING' }],
      },
    }),
    prisma.workOrder.count({
      where: {
        wallaceEntered: true,
        status: 'COMPLETE',
        qbSyncStatus: { not: 'SYNCED' },
      },
    }),
  ])

  // Estimate dollar value (simplified for SSR)
  const billedToday = syncedTodayRows.length * 500 // placeholder
  const minutesSavedToday = syncedTodayRows.length * MINUTES_SAVED_PER_INVOICE

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
    syncedToday: syncedTodayRows.length,
    billedToday,
    minutesSavedToday,
    attentionCount,
    pendingReviewCount,
  }
}

export default async function DashboardPage() {
  const summary = await getSummary()
  return <DashboardClient initialSummary={summary} />
}
