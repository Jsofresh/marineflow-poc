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

  // Convert Date objects to ISO strings for client compatibility
  const serializedWorkOrders = workOrders.map(wo => ({
    ...wo,
    createdAt: wo.createdAt.toISOString(),
    updatedAt: wo.updatedAt.toISOString(),
    completedAt: wo.completedAt?.toISOString() ?? null,
    intakeRequest: {
      ...wo.intakeRequest,
      createdAt: wo.intakeRequest.createdAt.toISOString(),
      updatedAt: wo.intakeRequest.updatedAt.toISOString(),
    }
  }))

  const serializedIntakes = intakes.map(i => ({
    ...i,
    createdAt: i.createdAt.toISOString(),
    updatedAt: i.updatedAt.toISOString(),
  }))

  return { workOrders: serializedWorkOrders, intakes: serializedIntakes }
}

export default async function BoardPage() {
  const { workOrders, intakes } = await getBoardData()
  return <BoardClient initialWorkOrders={workOrders} initialIntakes={intakes} />
}
