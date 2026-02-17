import { NextResponse } from 'next/server'
import { listWorkOrders, runOrchestrationFromIntake } from '@/lib/mock-orchestrator'

export async function GET() {
  return NextResponse.json({ ok: true, workOrders: listWorkOrders() })
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const result = runOrchestrationFromIntake({
      customerName: body.customerName,
      phone: body.phone,
      email: body.email,
      vesselName: body.vesselName,
      requestType: body.requestType === 'BOAT_LAUNCH' ? 'BOAT_LAUNCH' : 'WORK_ORDER',
      serviceRequest: body.serviceRequest,
      location: body.location ?? 'CMS Yard',
    })
    return NextResponse.json({ ok: true, source: 'orchestrator', ...result }, { status: 201 })
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid request' }, { status: 400 })
  }
}
