import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { buildQbInvoicePayload } from '@/lib/qb-map'
import { logAudit } from '@/lib/audit'

function randomSuccess() {
  return Math.random() < 0.75
}

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const order = await prisma.workOrder.findUnique({
      where: { id },
      include: { intakeRequest: true },
    })
    if (!order) {
      return NextResponse.json({ ok: false, error: 'Work order not found' }, { status: 404 })
    }

    const qbPayload = buildQbInvoicePayload(order, order.intakeRequest)
    const success = randomSuccess()

    if (!success) {
      const updated = await prisma.workOrder.update({
        where: { id },
        data: {
          qbSyncStatus: 'RETRY_PENDING',
          qbRetryCount: { increment: 1 },
          qbLastError: 'Mock QuickBooks timeout. Retry queued.',
        },
      })

      await logAudit({
        entityType: 'QUICKBOOKS',
        action: 'QB_SYNC_FAILED',
        message: 'QuickBooks mock sync failed. Retry queued.',
        workOrderId: updated.id,
        intakeRequestId: updated.intakeRequestId,
        metadata: {
          qbPayload,
          retryCount: updated.qbRetryCount,
        },
      })

      return NextResponse.json(
        { ok: false, workOrder: updated, error: updated.qbLastError, qbPayload },
        { status: 502 }
      )
    }

    const updated = await prisma.workOrder.update({
      where: { id },
      data: {
        status: 'INVOICED',
        qbSyncStatus: 'SYNCED',
        qbLastError: null,
        qbInvoiceId: order.qbInvoiceId ?? `QB-${Date.now()}`,
      },
    })

    await logAudit({
      entityType: 'QUICKBOOKS',
      action: 'QB_SYNC_SUCCESS',
      message: `QuickBooks mock sync succeeded (${updated.qbInvoiceId})`,
      workOrderId: updated.id,
      intakeRequestId: updated.intakeRequestId,
      metadata: {
        qbPayload,
        invoiceId: updated.qbInvoiceId,
      },
    })

    return NextResponse.json({ ok: true, workOrder: updated, qbPayload })
  } catch {
    return NextResponse.json({ ok: false, error: 'QB sync failed' }, { status: 400 })
  }
}
