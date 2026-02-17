import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const hours = Number(url.searchParams.get('hours') ?? '24')
  const threshold = new Date(Date.now() - hours * 60 * 60 * 1000)

  const stuck = await prisma.workOrder.findMany({
    where: {
      status: { not: 'INVOICED' },
      updatedAt: { lt: threshold },
    },
    include: { intakeRequest: true },
    orderBy: { updatedAt: 'asc' },
  })

  return NextResponse.json({ ok: true, hours, count: stuck.length, stuck })
}
