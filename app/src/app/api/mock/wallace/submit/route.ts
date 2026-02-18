import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { buildWallacePacket } from '@/lib/wallace-packet'
import { dispatchToWallaceMock } from '@/lib/wallace-adapter'

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const workOrderId = String(body?.workOrderId ?? '')

    if (!workOrderId) {
      return NextResponse.json({ ok: false, error: 'workOrderId is required' }, { status: 400 })
    }

    const wo = await prisma.workOrder.findUnique({
      where: { id: workOrderId },
      include: { intakeRequest: true },
    })

    if (!wo) {
      return NextResponse.json({ ok: false, error: 'Work order not found' }, { status: 404 })
    }

    const packet =
      typeof body?.packet === 'string' && body.packet.trim().length > 0
        ? body.packet
        : buildWallacePacket({
            workOrderId: wo.id,
            customerName: wo.intakeRequest.customerName,
            location: wo.intakeRequest.location,
            vesselName: wo.intakeRequest.vesselName,
            email: wo.intakeRequest.email,
            phone: wo.intakeRequest.phone,
            serviceRequest: wo.intakeRequest.serviceRequest,
            source: 'MarineFlow Wallace Mock API',
          })

    const result = await dispatchToWallaceMock({ workOrderId: wo.id, packet })

    return NextResponse.json({ ok: true, adapter: 'wallace-mock-api', workOrderId: wo.id, packet, result })
  } catch {
    return NextResponse.json({ ok: false, error: 'Mock Wallace submit failed' }, { status: 500 })
  }
}
