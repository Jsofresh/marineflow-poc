export const dynamic = 'force-dynamic'

import { prisma } from '@/lib/prisma'
import BoardClient from './board-client'

async function getBoardData() {
  const [workOrders, intakes] = await Promise.all([
    prisma.workOrder.findMany({
      include: { intakeRequest: true },
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.intakeRequest.findMany({
      include: { workOrders: true },
      orderBy: { createdAt: 'desc' },
    }),
  ])

  return { workOrders, intakes }
}

export default async function BoardPage() {
  const { workOrders, intakes } = await getBoardData()
  return <BoardClient initialWorkOrders={workOrders} initialIntakes={intakes} />
}
