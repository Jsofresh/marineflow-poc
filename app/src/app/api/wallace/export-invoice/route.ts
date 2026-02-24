import { NextResponse } from 'next/server'
import { mapWallaceLineToQboItem } from '@/lib/wallace-export'
import { wallaceInvoiceToPacket } from '@/lib/mock-wallace-invoices'

export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  const invoice = body?.invoice
  if (!invoice) return NextResponse.json({ ok: false, error: 'Missing invoice' }, { status: 400 })

  const packet = wallaceInvoiceToPacket(invoice)
  const mapping = packet.lines.map((l: { lineType: 'LABOR' | 'PART'; itemCode?: string; description: string; amount: number }) => ({
    lineType: l.lineType,
    itemCode: l.itemCode ?? null,
    description: l.description,
    amount: l.amount,
    ...mapWallaceLineToQboItem(l),
  }))

  return NextResponse.json({ ok: true, packet, mapping })
}
