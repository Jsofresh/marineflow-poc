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
    where: { wallaceEntered: false },
    include: { intakeRequest: true },
    orderBy: { createdAt: 'asc' },
  })

  const header = [
    'work_order_id',
    'status',
    'customer_name',
    'email',
    'phone',
    'vessel_name',
    'location',
    'service_request',
    'created_at',
  ]

  const lines = [
    header.join(','),
    ...rows.map((r) =>
      [
        r.id,
        r.status,
        r.intakeRequest.customerName,
        r.intakeRequest.email ?? '',
        r.intakeRequest.phone ?? '',
        r.intakeRequest.vesselName ?? '',
        r.intakeRequest.location,
        r.intakeRequest.serviceRequest,
        r.createdAt.toISOString(),
      ]
        .map(esc)
        .join(',')
    ),
  ]

  return new Response(lines.join('\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="wallace-queue.csv"',
    },
  })
}
