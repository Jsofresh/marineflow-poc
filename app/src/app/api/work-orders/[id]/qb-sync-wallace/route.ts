import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'
import { buildQbInvoicePayloadFromWallacePacket } from '@/lib/qb-wallace'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json().catch(() => null)
    if (!body?.packet) return NextResponse.json({ ok: false, error: 'Missing packet' }, { status: 400 })

    const order = await prisma.workOrder.findUnique({
      where: { id },
      include: { intakeRequest: true },
    })
    if (!order) return NextResponse.json({ ok: false, error: 'Work order not found' }, { status: 404 })

    const { qbPayload, totals } = buildQbInvoicePayloadFromWallacePacket({
      marineflowWorkOrderId: order.id,
      packet: body.packet,
      billEmail: order.intakeRequest.email,
    })

    const totalsMatch = Math.abs(totals.packetTotal - totals.qbTotal) < 0.01

    // Mock QBO create: update local state and log audit.
    const updated = await prisma.workOrder.update({
      where: { id },
      data: {
        status: 'INVOICED',
        qbSyncStatus: 'SYNCED',
        qbLastError: totalsMatch ? null : `Totals mismatch: packet=${totals.packetTotal} qb=${totals.qbTotal}`,
        qbInvoiceId: order.qbInvoiceId ?? `QBO-${Date.now()}`,
      },
    })

    await logAudit({
      entityType: 'QUICKBOOKS',
      action: 'QB_SYNC_SUCCESS',
      message: `QBO draft invoice created from Wallace export (${updated.qbInvoiceId})`,
      workOrderId: updated.id,
      intakeRequestId: updated.intakeRequestId,
      metadata: {
        wallaceSource: body.packet?.source,
        wallaceHeader: body.packet?.header,
        totals,
        totalsMatch,
        qbPayload,
      },
    })

    return NextResponse.json({ ok: true, workOrder: updated, qbPayload, totals, totalsMatch })
  } catch {
    return NextResponse.json({ ok: false, error: 'QB sync from Wallace packet failed' }, { status: 400 })
  }
}
