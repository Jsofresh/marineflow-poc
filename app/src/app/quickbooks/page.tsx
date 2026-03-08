export const dynamic = 'force-dynamic'

import { prisma } from '@/lib/prisma'
import QuickBooksClient from './quickbooks-client'

async function getInvoiceData() {
  const workOrders = await prisma.workOrder.findMany({
    where: { status: 'INVOICED' },
    include: { intakeRequest: true },
    orderBy: { updatedAt: 'desc' },
  })

  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

  const invoices = workOrders.map((wo) => {
    const ageDays = Math.floor((now.getTime() - new Date(wo.updatedAt).getTime()) / (24 * 60 * 60 * 1000))
    
    let bucket: 'PAID' | 'WAITING' | 'DELINQUENT' = 'WAITING'
    if (wo.qbSyncStatus === 'DELINQUENT') {
      bucket = 'DELINQUENT'
    } else if (wo.qbSyncStatus === 'SYNCED' && ageDays < 7) {
      bucket = 'WAITING'
    } else if (wo.qbSyncStatus === 'SYNCED' && ageDays >= 7) {
      bucket = 'PAID'
    }

    return {
      workOrderId: wo.id,
      invoiceId: wo.qbInvoiceId,
      customerName: wo.intakeRequest.customerName,
      email: wo.intakeRequest.email,
      location: wo.intakeRequest.location,
      status: wo.status,
      qbSyncStatus: wo.qbSyncStatus,
      bucket,
      ageDays,
      updatedAt: wo.updatedAt.toISOString(),
      totalBill: null, // Would need QB API to get actual amount
      wallacePaid: false,
      wallacePaymentUpdatedAt: null,
    }
  })

  const summary = {
    paid: invoices.filter(i => i.bucket === 'PAID').length,
    waiting: invoices.filter(i => i.bucket === 'WAITING').length,
    delinquent: invoices.filter(i => i.bucket === 'DELINQUENT').length,
    total: invoices.length,
  }

  return { summary, invoices }
}

export default async function QuickBooksPage() {
  const { summary, invoices } = await getInvoiceData()
  return <QuickBooksClient initialData={{ summary, invoices }} />
}
