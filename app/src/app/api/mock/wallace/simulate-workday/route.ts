import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'

function deterministicTotal(id: string) {
  const seed = id.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
  // $350.00–$1,650.00-ish range with cents
  return 350 + (seed % 1300) + ((seed % 97) / 100)
}

function sample<T>(arr: T[], pct: number) {
  const count = Math.max(0, Math.min(arr.length, Math.round(arr.length * pct)))
  const copy = [...arr]
  // Fisher–Yates shuffle
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy.slice(0, count)
}

export async function POST() {
  // Recommended percents (tunable):
  // - 45% of "not in Wallace" become entered
  // - 35% of "in Wallace" become complete
  // - 70% of "complete" become ready-for-review (have packet totals)
  const pctEnter = 0.45
  const pctComplete = 0.35
  const pctReady = 0.7

  const workOrders = await prisma.workOrder.findMany({
    include: { intakeRequest: true },
    orderBy: { createdAt: 'asc' },
  })

  const notInWallace = workOrders.filter((w) => !w.wallaceEntered && w.status !== 'INVOICED')
  const inWallace = workOrders.filter((w) => w.wallaceEntered && w.status !== 'COMPLETE' && w.status !== 'INVOICED')
  const complete = workOrders.filter((w) => w.wallaceEntered && w.status === 'COMPLETE')

  const toEnter = sample(notInWallace, pctEnter)
  const toComplete = sample(inWallace, pctComplete)
  const toReady = sample(complete, pctReady)

  const now = new Date()

  // 1) Entered into Wallace
  await Promise.all(
    toEnter.map(async (w) => {
      const wallaceExternalId = w.wallaceExternalId ?? `WAL-${w.id.slice(-6).toUpperCase()}`
      const updated = await prisma.workOrder.update({
        where: { id: w.id },
        data: {
          wallaceEntered: true,
          wallaceEnteredAt: now,
          wallaceExternalId,
          wallaceSyncStatus: 'ENTERED',
        },
      })

      await logAudit({
        entityType: 'WORK_ORDER',
        action: 'WALLACE_SCAN_MOVED_TO_ENTERED',
        message: `Wallace scan detected work order entered (${wallaceExternalId})`,
        workOrderId: updated.id,
        intakeRequestId: updated.intakeRequestId,
        metadata: { wallaceExternalId, simulated: true },
      })
    })
  )

  // 2) Completed in Wallace
  await Promise.all(
    toComplete.map(async (w) => {
      const updated = await prisma.workOrder.update({
        where: { id: w.id },
        data: {
          status: 'COMPLETE',
          wallaceSyncStatus: 'CONFIRMED',
        },
      })

      await logAudit({
        entityType: 'WORK_ORDER',
        action: 'WALLACE_SCAN_MOVED_TO_COMPLETE',
        message: 'Wallace scan detected work order completed (ready to bill)',
        workOrderId: updated.id,
        intakeRequestId: updated.intakeRequestId,
        metadata: { simulated: true },
      })
    })
  )

  // 3) Ready for review: snapshot Wallace packet totals (source of truth for billing)
  await Promise.all(
    toReady.map(async (w) => {
      const packetTotal = deterministicTotal(w.id)
      await logAudit({
        entityType: 'WORK_ORDER',
        action: 'WALLACE_PACKET_SNAPSHOT',
        message: 'Wallace packet snapshot created (ready for review)',
        workOrderId: w.id,
        intakeRequestId: w.intakeRequestId,
        metadata: {
          totals: { packetTotal },
          backfillSource: 'SIM_WORKDAY',
          simulated: true,
        },
      })

      await logAudit({
        entityType: 'WORK_ORDER',
        action: 'WALLACE_READY_FOR_REVIEW',
        message: 'Wallace scan marked work order ready for billing review',
        workOrderId: w.id,
        intakeRequestId: w.intakeRequestId,
        metadata: { simulated: true },
      })
    })
  )

  await logAudit({
    entityType: 'WORK_ORDER',
    action: 'WALLACE_SCAN_RAN',
    message: 'Simulated full workday Wallace scan',
    metadata: {
      simulated: true,
      pctEnter,
      pctComplete,
      pctReady,
      movedToEntered: toEnter.length,
      movedToComplete: toComplete.length,
      snapshottedReady: toReady.length,
      scannedTotal: workOrders.length,
      ranAt: now.toISOString(),
    },
  })

  return NextResponse.json({
    ok: true,
    ranAt: now.toISOString(),
    movedToEntered: toEnter.length,
    movedToComplete: toComplete.length,
    readySnapshotted: toReady.length,
  })
}
