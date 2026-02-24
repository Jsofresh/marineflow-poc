import crypto from 'crypto'
import type { WallacePacket } from '@/lib/wallace-export'
import type { QbInvoicePayload } from '@/lib/qb-map'

export type MockWallaceInvoice = {
  id: string
  wallaceWorkOrderId: string
  marineflowWorkOrderId: string
  customerName: string
  vesselName?: string | null
  location?: string | null
  createdAt: string
  status: 'DRAFT' | 'READY'
  lines: Array<{
    lineType: 'LABOR' | 'PART'
    itemCode?: string
    description: string
    qty: number
    unitPrice: number
    amount: number
  }>
}

type Store = {
  invoices: MockWallaceInvoice[]
}

declare global {
  // Node typings: allow storing on globalThis.
  var __marineflowWallaceInvoiceStore: Store | undefined
}

const store: Store = globalThis.__marineflowWallaceInvoiceStore ?? { invoices: [] }
globalThis.__marineflowWallaceInvoiceStore = store

function id(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`
}

export function listWallaceInvoices(marineflowWorkOrderId: string) {
  return store.invoices.filter((i) => i.marineflowWorkOrderId === marineflowWorkOrderId)
}

export function createWallaceInvoiceFromQboPayload(args: {
  marineflowWorkOrderId: string
  wallaceWorkOrderId?: string
  customerName: string
  vesselName?: string | null
  location?: string | null
  qbPayload: QbInvoicePayload
}): MockWallaceInvoice {
  const wallaceWorkOrderId = args.wallaceWorkOrderId ?? `WAL-${args.marineflowWorkOrderId.slice(-6).toUpperCase()}`

  const lines = (args.qbPayload.Line ?? []).map((l) => {
    const qty = l.SalesItemLineDetail.Qty ?? 1
    const unitPrice = l.SalesItemLineDetail.UnitPrice ?? l.Amount
    const lineType: 'LABOR' | 'PART' = l.SalesItemLineDetail.ItemRef.name.toLowerCase().includes('labor') ? 'LABOR' : 'PART'
    const itemCode = l.SalesItemLineDetail.ItemRef.name.toUpperCase()
    return {
      lineType,
      itemCode,
      description: l.Description,
      qty,
      unitPrice,
      amount: l.Amount,
    }
  })

  const inv: MockWallaceInvoice = {
    id: id('walinv'),
    wallaceWorkOrderId,
    marineflowWorkOrderId: args.marineflowWorkOrderId,
    customerName: args.customerName,
    vesselName: args.vesselName ?? null,
    location: args.location ?? null,
    createdAt: new Date().toISOString(),
    status: 'READY',
    lines,
  }

  store.invoices.unshift(inv)
  return inv
}

export function wallaceInvoiceToPacket(inv: MockWallaceInvoice): WallacePacket {
  const importedAt = new Date().toISOString()
  const raw = JSON.stringify(inv)
  const sha256 = crypto.createHash('sha256').update(raw).digest('hex')

  let labor = 0
  let parts = 0
  for (const l of inv.lines) {
    if (l.lineType === 'LABOR') labor += l.amount
    else parts += l.amount
  }

  return {
    source: {
      fileName: `wallace-invoice:${inv.id}`,
      sha256,
      importedAt,
    },
    header: {
      wallaceWorkOrderId: inv.wallaceWorkOrderId,
      customerName: inv.customerName,
      vesselName: inv.vesselName ?? undefined,
      location: inv.location ?? undefined,
    },
    lines: inv.lines.map((l) => ({
      lineType: l.lineType,
      itemCode: l.itemCode,
      description: l.description,
      qty: l.qty,
      unitPrice: l.unitPrice,
      amount: l.amount,
    })),
    totals: {
      labor: Number(labor.toFixed(2)),
      parts: Number(parts.toFixed(2)),
      total: Number((labor + parts).toFixed(2)),
    },
  }
}
