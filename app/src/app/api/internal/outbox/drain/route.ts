import { NextResponse } from 'next/server'
import { claimOutboxBatch, markOutboxStatus, recordOutboxFailure } from '@/lib/outbox'
import { recordIntegrationAttempt } from '@/lib/integration-attempts'
import { jsonHash } from '@/lib/correlation'
import { assertServerEnv } from '@/lib/env'

function isAllowed(req: Request) {
  const secret = process.env.INTERNAL_WORKER_SECRET
  if (!secret) return false
  const provided = req.headers.get('x-internal-worker-secret')
  return provided === secret
}

export async function POST(req: Request) {
  assertServerEnv()
  if (!isAllowed(req)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const batch = await claimOutboxBatch(25)
  let processed = 0
  let failed = 0
  let deadLettered = 0

  for (const event of batch) {
    try {
      // phase-1 processor: mark durable delivery to integration attempt ledger.
      await recordIntegrationAttempt({
        provider: 'outbox-worker',
        operation: event.eventType,
        externalKey: event.id,
        status: 'SUCCESS',
        correlationId: event.correlationId,
        requestHash: jsonHash(event.payload),
        metadata: {
          aggregateType: event.aggregateType,
          aggregateId: event.aggregateId,
          dedupeKey: event.dedupeKey,
        },
      })

      await markOutboxStatus(event.id, 'PROCESSED')
      processed += 1
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      const updated = await recordOutboxFailure(event.id, message)
      failed += 1
      if (updated.status === 'DEAD_LETTER') deadLettered += 1
    }
  }

  return NextResponse.json({
    ok: true,
    claimed: batch.length,
    processed,
    failed,
    deadLettered,
  })
}
