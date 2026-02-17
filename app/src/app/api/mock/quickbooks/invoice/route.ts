import { NextResponse } from 'next/server'
import { createQuickBooksInvoice } from '@/lib/mock-orchestrator'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const updated = createQuickBooksInvoice(body.workOrderId, Boolean(body.markPaid))
    if (!updated) return NextResponse.json({ ok: false, error: 'Work order not found' }, { status: 404 })
    return NextResponse.json({ ok: true, adapter: 'quickbooks-mock', workOrder: updated })
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid request' }, { status: 400 })
  }
}
