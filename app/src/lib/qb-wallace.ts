import type { QbInvoicePayload } from '@/lib/qb-map'
import type { WallacePacket } from '@/lib/wallace-export'
import { mapWallaceLineToQboItem } from '@/lib/wallace-export'

export function buildQbInvoicePayloadFromWallacePacket(args: {
  marineflowWorkOrderId: string
  packet: WallacePacket
  billEmail?: string | null
}): { qbPayload: QbInvoicePayload; totals: { packetTotal: number; qbTotal: number } } {
  const txnDate = new Date().toISOString().slice(0, 10)

  const lines: QbInvoicePayload['Line'] = args.packet.lines.map((l) => {
    const mapped = mapWallaceLineToQboItem(l)
    return {
      Amount: Number(l.amount.toFixed(2)),
      DetailType: 'SalesItemLineDetail',
      Description: l.description,
      SalesItemLineDetail: {
        ItemRef: { name: mapped.qboItem },
        Qty: l.qty,
        UnitPrice: Number(l.unitPrice.toFixed(2)),
      },
    }
  })

  const qbTotal = Number(lines.reduce((s, l) => s + l.Amount, 0).toFixed(2))

  const qbPayload: QbInvoicePayload = {
    DocNumber: `WAL-${args.marineflowWorkOrderId.slice(-6).toUpperCase()}`,
    CustomerRef: { name: args.packet.header.customerName },
    CustomerMemo: {
      value: `${args.packet.header.vesselName ?? 'Vessel'} · ${args.packet.header.location ?? 'Location'} · Wallace ${args.packet.header.wallaceWorkOrderId}`,
    },
    PrivateNote: `MarineFlow POC: invoice drafted from Wallace export ${args.packet.source.fileName} sha256=${args.packet.source.sha256}`,
    TxnDate: txnDate,
    Line: lines,
  }

  if (args.billEmail) qbPayload.BillEmail = { Address: args.billEmail }

  return { qbPayload, totals: { packetTotal: args.packet.totals.total, qbTotal } }
}
