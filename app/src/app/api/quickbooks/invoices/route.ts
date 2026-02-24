import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

function classifyInvoice(wo: { status: string; qbSyncStatus: string; updatedAt: Date; createdAt: Date }) {
  const ageDays = Math.floor((Date.now() - new Date(wo.updatedAt).getTime()) / (1000 * 60 * 60 * 24))

  if (wo.qbSyncStatus === 'SYNCED') return { bucket: 'PAID' as const, ageDays }
  if (wo.qbSyncStatus === 'DELINQUENT') return { bucket: 'DELINQUENT' as const, ageDays }

  const waitingStatuses = new Set(['PENDING', 'INVOICE_APPROVED', 'INVOICED'])
  if (waitingStatuses.has(wo.qbSyncStatus) || wo.status === 'INVOICED') {
    if (ageDays >= 14) return { bucket: 'DELINQUENT' as const, ageDays }
    return { bucket: 'WAITING' as const, ageDays }
  }

  return { bucket: 'WAITING' as const, ageDays }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null
}

function readNumber(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

function readBoolean(v: unknown): boolean | null {
  return typeof v === 'boolean' ? v : null
}

function sumQbPayloadTotal(qbPayload: unknown): number | null {
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

async function getLastQbTotals(workOrderId: string): Promise<number | null> {
  // Prefer an explicit Wallace packet snapshot (source of truth).
  const wallace = await prisma.activityLog.findFirst({
    where: { workOrderId, action: 'WALLACE_PACKET_SNAPSHOT' },
    orderBy: { createdAt: 'desc' },
    select: { metadata: true },
  })

  const wallaceMeta = wallace?.metadata
  if (isRecord(wallaceMeta)) {
    const totals = wallaceMeta.totals
    if (isRecord(totals)) {
      const packetTotal = readNumber(totals.packetTotal)
      if (packetTotal !== null) return packetTotal
    }
  }

  const log = await prisma.activityLog.findFirst({
    where: { workOrderId, action: 'QB_SYNC_SUCCESS' },
    orderBy: { createdAt: 'desc' },
    select: { metadata: true },
  })

  const meta = log?.metadata
  if (!isRecord(meta)) return null

  // Preferred: totals derived from Wallace packet (source of truth).
  const totals = meta.totals
  if (isRecord(totals)) {
    const packetTotal = readNumber(totals.packetTotal)
    if (packetTotal !== null) return packetTotal

    const qbTotal = readNumber(totals.qbTotal)
    if (qbTotal !== null) return qbTotal
  }

  // Back-compat: older QB_SYNC_SUCCESS logs only stored qbPayload.
  const payloadTotal = sumQbPayloadTotal(meta.qbPayload)
  if (payloadTotal !== null) return payloadTotal

  return null
}

async function getWallacePaymentStatus(workOrderId: string): Promise<{ paid: boolean; updatedAt: Date | null }> {
  const log = await prisma.activityLog.findFirst({
    where: { workOrderId, action: 'WALLACE_PAYMENT_STATUS' },
    orderBy: { createdAt: 'desc' },
    select: { metadata: true, createdAt: true },
  })

  const meta = log?.metadata
  const paid = isRecord(meta) ? readBoolean(meta.paid) : null
  return { paid: paid ?? false, updatedAt: log?.createdAt ?? null }
}

export async function GET() {
  const workOrders = await prisma.workOrder.findMany({
    where: {
      OR: [
        { status: 'INVOICED' },
        { qbSyncStatus: { in: ['PENDING', 'INVOICE_APPROVED', 'INVOICED', 'SYNCED'] } },
      ],
    },
    include: { intakeRequest: true },
    orderBy: { updatedAt: 'desc' },
  })

  const invoices = await Promise.all(
    workOrders.map(async (wo) => {
      const cls = classifyInvoice(wo)
      const totalBill = await getLastQbTotals(wo.id)
      const payment = await getWallacePaymentStatus(wo.id)

      // Wallace is the source of truth for whether the bill is paid.
      const paid = payment.paid
      const bucket = paid ? ('PAID' as const) : cls.bucket

      return {
        workOrderId: wo.id,
        invoiceId: wo.qbInvoiceId,
        customerName: wo.intakeRequest.customerName,
        email: wo.intakeRequest.email,
        location: wo.intakeRequest.location,
        status: wo.status,
        qbSyncStatus: wo.qbSyncStatus,
        bucket,
        ageDays: cls.ageDays,
        updatedAt: wo.updatedAt,
        totalBill,
        wallacePaid: paid,
        wallacePaymentUpdatedAt: payment.updatedAt,
      }
    })
  )

  const summary = {
    paid: invoices.filter((i) => i.bucket === 'PAID').length,
    waiting: invoices.filter((i) => i.bucket === 'WAITING').length,
    delinquent: invoices.filter((i) => i.bucket === 'DELINQUENT').length,
    total: invoices.length,
  }

  return NextResponse.json({ ok: true, summary, invoices })
}
