import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const [intakes, workOrders, retryCount, invoicedCount] = await Promise.all([
    prisma.intakeRequest.count(),
    prisma.workOrder.findMany({ include: { intakeRequest: true } }),
    prisma.workOrder.count({ where: { qbSyncStatus: 'RETRY_PENDING' } }),
    prisma.workOrder.count({ where: { status: 'INVOICED' } }),
  ])

  const unassignedIntakes = await prisma.intakeRequest.count({
    where: { workOrders: { none: {} } },
  })

  const conversionRate = intakes > 0 ? Number((((intakes - unassignedIntakes) / intakes) * 100).toFixed(1)) : 100
  const invoiceRate = workOrders.length > 0 ? Number(((invoicedCount / workOrders.length) * 100).toFixed(1)) : 0

  return NextResponse.json({
    ok: true,
    generatedAt: new Date().toISOString(),
    metrics: {
      intakes,
      workOrders: workOrders.length,
      unassignedIntakes,
      conversionRate,
      invoicedCount,
      invoiceRate,
      qbRetryCount: retryCount,
    },
  })
}
