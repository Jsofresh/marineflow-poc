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

  const invoices = workOrders.map((wo) => {
    const cls = classifyInvoice(wo)
    return {
      workOrderId: wo.id,
      invoiceId: wo.qbInvoiceId,
      customerName: wo.intakeRequest.customerName,
      email: wo.intakeRequest.email,
      location: wo.intakeRequest.location,
      status: wo.status,
      qbSyncStatus: wo.qbSyncStatus,
      bucket: cls.bucket,
      ageDays: cls.ageDays,
      updatedAt: wo.updatedAt,
    }
  })

  const summary = {
    paid: invoices.filter((i) => i.bucket === 'PAID').length,
    waiting: invoices.filter((i) => i.bucket === 'WAITING').length,
    delinquent: invoices.filter((i) => i.bucket === 'DELINQUENT').length,
    total: invoices.length,
  }

  return NextResponse.json({ ok: true, summary, invoices })
}
