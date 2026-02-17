import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const intakes = await prisma.intakeRequest.findMany({
    include: { workOrders: true },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ ok: true, intakes })
}
