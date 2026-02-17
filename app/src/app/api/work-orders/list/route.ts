import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

function deriveAutomation(workOrder: {
  status: string
  qbSyncStatus: string
  wallaceSyncStatus: string
}) {
  if (workOrder.qbSyncStatus === 'RETRY_PENDING' || workOrder.wallaceSyncStatus === 'ERROR') {
    return { automationState: 'FAILED', nextAction: 'Resolve exception' }
  }

  if (workOrder.status === 'APPROVED' && workOrder.wallaceSyncStatus === 'READY_TO_SEND') {
    return { automationState: 'QUEUED', nextAction: 'Send to Wallace' }
  }

  if (workOrder.status === 'PARTS_ORDERED') {
    return { automationState: 'RUNNING', nextAction: 'Await parts / move to IN_PROGRESS' }
  }

  if (workOrder.status === 'IN_PROGRESS') {
    return { automationState: 'RUNNING', nextAction: 'Await technician completion signal' }
  }

  if (workOrder.status === 'INVOICED') {
    return { automationState: 'SUCCESS', nextAction: 'Done' }
  }

  return { automationState: 'IDLE', nextAction: 'Await manager action' }
}

export async function GET() {
  const workOrders = await prisma.workOrder.findMany({
    include: { intakeRequest: true },
    orderBy: { createdAt: 'desc' },
  })

  const enriched = workOrders.map((wo) => ({
    ...wo,
    ...deriveAutomation(wo),
  }))

  return NextResponse.json({ ok: true, workOrders: enriched })
}
