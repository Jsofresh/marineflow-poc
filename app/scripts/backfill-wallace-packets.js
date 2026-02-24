#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
/*
One-time backfill:
- For invoiced work orders created before Wallace packet totals were logged,
  create a WALLACE_PACKET_SNAPSHOT audit entry containing totals.packetTotal.

This is demo-safe: it does not change billing amounts in QBO; it only creates a Wallace packet snapshot
so the QuickBooks monitor can display Total bill consistently.

Usage:
  cd app && node scripts/backfill-wallace-packets.js

Env:
  DATABASE_URL must be set (app/.env already used by Next).
*/

const { PrismaClient } = require('@prisma/client')

function isRecord(v) {
  return typeof v === 'object' && v !== null
}

function readNumber(v) {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

function sumQbPayloadTotal(qbPayload) {
  if (!isRecord(qbPayload)) return null
  const lines = qbPayload.Line
  if (!Array.isArray(lines)) return null
  let sum = 0
  for (const l of lines) {
    if (!isRecord(l)) continue
    const amt = readNumber(l.Amount)
    if (amt === null) continue
    sum += amt
  }
  return Number.isFinite(sum) ? sum : null
}

async function main() {
  const prisma = new PrismaClient()
  const targetStatuses = ['INVOICED']
  const targetQb = ['PENDING', 'INVOICE_APPROVED', 'INVOICED', 'SYNCED', 'DELINQUENT']

  const workOrders = await prisma.workOrder.findMany({
    where: {
      OR: [{ status: { in: targetStatuses } }, { qbSyncStatus: { in: targetQb } }],
    },
    select: { id: true, intakeRequestId: true, qbInvoiceId: true, qbSyncStatus: true, updatedAt: true },
    orderBy: { updatedAt: 'desc' },
  })

  let scanned = 0
  let skippedHasSnapshot = 0
  let skippedNoQbLog = 0
  let skippedNoTotal = 0
  let created = 0

  for (const wo of workOrders) {
    scanned++

    const existing = await prisma.activityLog.findFirst({
      where: { workOrderId: wo.id, action: 'WALLACE_PACKET_SNAPSHOT' },
      select: { id: true },
    })
    if (existing) {
      skippedHasSnapshot++
      continue
    }

    const qbLog = await prisma.activityLog.findFirst({
      where: { workOrderId: wo.id, action: 'QB_SYNC_SUCCESS' },
      orderBy: { createdAt: 'desc' },
      select: { metadata: true },
    })

    const meta = qbLog?.metadata
    if (!isRecord(meta)) {
      // No historical QB log exists (seeded / pre-audit era). For demo purposes, generate a
      // deterministic Wallace packet total and snapshot it so the monitor can show $ values.
      skippedNoQbLog++

      const seed = wo.id.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
      const packetTotal = 250 + (seed % 950) + ((seed % 97) / 100)

      await prisma.activityLog.create({
        data: {
          entityType: 'WORK_ORDER',
          action: 'WALLACE_PACKET_SNAPSHOT',
          message: 'Wallace packet snapshot backfilled (seeded invoice; historical packet not stored)',
          workOrderId: wo.id,
          intakeRequestId: wo.intakeRequestId,
          metadata: {
            totals: { packetTotal },
            backfillSource: 'SEED_DETERMINISTIC',
            note: 'Demo backfill: this record predates stored Wallace packets; total generated deterministically until real Wallace export is available.',
          },
        },
      })
      created++
      continue
    }

    // Prefer packetTotal if already present in old logs.
    const totals = meta.totals
    if (isRecord(totals)) {
      const packetTotal = readNumber(totals.packetTotal)
      if (packetTotal !== null) {
        await prisma.activityLog.create({
          data: {
            entityType: 'WORK_ORDER',
            action: 'WALLACE_PACKET_SNAPSHOT',
            message: 'Wallace packet snapshot backfilled from prior packet totals',
            workOrderId: wo.id,
            intakeRequestId: wo.intakeRequestId,
            metadata: {
              totals: { packetTotal },
              backfillSource: 'QB_SYNC_SUCCESS.totals.packetTotal',
            },
          },
        })
        created++
        continue
      }
    }

    // Backfill from qbPayload as a last resort.
    const qbPayloadTotal = sumQbPayloadTotal(meta.qbPayload)
    if (qbPayloadTotal === null) {
      skippedNoTotal++
      continue
    }

    await prisma.activityLog.create({
      data: {
        entityType: 'WORK_ORDER',
        action: 'WALLACE_PACKET_SNAPSHOT',
        message: 'Wallace packet snapshot backfilled (derived from prior QBO payload)',
        workOrderId: wo.id,
        intakeRequestId: wo.intakeRequestId,
        metadata: {
          totals: { packetTotal: qbPayloadTotal },
          backfillSource: 'QB_SYNC_SUCCESS.qbPayload.Line[].Amount',
          note: 'Demo backfill: historical Wallace packet was not stored; total derived from stored QBO payload.',
        },
      },
    })
    created++
  }

  console.log(
    JSON.stringify(
      {
        scanned,
        created,
        skippedHasSnapshot,
        skippedNoQbLog,
        skippedNoTotal,
      },
      null,
      2
    )
  )

  await prisma.$disconnect()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
