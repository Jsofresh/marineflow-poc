import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'
import { apiError, parseJson, rateLimit, requireAdminToken } from '@/lib/api-guard'
import { getCorrelationId } from '@/lib/correlation'

const bucketSchema = z.object({
  bucket: z.enum(['PAID', 'WAITING', 'DELINQUENT']),
})

export async function PATCH(req: Request, { params }: { params: Promise<{ workOrderId: string }> }) {
  const correlationId = getCorrelationId(req)

  if (!rateLimit(req, 'qb-bucket-patch', 100, 60_000)) {
    return apiError('Rate limit exceeded', 429, correlationId)
  }

  if (!requireAdminToken(req)) {
    return apiError('Unauthorized', 401, correlationId)
  }

  const parsed = await parseJson(req, bucketSchema)
  if (!parsed.success) {
    return apiError('Invalid bucket payload', 400, correlationId)
  }

  try {
    const { workOrderId } = await params
    const { bucket } = parsed.data

    const existing = await prisma.workOrder.findUnique({ where: { id: workOrderId } })
    if (!existing) {
      return apiError('Work order not found', 404, correlationId)
    }

    const qbSyncStatus = bucket === 'PAID' ? 'SYNCED' : bucket === 'DELINQUENT' ? 'DELINQUENT' : 'INVOICED'

    const updated = await prisma.workOrder.update({
      where: { id: workOrderId },
      data: {
        status: 'INVOICED',
        qbSyncStatus,
        qbInvoiceId: existing.qbInvoiceId ?? `QB-${Date.now()}`,
      },
    })

    await logAudit({
      entityType: 'QUICKBOOKS',
      action: 'QB_BUCKET_MANUAL_SET',
      message: `QuickBooks bucket manually set to ${bucket}`,
      workOrderId: updated.id,
      intakeRequestId: updated.intakeRequestId,
      metadata: { bucket, qbSyncStatus, correlationId },
    })

    // Wallace is the source of truth for payment status. When we override the bucket in the mock
    // monitor, we emit a Wallace payment status event so totals/badges pull from Wallace.
    await logAudit({
      entityType: 'WORK_ORDER',
      action: 'WALLACE_PAYMENT_STATUS',
      message: `Wallace payment status set to ${bucket === 'PAID' ? 'PAID' : 'UNPAID'} (mock)`,
      workOrderId: updated.id,
      intakeRequestId: updated.intakeRequestId,
      metadata: { paid: bucket === 'PAID', bucket, correlationId },
    })

    return NextResponse.json({ ok: true, workOrder: updated, correlationId })
  } catch {
    return apiError('Could not update bucket', 500, correlationId)
  }
}
