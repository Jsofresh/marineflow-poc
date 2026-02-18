import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'
import { buildWallacePacket } from '@/lib/wallace-packet'
import { dispatchToWallaceMock } from '@/lib/wallace-adapter'

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    const existing = await prisma.workOrder.findUnique({
      where: { id },
      include: { intakeRequest: true },
    })

    if (!existing) {
      return NextResponse.json({ ok: false, error: 'Work order not found' }, { status: 404 })
    }

    const packet = buildWallacePacket({
      workOrderId: existing.id,
      customerName: existing.intakeRequest.customerName,
      location: existing.intakeRequest.location,
      vesselName: existing.intakeRequest.vesselName,
      email: existing.intakeRequest.email,
      phone: existing.intakeRequest.phone,
      serviceRequest: existing.intakeRequest.serviceRequest,
      source: 'MarineFlow',
    })

    const queued = await prisma.workOrder.update({
      where: { id },
      data: {
        status: 'APPROVED',
        qbSyncStatus: 'INVOICE_APPROVED',
        wallaceSyncStatus: 'READY_TO_SEND',
        wallaceEntered: false,
      },
    })

    // Auto-run first automation step immediately after approve via Wallace mock adapter
    const wallaceResult = await dispatchToWallaceMock({
      workOrderId: queued.id,
      packet,
    })

    const updated = await prisma.workOrder.findUnique({ where: { id: queued.id } })
    if (!updated) {
      return NextResponse.json({ ok: false, error: 'Work order not found after Wallace dispatch' }, { status: 404 })
    }

    await logAudit({
      entityType: 'WORK_ORDER',
      action: 'INVOICE_APPROVED',
      message: 'Manager approved invoice; Wallace packet generated and auto-queued',
      workOrderId: queued.id,
      intakeRequestId: queued.intakeRequestId,
      metadata: {
        automation: {
          status: 'SUCCESS',
          nextAction: 'Await parts arrived event',
        },
        wallacePacket: packet,
        wallaceDispatch: wallaceResult,
      },
    })

    return NextResponse.json({
      ok: true,
      workOrder: updated,
      automation: { state: 'SUCCESS', nextAction: 'Await parts arrived event' },
    })
  } catch {
    return NextResponse.json({ ok: false, error: 'Failed to approve invoice' }, { status: 500 })
  }
}
