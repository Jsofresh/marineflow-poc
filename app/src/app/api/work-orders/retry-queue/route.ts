import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const queue = await prisma.workOrder.findMany({
    where: { qbSyncStatus: 'RETRY_PENDING' },
    include: { intakeRequest: true },
    orderBy: { updatedAt: 'asc' },
  })

  return NextResponse.json({ ok: true, count: queue.length, queue })
}
