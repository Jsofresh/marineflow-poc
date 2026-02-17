import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'

export async function DELETE(_: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params

  try {
    const intake = await prisma.intakeRequest.findUnique({
      where: { id },
      include: { workOrders: { select: { id: true } } },
    })

    if (!intake) {
      return NextResponse.json({ ok: false, error: 'Intake not found' }, { status: 404 })
    }

    if (intake.workOrders.length > 0) {
      return NextResponse.json(
        { ok: false, error: 'Cannot delete intake with linked work orders' },
        { status: 409 }
      )
    }

    await prisma.intakeRequest.delete({ where: { id } })

    await logAudit({
      entityType: 'INTAKE',
      action: 'INTAKE_DELETED',
      message: `Intake deleted for ${intake.customerName}`,
      intakeRequestId: id,
      metadata: { intakeId: id },
    })

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false, error: 'Failed to delete intake' }, { status: 500 })
  }
}
