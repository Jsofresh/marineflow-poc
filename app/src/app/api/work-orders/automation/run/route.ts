import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'

export async function POST() {
  const workOrders = await prisma.workOrder.findMany({ orderBy: { updatedAt: 'asc' } })
  const progressed: Array<{ id: string; from: string; to: string; note: string }> = []

  for (const wo of workOrders) {
    // Step 1: approved invoice -> send to wallace queue
    if (wo.status === 'APPROVED' && (wo.wallaceSyncStatus === 'READY_TO_SEND' || wo.wallaceSyncStatus === 'QUEUED')) {
      const updated = await prisma.workOrder.update({
        where: { id: wo.id },
        data: {
          wallaceSyncStatus: 'CONFIRMED',
          wallaceEntered: true,
          wallaceEnteredAt: new Date(),
          status: 'PARTS_ORDERED',
        },
      })
      progressed.push({ id: wo.id, from: wo.status, to: updated.status, note: 'Wallace accepted packet' })
      continue
    }

    // Step 2: parts ordered -> in progress
    if (wo.status === 'PARTS_ORDERED') {
      const updated = await prisma.workOrder.update({ where: { id: wo.id }, data: { status: 'IN_PROGRESS' } })
      progressed.push({ id: wo.id, from: wo.status, to: updated.status, note: 'Parts available; work started' })
      continue
    }

    // Step 3: complete -> invoiced
    if (wo.status === 'COMPLETE') {
      const updated = await prisma.workOrder.update({
        where: { id: wo.id },
        data: {
          status: 'INVOICED',
          qbSyncStatus: 'SYNCED',
          qbLastError: null,
          qbInvoiceId: wo.qbInvoiceId ?? `QB-${Date.now()}-${wo.id.slice(-4)}`,
          completedAt: wo.completedAt ?? new Date(),
        },
      })
      progressed.push({ id: wo.id, from: wo.status, to: updated.status, note: 'Auto-invoiced' })
      continue
    }
  }

  if (progressed.length > 0) {
    for (const step of progressed) {
      const found = workOrders.find((w) => w.id === step.id)
      if (!found) continue
      await logAudit({
        entityType: 'WORK_ORDER',
        action: 'AUTOMATION_PROGRESS',
        message: `${step.from} -> ${step.to} (${step.note})`,
        workOrderId: step.id,
        intakeRequestId: found.intakeRequestId,
        metadata: step,
      })
    }
  }

  return NextResponse.json({ ok: true, progressedCount: progressed.length, progressed })
}
