import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

type Technician = {
  name: string
  clockIn: string
  clockOut?: string
  totalHours: number
  status: 'CLOCKED_IN' | 'CLOCKED_OUT'
}

function seededHours(seed: string, min = 0.5, max = 4.5) {
  const n = seed.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  const normalized = (n % 1000) / 1000
  return Number((min + normalized * (max - min)).toFixed(1))
}

export async function GET() {
  const workOrders = await prisma.workOrder.findMany({
    include: { intakeRequest: true },
    orderBy: { updatedAt: 'desc' },
    take: 12,
  })

  const technicians: Technician[] = [
    { name: 'Alex T.', clockIn: '07:02', totalHours: 7.8, status: 'CLOCKED_IN' },
    { name: 'Sam R.', clockIn: '07:18', totalHours: 7.4, status: 'CLOCKED_IN' },
    { name: 'Jordan M.', clockIn: '08:01', totalHours: 6.3, status: 'CLOCKED_IN' },
    { name: 'Chris P.', clockIn: '07:10', clockOut: '14:36', totalHours: 7.4, status: 'CLOCKED_OUT' },
  ]

  const wallaceJobs = workOrders.map((wo, i) => ({
    workOrderId: wo.id,
    wallaceJobCode: wo.wallaceExternalId || `WAL-${wo.id.slice(-5).toUpperCase()}`,
    customerName: wo.intakeRequest.customerName,
    jobTitle: wo.intakeRequest.serviceRequest,
    technician: technicians[i % technicians.length].name,
    wallaceHours: seededHours(wo.id),
    status: wo.status,
  }))

  const totalClockedHours = technicians.reduce((sum, t) => sum + t.totalHours, 0)
  const totalWallaceJobHours = wallaceJobs.reduce((sum, j) => sum + j.wallaceHours, 0)

  return NextResponse.json({
    ok: true,
    technicians,
    wallaceJobs,
    summary: {
      totalClockedHours: Number(totalClockedHours.toFixed(1)),
      totalWallaceJobHours: Number(totalWallaceJobHours.toFixed(1)),
      deltaHours: Number((totalClockedHours - totalWallaceJobHours).toFixed(1)),
    },
  })
}
