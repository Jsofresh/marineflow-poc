export type WallaceExportRow = {
  wallaceWorkOrderId: string
  marineflowWorkOrderId?: string
  customerName: string
  vesselName?: string
  location?: string
  lineType: 'LABOR' | 'PART'
  itemCode?: string
  description: string
  qty: number
  unitPrice: number
  amount: number
}

export type WallacePacket = {
  source: {
    fileName: string
    sha256: string
    importedAt: string
  }
  header: {
    wallaceWorkOrderId: string
    customerName: string
    vesselName?: string
    location?: string
  }
  lines: Array<{
    lineType: 'LABOR' | 'PART'
    itemCode?: string
    description: string
    qty: number
    unitPrice: number
    amount: number
  }>
  totals: {
    labor: number
    parts: number
    total: number
  }
}

function parseNumber(v: string) {
  const n = Number(String(v ?? '').replace(/[$,]/g, '').trim())
  return Number.isFinite(n) ? n : 0
}

// Minimal CSV parser (demo): supports commas, no quoted-commas.
export function parseWallaceExportCsv(csvText: string): WallaceExportRow[] {
  const rows = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)

  if (rows.length < 2) return []

  const header = rows[0].split(',').map((h) => h.trim())
  const idx = (name: string) => header.findIndex((h) => h.toLowerCase() === name.toLowerCase())

  // Actually parse each line into array of cols.
  const dataLines = rows.slice(1).map((r) => r.split(',').map((c) => c.trim()))

  const out: WallaceExportRow[] = []
  for (const cols of dataLines) {
    const wallaceWorkOrderId = cols[idx('WallaceWorkOrderId')] ?? cols[idx('WorkOrderId')] ?? ''
    const customerName = cols[idx('CustomerName')] ?? ''
    const vesselName = cols[idx('VesselName')] ?? ''
    const location = cols[idx('Location')] ?? ''
    const lineTypeRaw = (cols[idx('LineType')] ?? '').toUpperCase()
    const lineType: 'LABOR' | 'PART' = lineTypeRaw === 'LABOR' ? 'LABOR' : 'PART'
    const itemCode = cols[idx('ItemCode')] ?? ''
    const description = cols[idx('Description')] ?? ''
    const qty = parseNumber(cols[idx('Qty')] ?? '1')
    const unitPrice = parseNumber(cols[idx('UnitPrice')] ?? '0')
    const amount = parseNumber(cols[idx('Amount')] ?? String(qty * unitPrice))

    if (!wallaceWorkOrderId || !customerName || !description) continue

    out.push({
      wallaceWorkOrderId,
      customerName,
      vesselName: vesselName || undefined,
      location: location || undefined,
      lineType,
      itemCode: itemCode || undefined,
      description,
      qty: qty || 1,
      unitPrice,
      amount,
    })
  }

  return out
}

export function buildWallacePacketFromExport(input: {
  fileName: string
  sha256: string
  importedAt: string
  rows: WallaceExportRow[]
}): WallacePacket {
  const first = input.rows[0]
  const header = {
    wallaceWorkOrderId: first?.wallaceWorkOrderId ?? 'WO-UNKNOWN',
    customerName: first?.customerName ?? 'Unknown customer',
    vesselName: first?.vesselName,
    location: first?.location,
  }

  let labor = 0
  let parts = 0

  const lines = input.rows.map((r) => {
    if (r.lineType === 'LABOR') labor += r.amount
    else parts += r.amount
    return {
      lineType: r.lineType,
      itemCode: r.itemCode,
      description: r.description,
      qty: r.qty,
      unitPrice: r.unitPrice,
      amount: r.amount,
    }
  })

  const totals = {
    labor: Number(labor.toFixed(2)),
    parts: Number(parts.toFixed(2)),
    total: Number((labor + parts).toFixed(2)),
  }

  return {
    source: {
      fileName: input.fileName,
      sha256: input.sha256,
      importedAt: input.importedAt,
    },
    header,
    lines,
    totals,
  }
}

export function mapWallaceLineToQboItem(line: { lineType: 'LABOR' | 'PART'; itemCode?: string; description: string }) {
  // Demo mapping rules.
  if (line.lineType === 'LABOR') return { qboItem: 'Labor', reason: 'lineType=LABOR' }
  if (line.itemCode && /OIL|FILTER|SPARK/i.test(line.itemCode + ' ' + line.description)) return { qboItem: 'Parts', reason: 'vendor item matched' }
  return { qboItem: 'Parts', reason: 'default parts mapping' }
}
