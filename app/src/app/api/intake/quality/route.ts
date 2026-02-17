import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getIntakeQuality } from '@/lib/intake-quality'

export async function GET() {
  const intakes = await prisma.intakeRequest.findMany({
    include: { workOrders: true },
    orderBy: { createdAt: 'desc' },
  })

  const rows = intakes.map((i) => {
    const q = getIntakeQuality(i)
    return {
      id: i.id,
      customerName: i.customerName,
      location: i.location,
      score: q.score,
      missing: q.missing,
      warnings: q.warnings,
      needsReview: q.needsReview,
      hasWorkOrder: i.workOrders.length > 0,
      createdAt: i.createdAt,
    }
  })

  const avgScore = rows.length ? Math.round(rows.reduce((a, b) => a + b.score, 0) / rows.length) : 100
  const lowQuality = rows.filter((r) => r.needsReview)

  return NextResponse.json({
    ok: true,
    summary: {
      avgScore,
      total: rows.length,
      lowQualityCount: lowQuality.length,
    },
    rows,
  })
}
