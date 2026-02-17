import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'

export async function DELETE(_: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params

  try {
    const existing = await prisma.workOrder.findUnique({
      where: { id },
      include: { intakeRequest: true },
    })

    if (!existing) {
      return NextResponse.json({ ok: false, error: 'Work order not found' }, { status: 404 })
    }

    await prisma.workOrder.delete({ where: { id } })

    await logAudit({
      entityType: 'WORK_ORDER',
      action: 'WORK_ORDER_DELETED',
      message: `Work order deleted for ${existing.intakeRequest.customerName}`,
      intakeRequestId: existing.intakeRequestId,
      metadata: { workOrderId: id },
    })

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false, error: 'Failed to delete work order' }, { status: 500 })
  }
}
