import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { buildQbInvoicePayload } from '@/lib/qb-map'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    const order = await prisma.workOrder.findUnique({
      where: { id },
      include: { intakeRequest: true },
    })

    if (!order) {
      return NextResponse.json({ ok: false, error: 'Work order not found' }, { status: 404 })
    }

    const payload = buildQbInvoicePayload(order, order.intakeRequest)
    return NextResponse.json({ ok: true, workOrderId: id, payload })
  } catch {
    return NextResponse.json({ ok: false, error: 'QB preview failed' }, { status: 400 })
  }
}
