import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'

export async function POST(_req: Request, { params }: { params: Promise<{ workOrderId: string }> }) {
  try {
    const { workOrderId } = await params

    const wo = await prisma.workOrder.findUnique({
      where: { id: workOrderId },
      include: { intakeRequest: true },
    })

    if (!wo) {
      return NextResponse.json({ ok: false, error: 'Work order not found' }, { status: 404 })
    }

    const email = wo.intakeRequest.email
    if (!email) {
      return NextResponse.json({ ok: false, error: 'Customer email missing' }, { status: 400 })
    }

    // Mock-only: queue reminder intent in audit log for now.
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
      },
    })

    return NextResponse.json({
      ok: true,
      reminder: {
        status: 'QUEUED_MOCK',
        to: email,
      },
    })
  } catch {
    return NextResponse.json({ ok: false, error: 'Failed to queue reminder' }, { status: 500 })
  }
}
