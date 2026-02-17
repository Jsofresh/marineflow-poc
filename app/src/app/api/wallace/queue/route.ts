import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const [unassignedIntakes, wallaceQueue] = await Promise.all([
    prisma.intakeRequest.findMany({
      where: { workOrders: { none: {} } },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.workOrder.findMany({
      where: { wallaceEntered: false },
      include: { intakeRequest: true },
      orderBy: { createdAt: 'asc' },
    }),
  ])

  return NextResponse.json({ ok: true, unassignedIntakes, wallaceQueue })
}
