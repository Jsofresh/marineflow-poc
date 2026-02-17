import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json().catch(() => ({}))
    const wallaceExternalId = body?.wallaceExternalId ? String(body.wallaceExternalId) : null

    const updated = await prisma.workOrder.update({
      where: { id },
      data: {
        wallaceEntered: true,
        wallaceEnteredAt: new Date(),
        wallaceExternalId,
        wallaceSyncStatus: 'ENTERED',
      },
    })

    await logAudit({
      entityType: 'WORK_ORDER',
      action: 'WALLACE_ENTERED',
      message: `Marked as entered into Wallace${wallaceExternalId ? ` (${wallaceExternalId})` : ''}`,
      workOrderId: updated.id,
      intakeRequestId: updated.intakeRequestId,
      metadata: {
        wallaceExternalId,
      },
    })

    return NextResponse.json({ ok: true, workOrder: updated })
  } catch {
    return NextResponse.json({ ok: false, error: 'Update failed' }, { status: 400 })
  }
}
