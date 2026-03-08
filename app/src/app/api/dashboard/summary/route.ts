import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { buildQbInvoicePayload } from '@/lib/qb-map'

// Minutes saved per auto-synced invoice (replaces manual re-entry into QBO)
const MINUTES_SAVED_PER_INVOICE = 15

export async function GET() {
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
    // Invoices auto-pushed to QuickBooks today
    prisma.workOrder.findMany({
      where: { qbSyncStatus: 'SYNCED', updatedAt: { gte: startOfDay } },
      include: { intakeRequest: true },
    }),
    // Needs attention (failed or retrying)
    prisma.workOrder.count({
      where: {
        OR: [{ qbSyncStatus: 'FAILED' }, { qbSyncStatus: 'RETRY_PENDING' }],
      },
    }),
    // Ready to push to QuickBooks (Wallace complete, not yet synced)
    prisma.workOrder.count({
      where: {
        wallaceEntered: true,
        status: 'COMPLETE',
        qbSyncStatus: { not: 'SYNCED' },
      },
    }),
  ])

  // Estimate dollar value of today's synced invoices using the same QB mapping logic
  // In production this would be the real QBO invoice total pulled back via webhook
  const billedToday = syncedTodayRows.reduce((sum, wo) => {
    const payload = buildQbInvoicePayload(wo, wo.intakeRequest)
    const invoiceTotal = payload.Line.reduce((s, l) => s + l.Amount, 0)
    return sum + invoiceTotal
  }, 0)

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

  return NextResponse.json({
    ok: true,
    summary: {
      // Core counts
      intakeCount,
      workOrderCount: workOrders.length,
      retryCount,
      invoicedCount,
      byStatus,
      byLocation,
      // Outcome metrics (what the dashboard leads with)
      syncedToday: syncedTodayRows.length,
      billedToday: Number(billedToday.toFixed(2)),
      minutesSavedToday,
      attentionCount,
      pendingReviewCount,
    },
  })
}
