import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { buildQbInvoicePayload } from '@/lib/qb-map'
import { createWallaceInvoiceFromQboPayload, listWallaceInvoices } from '@/lib/mock-wallace-invoices'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const workOrderId = url.searchParams.get('workOrderId')
  if (!workOrderId) return NextResponse.json({ ok: false, error: 'Missing workOrderId' }, { status: 400 })
  return NextResponse.json({ ok: true, invoices: listWallaceInvoices(workOrderId) })
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  const workOrderId = body?.workOrderId
  if (!workOrderId) return NextResponse.json({ ok: false, error: 'Missing workOrderId' }, { status: 400 })

  const order = await prisma.workOrder.findUnique({ where: { id: workOrderId }, include: { intakeRequest: true } })
  if (!order) return NextResponse.json({ ok: false, error: 'Work order not found' }, { status: 404 })

  // For the demo, we treat the Wallace invoice as the priced/line-item source-of-truth.
  // We build it from our existing QBO payload builder (later: replace with real Wallace line items).
  const qbPayload = buildQbInvoicePayload(order, order.intakeRequest)

  const inv = createWallaceInvoiceFromQboPayload({
    marineflowWorkOrderId: order.id,
    customerName: order.intakeRequest.customerName,
    vesselName: order.intakeRequest.vesselName,
    location: order.intakeRequest.location,
    qbPayload,
  })

  return NextResponse.json({ ok: true, invoice: inv })
}
