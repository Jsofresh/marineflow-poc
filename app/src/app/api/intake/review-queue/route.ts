import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getIntakeQuality } from '@/lib/intake-quality'

export async function GET() {
  const intakes = await prisma.intakeRequest.findMany({
    include: { workOrders: true },
    orderBy: { createdAt: 'desc' },
  })

  const rows = intakes
    .map((i) => {
      const q = getIntakeQuality(i)
      return {
        id: i.id,
        customerName: i.customerName,
        location: i.location,
        serviceRequest: i.serviceRequest,
        missing: q.missing,
        warnings: q.warnings,
        score: q.score,
        needsReview: q.needsReview,
        hasWorkOrder: i.workOrders.length > 0,
        createdAt: i.createdAt,
      }
    })
    .filter((r) => r.needsReview)

  return NextResponse.json({ ok: true, count: rows.length, queue: rows })
}
