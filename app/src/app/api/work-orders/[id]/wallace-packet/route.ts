import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { buildWallacePacket } from '@/lib/wallace-packet'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const wo = await prisma.workOrder.findUnique({
    where: { id },
    include: { intakeRequest: true },
  })

  if (!wo) {
    return NextResponse.json({ ok: false, error: 'Work order not found' }, { status: 404 })
  }

  const packet = buildWallacePacket({
    workOrderId: wo.id,
    customerName: wo.intakeRequest.customerName,
    location: wo.intakeRequest.location,
    vesselName: wo.intakeRequest.vesselName,
    email: wo.intakeRequest.email,
    phone: wo.intakeRequest.phone,
    serviceRequest: wo.intakeRequest.serviceRequest,
    source: 'MarineFlow',
  })

  return NextResponse.json({ ok: true, workOrderId: wo.id, packet })
}
