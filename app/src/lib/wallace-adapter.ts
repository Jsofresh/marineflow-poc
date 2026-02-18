import { prisma } from '@/lib/prisma'

export type WallaceDispatchInput = {
  workOrderId: string
  packet: string
}

export type WallaceDispatchResult = {
  provider: 'WALLACE_MOCK'
  jobId: string
  acceptedAt: string
}

function mockWallaceJobId(workOrderId: string) {
  return `WAL-${workOrderId.slice(0, 8).toUpperCase()}-${Date.now().toString().slice(-6)}`
}

export async function dispatchToWallaceMock(input: WallaceDispatchInput): Promise<WallaceDispatchResult> {
  const jobId = mockWallaceJobId(input.workOrderId)
  const acceptedAt = new Date().toISOString()

  await prisma.workOrder.update({
    where: { id: input.workOrderId },
    data: {
      wallaceSyncStatus: 'CONFIRMED',
      wallaceEntered: true,
      wallaceEnteredAt: new Date(acceptedAt),
      wallaceExternalId: jobId,
      status: 'PARTS_ORDERED',
    },
  })

  return {
    provider: 'WALLACE_MOCK',
    jobId,
    acceptedAt,
  }
}
