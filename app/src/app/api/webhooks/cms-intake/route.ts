import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'
import { mapCmsWebhookToIntake } from '@/lib/cms-intake-map'
import { buildWallacePacket } from '@/lib/wallace-packet'
import {
  buildIdempotencyKey,
  hashPayload,
  markWebhookInboxStatus,
  markWebhookEventStatus,
  recordWebhookEvent,
  recordWebhookInbox,
} from '@/lib/webhook-events'
import { inngest } from '@/lib/inngest/client'
import { getCorrelationId } from '@/lib/correlation'
import { enqueueOutboxEvent } from '@/lib/outbox'
import { recordIntegrationAttempt } from '@/lib/integration-attempts'
import { assertServerEnv } from '@/lib/env'

function getHeader(req: Request, name: string) {
  return req.headers.get(name) ?? req.headers.get(name.toLowerCase())
}

function isAuthorized(req: Request) {
  const requiredSecret = process.env.CMS_WEBHOOK_SECRET
  if (!requiredSecret) return true

  const provided =
    getHeader(req, 'x-cms-webhook-secret') ??
    getHeader(req, 'x-webhook-secret') ??
    getHeader(req, 'authorization')?.replace(/^Bearer\s+/i, '')

  return !!provided && provided === requiredSecret
}

export async function POST(req: Request) {
  assertServerEnv()
  const correlationId = getCorrelationId(req)
  let webhookInboxId: string | null = null
  let webhookEventId: string | null = null

  try {
    if (!isAuthorized(req)) {
      return NextResponse.json({ ok: false, error: 'Unauthorized', correlationId }, { status: 401 })
    }

    const rawBody = await req.text()
    const payload = JSON.parse(rawBody)
    const mapped = mapCmsWebhookToIntake(payload)

    const source = 'cms_webhook'
    const eventType = mapped.formType || 'unknown_form'
    const payloadHash = hashPayload(rawBody)
    const providedIdempotencyKey =
      getHeader(req, 'x-idempotency-key') ?? getHeader(req, 'x-event-id') ?? getHeader(req, 'x-webhook-id')

    const idempotencyKey = buildIdempotencyKey({
      source,
      eventType,
      providedKey: providedIdempotencyKey,
      payloadHash,
    })

    const inboxRecord = await recordWebhookInbox({
      source,
      eventType,
      idempotencyKey,
      payloadHash,
      payload,
      correlationId,
    })

    if (inboxRecord.duplicate) {
      return NextResponse.json(
        {
          ok: true,
          duplicate: true,
          idempotencyKey,
          correlationId,
        },
        { status: 200 }
      )
    }

    webhookInboxId = inboxRecord.event.id

    // keep legacy record in transition window
    const eventRecord = await recordWebhookEvent({
      source,
      eventType,
      idempotencyKey,
      payload,
    })
    webhookEventId = eventRecord.duplicate ? null : eventRecord.event.id

    const createdIntake = await prisma.intakeRequest.create({
      data: {
        customerName: mapped.customerName,
        email: mapped.email,
        phone: mapped.phone,
        vesselName: mapped.vesselName,
        serviceRequest: mapped.serviceRequest,
        location: mapped.location,
      },
    })

    const autoCreateWorkOrder = process.env.CMS_WEBHOOK_AUTO_CREATE_WORK_ORDER === 'true'
    let createdWorkOrderId: string | null = null

    if (autoCreateWorkOrder) {
      const wo = await prisma.workOrder.create({
        data: {
          intakeRequestId: createdIntake.id,
          status: 'NEW',
        },
      })
      createdWorkOrderId = wo.id

      const handoffPacket = buildWallacePacket({
        workOrderId: wo.id,
        customerName: createdIntake.customerName,
        location: createdIntake.location,
        vesselName: createdIntake.vesselName,
        email: createdIntake.email,
        phone: createdIntake.phone,
        serviceRequest: createdIntake.serviceRequest,
        source: `CMS webhook (${mapped.formType})`,
      })

      await logAudit({
        entityType: 'WORK_ORDER',
        action: 'WORK_ORDER_CREATED_FROM_WEBHOOK',
        message: `Work order auto-created from CMS webhook (${mapped.formType})`,
        workOrderId: wo.id,
        intakeRequestId: createdIntake.id,
        metadata: {
          source: 'cms_webhook',
          formType: mapped.formType,
          handoffPacket,
          idempotencyKey,
          correlationId,
        },
      })
    }

    await logAudit({
      entityType: 'INTAKE',
      action: 'INTAKE_CREATED_FROM_WEBHOOK',
      message: `Intake created from CMS webhook (${mapped.formType}) for ${createdIntake.customerName}`,
      intakeRequestId: createdIntake.id,
      metadata: {
        source: 'cms_webhook',
        formType: mapped.formType,
        sourceUrl: mapped.sourceUrl,
        idempotencyKey,
        correlationId,
        rawPayload: JSON.stringify(mapped.raw),
      },
    })

    await enqueueOutboxEvent({
      eventType: 'cms.intake.received',
      aggregateType: 'IntakeRequest',
      aggregateId: createdIntake.id,
      dedupeKey: `cms.intake.received:${createdIntake.id}:${idempotencyKey}`,
      correlationId,
      causationId: webhookInboxId ?? undefined,
      payload: {
        intakeId: createdIntake.id,
        workOrderId: createdWorkOrderId,
        formType: mapped.formType,
        idempotencyKey,
      },
    })

    await markWebhookInboxStatus(webhookInboxId, 'PROCESSED')
    if (webhookEventId) await markWebhookEventStatus(webhookEventId, 'PROCESSED')

    await inngest.send({
      name: 'cms/intake.received',
      data: {
        intakeId: createdIntake.id,
        workOrderId: createdWorkOrderId,
        formType: mapped.formType,
        idempotencyKey,
        correlationId,
      },
    })

    await recordIntegrationAttempt({
      provider: 'inngest',
      operation: 'cms/intake.received',
      externalKey: idempotencyKey,
      status: 'SUCCESS',
      correlationId,
      metadata: {
        intakeId: createdIntake.id,
        workOrderId: createdWorkOrderId,
      },
    })

    return NextResponse.json(
      {
        ok: true,
        intakeId: createdIntake.id,
        workOrderId: createdWorkOrderId,
        formType: mapped.formType,
        idempotencyKey,
        correlationId,
      },
      { status: 201 }
    )
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)

    if (webhookInboxId) {
      await markWebhookInboxStatus(webhookInboxId, 'FAILED', message)
    }
    if (webhookEventId) {
      await markWebhookEventStatus(webhookEventId, 'FAILED', message)
    }

    await recordIntegrationAttempt({
      provider: 'cms-webhook',
      operation: 'ingest',
      externalKey: webhookInboxId ?? `failed:${Date.now()}`,
      status: 'TERMINAL_ERROR',
      correlationId,
      retryable: false,
      error: message,
    })

    return NextResponse.json({ ok: false, error: 'Invalid webhook payload', correlationId }, { status: 400 })
  }
}
