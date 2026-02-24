import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { buildWallacePacketFromExport, parseWallaceExportCsv, mapWallaceLineToQboItem } from '@/lib/wallace-export'

export async function POST(req: Request) {
  const form = await req.formData().catch(() => null)
  if (!form) return NextResponse.json({ ok: false, error: 'Expected multipart form data' }, { status: 400 })

  const file = form.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: 'Missing file' }, { status: 400 })
  }

  const buf = Buffer.from(await file.arrayBuffer())
  const sha256 = crypto.createHash('sha256').update(buf).digest('hex')
  const text = buf.toString('utf8')

  const rows = parseWallaceExportCsv(text)
  if (!rows.length) {
    return NextResponse.json({ ok: false, error: 'No rows parsed. Check CSV headers/format.' }, { status: 400 })
  }

  const importedAt = new Date().toISOString()
  const packet = buildWallacePacketFromExport({ fileName: file.name, sha256, importedAt, rows })

  const mapping = packet.lines.map((l) => ({
    lineType: l.lineType,
    itemCode: l.itemCode ?? null,
    description: l.description,
    amount: l.amount,
    ...mapWallaceLineToQboItem(l),
  }))

  return NextResponse.json({ ok: true, packet, mapping })
}

export async function GET() {
  // Provide a sample CSV as text so the UI can offer a download.
  const sample = [
    'WallaceWorkOrderId,CustomerName,VesselName,Location,LineType,ItemCode,Description,Qty,UnitPrice,Amount',
    'WAL-10293,Emily Carter,Blue Current,Salem Dock A,LABOR,LABOR-MECH,Mechanical labor (engine diagnostics),3.5,155,542.5',
    'WAL-10293,Emily Carter,Blue Current,Salem Dock A,PART,BILGE-PUMP,Bilge Pump Kit,1,140,140',
    'WAL-10293,Emily Carter,Blue Current,Salem Dock A,PART,HOSE-CLAMP,Hose clamps + hardware,1,22,22',
  ].join('\n')

  return new NextResponse(sample, {
    status: 200,
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': 'attachment; filename="wallace-export-sample.csv"',
    },
  })
}
