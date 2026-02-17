import { prisma } from '@/lib/prisma'

function esc(value: unknown) {
  if (value === null || value === undefined) return ''
  const s = String(value)
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replaceAll('"', '""')}"`
  }
  return s
}

export async function GET() {
  const rows = await prisma.workOrder.findMany({
    include: { intakeRequest: true },
    orderBy: { createdAt: 'desc' },
  })

  const header = [
    'work_order_id',
    'status',
    'qb_sync_status',
    'qb_retry_count',
    'qb_invoice_id',
    'customer_name',
    'location',
    'service_request',
    'created_at',
    'updated_at',
  ]

  const lines = [
    header.join(','),
    ...rows.map((r) =>
      [
        r.id,
        r.status,
        r.qbSyncStatus,
        r.qbRetryCount,
        r.qbInvoiceId ?? '',
        r.intakeRequest.customerName,
        r.intakeRequest.location,
        r.intakeRequest.serviceRequest,
        r.createdAt.toISOString(),
        r.updatedAt.toISOString(),
      ]
        .map(esc)
        .join(',')
    ),
  ]

  return new Response(lines.join('\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="work-orders-export.csv"',
    },
  })
}
