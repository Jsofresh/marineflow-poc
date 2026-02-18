import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'

export async function POST(req: Request, { params }: { params: Promise<{ workOrderId: string }> }) {
  try {
    const { workOrderId } = await params
    const body = await req.json().catch(() => ({}))
    const confirmText = String(body?.confirmText ?? '')

    if (confirmText !== 'MARK PAID') {
      return NextResponse.json({ ok: false, error: 'Confirmation text mismatch' }, { status: 400 })
    }

    const existing = await prisma.workOrder.findUnique({ where: { id: workOrderId } })
    if (!existing) {
      return NextResponse.json({ ok: false, error: 'Work order not found' }, { status: 404 })
    }

    const updated = await prisma.workOrder.update({
      where: { id: workOrderId },
      data: {
        status: 'INVOICED',
        qbSyncStatus: 'SYNCED',
        qbLastError: null,
        qbInvoiceId: existing.qbInvoiceId ?? `QB-${Date.now()}`,
      },
    })

    await logAudit({
      entityType: 'QUICKBOOKS',
      action: 'QB_MANUAL_MARK_PAID',
      message: `QuickBooks invoice manually marked paid (${updated.qbInvoiceId})`,
      workOrderId: updated.id,
      intakeRequestId: updated.intakeRequestId,
      metadata: {
        override: true,
        confirmedWith: confirmText,
      },
    })

    return NextResponse.json({ ok: true, workOrder: updated })
  } catch {
    return NextResponse.json({ ok: false, error: 'Manual payment override failed' }, { status: 500 })
  }
}
