import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'

export async function POST(req: Request) {
  try {
    const body = await req.json()

    const created = await prisma.workOrder.create({
      data: {
        intakeRequestId: body.intakeRequestId,
        status: 'NEW',
      },
      include: { intakeRequest: true },
    })

    await logAudit({
      entityType: 'WORK_ORDER',
      action: 'WORK_ORDER_CREATED',
      message: `Work order created for ${created.intakeRequest.customerName}`,
      workOrderId: created.id,
      intakeRequestId: created.intakeRequestId,
      metadata: {
        status: created.status,
      },
    })

    return NextResponse.json({ ok: true, workOrder: created }, { status: 201 })
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid request' }, { status: 400 })
  }
}
