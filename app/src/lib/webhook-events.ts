import crypto from 'crypto'
import { prisma } from '@/lib/prisma'

export function hashPayload(raw: string) {
  return crypto.createHash('sha256').update(raw).digest('hex')
}

export function buildIdempotencyKey(input: {
  source: string
  eventType: string
  providedKey?: string | null
  payloadHash: string
}) {
  if (input.providedKey && input.providedKey.trim().length > 0) {
    return `${input.source}:${input.eventType}:${input.providedKey.trim()}`
  }
  return `${input.source}:${input.eventType}:${input.payloadHash}`
}

export async function recordWebhookInbox(params: {
  source: string
  eventType: string
  idempotencyKey: string
  payloadHash: string
  payload: unknown
  correlationId?: string
}) {
  try {
    const created = await prisma.webhookInbox.create({
      data: {
        source: params.source,
        eventType: params.eventType,
        idempotencyKey: params.idempotencyKey,
        payloadHash: params.payloadHash,
        payload: params.payload as object,
        correlationId: params.correlationId,
      },
    })
    return { duplicate: false as const, event: created }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    if (message.includes('Unique constraint failed') || message.includes('idempotencyKey')) {
      const existing = await prisma.webhookInbox.findUnique({ where: { idempotencyKey: params.idempotencyKey } })
      return { duplicate: true as const, event: existing }
    }
    throw err
  }
}

export async function markWebhookInboxStatus(id: string, status: 'PROCESSED' | 'FAILED', error?: string) {
  return prisma.webhookInbox.update({
    where: { id },
    data: {
      status,
      error: error ?? null,
    },
  })
}

// legacy compatibility while transition from WebhookEvent table
export async function recordWebhookEvent(params: {
  source: string
  eventType: string
  idempotencyKey: string
  payload: unknown
}) {
  try {
    const created = await prisma.webhookEvent.create({
      data: {
        source: params.source,
        eventType: params.eventType,
        idempotencyKey: params.idempotencyKey,
        payload: params.payload as object,
      },
    })
    return { duplicate: false as const, event: created }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    if (message.includes('Unique constraint failed') || message.includes('idempotencyKey')) {
      const existing = await prisma.webhookEvent.findUnique({ where: { idempotencyKey: params.idempotencyKey } })
      return { duplicate: true as const, event: existing }
    }
    throw err
  }
}

export async function markWebhookEventStatus(id: string, status: 'PROCESSED' | 'FAILED', error?: string) {
  return prisma.webhookEvent.update({
    where: { id },
    data: {
      status,
      error: error ?? null,
    },
  })
}
