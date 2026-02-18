import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'

type Bucket = 'PAID' | 'WAITING' | 'DELINQUENT'

export async function PATCH(req: Request, { params }: { params: Promise<{ workOrderId: string }> }) {
  try {
    const { workOrderId } = await params
    const body = await req.json().catch(() => ({}))
    const bucket = String(body?.bucket ?? '').toUpperCase() as Bucket

    if (!['PAID', 'WAITING', 'DELINQUENT'].includes(bucket)) {
      return NextResponse.json({ ok: false, error: 'Invalid bucket' }, { status: 400 })
    }

    const existing = await prisma.workOrder.findUnique({ where: { id: workOrderId } })
    if (!existing) {
      return NextResponse.json({ ok: false, error: 'Work order not found' }, { status: 404 })
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
      metadata: { bucket, qbSyncStatus },
    })

    return NextResponse.json({ ok: true, workOrder: updated })
  } catch {
    return NextResponse.json({ ok: false, error: 'Could not update bucket' }, { status: 500 })
  }
}
