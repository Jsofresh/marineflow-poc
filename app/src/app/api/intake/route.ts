import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'

export async function POST(req: Request) {
  try {
    const body = await req.json()

    const created = await prisma.intakeRequest.create({
      data: {
        customerName: body.customerName,
        email: body.email ?? null,
        phone: body.phone ?? null,
        vesselName: body.vesselName ?? null,
        serviceRequest: body.serviceRequest,
        location: body.location,
      },
    })

    await logAudit({
      entityType: 'INTAKE',
      action: 'INTAKE_CREATED',
      message: `Intake created for ${created.customerName} (${created.location})`,
      intakeRequestId: created.id,
      metadata: {
        serviceRequest: created.serviceRequest,
      },
    })

    return NextResponse.json({ ok: true, intake: created }, { status: 201 })
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid request' }, { status: 400 })
  }
}
