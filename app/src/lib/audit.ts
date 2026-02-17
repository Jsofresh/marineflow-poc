import { prisma } from '@/lib/prisma'
import { ActivityEntity, Prisma } from '@prisma/client'

type AuditInput = {
  entityType: ActivityEntity
  action: string
  message: string
  workOrderId?: string
  intakeRequestId?: string
  metadata?: Prisma.InputJsonValue
}

export async function logAudit(input: AuditInput) {
  return prisma.activityLog.create({
    data: {
      entityType: input.entityType,
      action: input.action,
      message: input.message,
      workOrderId: input.workOrderId,
      intakeRequestId: input.intakeRequestId,
      metadata: input.metadata,
    },
  })
}
