import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'
import { apiError, parseJson, rateLimit, requireAdminToken } from '@/lib/api-guard'
import { getCorrelationId } from '@/lib/correlation'
import { buildQbInvoicePayload } from '@/lib/qb-map'

const allowedSchema = z.object({
  status: z.enum(['NEW', 'APPROVED', 'PARTS_ORDERED', 'IN_PROGRESS', 'QC', 'QUALITY_CONTROL', 'COMPLETE', 'INVOICED']),
})

function randomSuccess() {
  return Math.random() < 0.75
}

function isDemoAutomation(req: Request) {
  return req.headers.get('x-demo-automation') === '1'
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const correlationId = getCorrelationId(req)

  if (!rateLimit(req, 'work-order-status-patch', 120, 60_000)) {
    return apiError('Rate limit exceeded', 429, correlationId)
  }

  if (!requireAdminToken(req)) {
    return apiError('Unauthorized', 401, correlationId)
  }

  const parsed = await parseJson(req, allowedSchema)
  if (!parsed.success) {
    return apiError('Invalid status', 400, correlationId)
  }

  try {
    const { id } = await params
    const body = parsed.data

    const normalizedStatus = body.status === 'QUALITY_CONTROL' ? 'QC' : body.status
    const demo = isDemoAutomation(req)

    // Demo automation wants a deterministic pipeline (NEW → … → COMPLETE → INVOICED).
    // Normal behavior simulates that setting COMPLETE may auto-sync into QuickBooks.
    if (normalizedStatus === 'COMPLETE') {
      const success = demo ? false : randomSuccess()

      const updated = await prisma.workOrder.update({
        where: { id },
        data: demo
          ? {
              status: 'COMPLETE',
              completedAt: new Date(),
            }
          : success
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
        message: demo
          ? 'Status changed to COMPLETE (demo automation)'
          : success
            ? 'Status changed COMPLETE -> INVOICED with auto QB sync'
            : 'Status changed to COMPLETE with QB retry pending',
        workOrderId: updated.id,
        intakeRequestId: updated.intakeRequestId,
        metadata: {
          requestedStatus: body.status,
          finalStatus: updated.status,
          autoQbSync: !demo,
          success,
          demoAutomation: demo,
          correlationId,
        },
      })

      return NextResponse.json({
        ok: true,
        autoQbSync: !demo,
        demoAutomation: demo,
        workOrder: updated,
        error: !demo && success ? null : updated.qbLastError,
        correlationId,
      })
    }

    // INVOICED sets QB fields for a clean demo.
    if (normalizedStatus === 'INVOICED') {
      // Fetch intake so we can build a QB payload with real totals.
      const existing = await prisma.workOrder.findUnique({
        where: { id },
        include: { intakeRequest: true },
      })

      const invoiceId = `QB-${Date.now()}`

      const updated = await prisma.workOrder.update({
        where: { id },
        data: {
          status: 'INVOICED',
          completedAt: new Date(),
          qbSyncStatus: 'SYNCED',
          qbLastError: null,
          qbInvoiceId: invoiceId,
        },
      })

      await logAudit({
        entityType: 'WORK_ORDER',
        action: 'STATUS_UPDATED',
        message: demo ? 'Status changed to INVOICED (demo automation)' : 'Status changed to INVOICED',
        workOrderId: updated.id,
        intakeRequestId: updated.intakeRequestId,
        metadata: {
          requestedStatus: body.status,
          correlationId,
          demoAutomation: demo,
        },
      })

      // Log a QB_SYNC_SUCCESS so the QuickBooks page can display the total bill.
      if (existing) {
        const qbPayload = buildQbInvoicePayload(existing, existing.intakeRequest)
        const qbTotal = qbPayload.Line.reduce((sum, l) => sum + l.Amount, 0)

        await logAudit({
          entityType: 'QUICKBOOKS',
          action: 'QB_SYNC_SUCCESS',
          message: `QuickBooks mock invoice generated (${invoiceId})`,
          workOrderId: updated.id,
          intakeRequestId: updated.intakeRequestId,
          metadata: {
            qbPayload,
            invoiceId,
            totals: {
              qbTotal: Number(qbTotal.toFixed(2)),
              packetTotal: Number(qbTotal.toFixed(2)),
            },
          },
        })
      }

      return NextResponse.json({ ok: true, workOrder: updated, correlationId, demoAutomation: demo })
    }

    const updated = await prisma.workOrder.update({
      where: { id },
      data: {
        status: normalizedStatus,
        completedAt: null,
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
        correlationId,
        demoAutomation: demo,
      },
    })

    return NextResponse.json({ ok: true, workOrder: updated, correlationId, demoAutomation: demo })
  } catch {
    return apiError('Update failed', 400, correlationId)
  }
}
