import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const EXCEPTION_STATUSES = ['PENDING', 'ERROR'] as const

export async function GET() {
  const jobs = await prisma.workOrder.findMany({
    where: {
      wallaceSyncStatus: { in: [...EXCEPTION_STATUSES] },
    },
    include: {
      intakeRequest: {
        select: {
          customerName: true,
          location: true,
          serviceRequest: true,
        },
      },
    },
    orderBy: [
      { wallaceSyncStatus: 'desc' },
      { updatedAt: 'asc' },
    ],
  })

  return NextResponse.json({
    ok: true,
    jobs,
    statuses: EXCEPTION_STATUSES,
    count: jobs.length,
  })
}
