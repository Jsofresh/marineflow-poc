import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'

const allowed = ['NEW', 'APPROVED', 'PARTS_ORDERED', 'IN_PROGRESS', 'QC', 'QUALITY_CONTROL', 'COMPLETE', 'INVOICED']

function randomSuccess() {
  return Math.random() < 0.75
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()

    if (!allowed.includes(body.status)) {
      return NextResponse.json({ ok: false, error: 'Invalid status' }, { status: 400 })
    }

    const normalizedStatus = body.status === 'QUALITY_CONTROL' ? 'QC' : body.status

    if (normalizedStatus === 'COMPLETE') {
      const success = randomSuccess()

      const updated = await prisma.workOrder.update({
        where: { id },
        data: success
          ? {
              status: 'INVOICED',
              completedAt: new Date(),
              qbSyncStatus: 'SYNCED',
              qbLastError: null,
              qbInvoiceId: `QB-${Date.now()}`,
            }
          : {
              status: 'COMPLETE',
              completedAt: new Date(),
              qbSyncStatus: 'RETRY_PENDING',
              qbRetryCount: { increment: 1 },
              qbLastError: 'Mock QuickBooks timeout on auto-sync. Retry queued.',
            },
      })

      await logAudit({
        entityType: 'WORK_ORDER',
        action: 'STATUS_UPDATED',
        message: success
          ? `Status changed COMPLETE -> INVOICED with auto QB sync`
          : `Status changed to COMPLETE with QB retry pending`,
        workOrderId: updated.id,
        intakeRequestId: updated.intakeRequestId,
        metadata: {
          requestedStatus: body.status,
          finalStatus: updated.status,
          autoQbSync: true,
          success,
        },
      })

      return NextResponse.json({
        ok: success,
        autoQbSync: true,
        workOrder: updated,
        error: success ? null : updated.qbLastError,
      })
    }

    const updated = await prisma.workOrder.update({
      where: { id },
      data: {
        status: normalizedStatus,
        completedAt: normalizedStatus === 'INVOICED' ? new Date() : null,
      },
    })

    await logAudit({
      entityType: 'WORK_ORDER',
      action: 'STATUS_UPDATED',
      message: `Status changed to ${updated.status}`,
      workOrderId: updated.id,
      intakeRequestId: updated.intakeRequestId,
      metadata: {
        requestedStatus: body.status,
      },
    })

    return NextResponse.json({ ok: true, workOrder: updated })
  } catch {
    return NextResponse.json({ ok: false, error: 'Update failed' }, { status: 400 })
  }
}
