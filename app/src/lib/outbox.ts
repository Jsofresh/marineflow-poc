import { prisma } from '@/lib/prisma'

export type OutboxStatus = 'PENDING' | 'PROCESSING' | 'PROCESSED' | 'FAILED' | 'DEAD_LETTER'

export async function enqueueOutboxEvent(input: {
  eventType: string
  aggregateType: string
  aggregateId: string
  dedupeKey: string
  correlationId: string
  causationId?: string
  payload: unknown
}) {
  try {
    const event = await prisma.eventOutbox.create({
      data: {
        eventType: input.eventType,
        aggregateType: input.aggregateType,
        aggregateId: input.aggregateId,
        dedupeKey: input.dedupeKey,
        correlationId: input.correlationId,
        causationId: input.causationId,
        payload: input.payload as object,
      },
    })
    return { duplicate: false as const, event }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    if (message.includes('Unique constraint failed') || message.includes('dedupeKey')) {
      const existing = await prisma.eventOutbox.findUnique({ where: { dedupeKey: input.dedupeKey } })
      return { duplicate: true as const, event: existing }
    }
    throw err
  }
}

export async function markOutboxStatus(id: string, status: OutboxStatus, error?: string) {
  return prisma.eventOutbox.update({
    where: { id },
    data: {
      status,
      lastError: error ?? null,
      processedAt: status === 'PROCESSED' ? new Date() : undefined,
      nextAttemptAt: status === 'FAILED' ? new Date(Date.now() + 60_000) : undefined,
    },
  })
}

export function computeOutboxBackoffMs(attempts: number) {
  // attempts is the number of times we have tried to process the event.
  // Keep it simple: linear backoff, capped at 15m.
  return Math.min(60_000 * Math.max(1, attempts), 15 * 60_000)
}

export function shouldDeadLetterOutbox(attempts: number) {
  return attempts >= 5
}

/**
 * Marks an already-claimed outbox event as FAILED/DEAD_LETTER.
 *
 * IMPORTANT: `claimOutboxBatch()` is responsible for incrementing attempts.
 * This function MUST NOT increment attempts again (otherwise one failure counts as 2).
 */
export async function recordOutboxFailure(id: string, error: string) {
  const current = await prisma.eventOutbox.findUnique({ where: { id } })
  const attempts = current?.attempts ?? 0
  const deadLetter = shouldDeadLetterOutbox(attempts)
  const delayMs = computeOutboxBackoffMs(attempts)

  return prisma.eventOutbox.update({
    where: { id },
    data: {
      status: deadLetter ? 'DEAD_LETTER' : 'FAILED',
      lastError: error,
      nextAttemptAt: new Date(Date.now() + delayMs),
    },
  })
}

export async function claimOutboxBatch(limit = 25) {
  const due = await prisma.eventOutbox.findMany({
    where: {
      status: { in: ['PENDING', 'FAILED'] },
      nextAttemptAt: { lte: new Date() },
    },
    orderBy: { createdAt: 'asc' },
    take: limit,
  })

  const claimed = [] as typeof due
  for (const event of due) {
    // Optimistic claim: only one worker should be able to flip status for a given row.
    const updated = await prisma.eventOutbox.updateMany({
      where: { id: event.id, status: event.status as OutboxStatus },
      data: { status: 'PROCESSING', attempts: { increment: 1 } },
    })

    if (updated.count > 0) {
      const row = await prisma.eventOutbox.findUnique({ where: { id: event.id } })
      if (row) claimed.push(row)
    }
  }

  return claimed
}
