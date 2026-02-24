import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export async function recordIntegrationAttempt(input: {
  provider: string
  operation: string
  externalKey: string
  status: 'SUCCESS' | 'RETRYABLE_ERROR' | 'TERMINAL_ERROR'
  correlationId?: string
  requestHash?: string
  responseHash?: string
  responseCode?: number
  retryable?: boolean
  error?: string
  metadata?: Prisma.InputJsonValue
}) {
  return prisma.integrationAttempt.upsert({
    where: {
      provider_externalKey: {
        provider: input.provider,
        externalKey: input.externalKey,
      },
    },
    create: {
      provider: input.provider,
      operation: input.operation,
      externalKey: input.externalKey,
      status: input.status,
      correlationId: input.correlationId,
      requestHash: input.requestHash,
      responseHash: input.responseHash,
      responseCode: input.responseCode,
      retryable: input.retryable ?? false,
      error: input.error,
      metadata: input.metadata,
    },
    update: {
      operation: input.operation,
      status: input.status,
      correlationId: input.correlationId,
      requestHash: input.requestHash,
      responseHash: input.responseHash,
      responseCode: input.responseCode,
      retryable: input.retryable ?? false,
      error: input.error,
      metadata: input.metadata,
    },
  })
}
