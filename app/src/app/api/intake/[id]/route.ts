import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params

  try {
    const body = await req.json()
    const { customerName, email, phone, vesselName, serviceRequest, location } = body

    const intake = await prisma.intakeRequest.findUnique({ where: { id } })
    if (!intake) {
      return NextResponse.json({ ok: false, error: 'Intake not found' }, { status: 404 })
    }

    const updated = await prisma.intakeRequest.update({
      where: { id },
      data: {
        ...(customerName !== undefined && { customerName }),
        ...(email !== undefined && { email }),
        ...(phone !== undefined && { phone }),
        ...(vesselName !== undefined && { vesselName }),
        ...(serviceRequest !== undefined && { serviceRequest }),
        ...(location !== undefined && { location }),
      },
    })

    await logAudit({
      entityType: 'INTAKE',
      action: 'INTAKE_UPDATED',
      message: `Intake updated for ${updated.customerName}`,
      intakeRequestId: id,
      metadata: { intakeId: id },
    })

    return NextResponse.json({ ok: true, intake: updated })
  } catch {
    return NextResponse.json({ ok: false, error: 'Failed to update intake' }, { status: 500 })
  }
}

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

    // Log audit before delete so the FK reference is still valid
    await logAudit({
      entityType: 'INTAKE',
      action: 'INTAKE_DELETED',
      message: `Intake deleted for ${intake.customerName}`,
      intakeRequestId: id,
      metadata: { intakeId: id },
    })

    await prisma.intakeRequest.delete({ where: { id } })

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false, error: 'Failed to delete intake' }, { status: 500 })
  }
}
