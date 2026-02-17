import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'

const ALLOWED = new Set(['PENDING', 'ENTERED', 'CONFIRMED', 'ERROR'])

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json().catch(() => ({}))

    const status = String(body?.status ?? '').toUpperCase()
    const wallaceExternalId = body?.wallaceExternalId ? String(body.wallaceExternalId) : null
    const note = body?.note ? String(body.note) : null

    if (!ALLOWED.has(status)) {
      return NextResponse.json({ ok: false, error: 'Invalid status' }, { status: 400 })
    }

    const updated = await prisma.workOrder.update({
      where: { id },
      data: {
        wallaceSyncStatus: status,
        wallaceExternalId,
        wallaceEntered: status === 'ENTERED' || status === 'CONFIRMED',
        wallaceEnteredAt: status === 'ENTERED' || status === 'CONFIRMED' ? new Date() : null,
      },
    })

    await logAudit({
      entityType: 'WORK_ORDER',
      action: 'WALLACE_STATUS_UPDATED',
      message: `Wallace status set to ${status}${wallaceExternalId ? ` (${wallaceExternalId})` : ''}`,
      workOrderId: updated.id,
      intakeRequestId: updated.intakeRequestId,
      metadata: {
        status,
        wallaceExternalId,
        note,
      },
    })

    return NextResponse.json({ ok: true, workOrder: updated })
  } catch {
    return NextResponse.json({ ok: false, error: 'Update failed' }, { status: 400 })
  }
}
