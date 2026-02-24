import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'
import { apiError, rateLimit, requireAdminToken } from '@/lib/api-guard'
import { getCorrelationId } from '@/lib/correlation'

export async function POST(req: Request, { params }: { params: Promise<{ workOrderId: string }> }) {
  const correlationId = getCorrelationId(req)

  if (!rateLimit(req, 'qb-reminder-post', 60, 60_000)) {
    return apiError('Rate limit exceeded', 429, correlationId)
  }

  if (!requireAdminToken(req)) {
    return apiError('Unauthorized', 401, correlationId)
  }

  try {
    const { workOrderId } = await params

    const wo = await prisma.workOrder.findUnique({
      where: { id: workOrderId },
      include: { intakeRequest: true },
    })

    if (!wo) {
      return apiError('Work order not found', 404, correlationId)
    }

    const email = wo.intakeRequest.email
    if (!email) {
      return apiError('Customer email missing', 400, correlationId)
    }

    await logAudit({
      entityType: 'QUICKBOOKS',
      action: 'QB_REMINDER_QUEUED',
      message: `Reminder queued for ${wo.intakeRequest.customerName} (${email})`,
      workOrderId: wo.id,
      intakeRequestId: wo.intakeRequestId,
      metadata: {
        mode: 'MOCK_EMAIL',
        to: email,
        invoiceId: wo.qbInvoiceId ?? `WO-${wo.id.slice(-6).toUpperCase()}`,
        bucket: wo.qbSyncStatus,
        correlationId,
      },
    })

    return NextResponse.json({
      ok: true,
      reminder: {
        status: 'QUEUED_MOCK',
        to: email,
      },
      correlationId,
    })
  } catch {
    return apiError('Failed to queue reminder', 500, correlationId)
  }
}
