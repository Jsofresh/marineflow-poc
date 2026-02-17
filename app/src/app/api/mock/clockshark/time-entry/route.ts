import { NextResponse } from 'next/server'
import { addClockSharkTime } from '@/lib/mock-orchestrator'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const updated = addClockSharkTime(body.workOrderId, Number(body.hours ?? 1.5))
    if (!updated) return NextResponse.json({ ok: false, error: 'Work order not found' }, { status: 404 })
    return NextResponse.json({ ok: true, adapter: 'clockshark-mock', workOrder: updated })
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid request' }, { status: 400 })
  }
}
