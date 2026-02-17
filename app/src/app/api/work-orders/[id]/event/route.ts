import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'

type EventName = 'PARTS_ARRIVED' | 'TECH_COMPLETE'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json().catch(() => ({}))
    const event = String(body?.event ?? '').toUpperCase() as EventName

    const wo = await prisma.workOrder.findUnique({ where: { id } })
    if (!wo) return NextResponse.json({ ok: false, error: 'Work order not found' }, { status: 404 })

    if (event === 'PARTS_ARRIVED') {
      if (!['PARTS_ORDERED', 'APPROVED'].includes(wo.status)) {
        return NextResponse.json({ ok: false, error: 'Parts arrived event not valid for current status' }, { status: 409 })
      }

      const updated = await prisma.workOrder.update({
        where: { id },
        data: { status: 'IN_PROGRESS' },
      })

      await logAudit({
        entityType: 'WORK_ORDER',
        action: 'EVENT_PARTS_ARRIVED',
        message: 'Parts arrived; auto-moved to IN_PROGRESS',
        workOrderId: updated.id,
        intakeRequestId: updated.intakeRequestId,
        metadata: { event },
      })

      return NextResponse.json({ ok: true, workOrder: updated })
    }

    if (event === 'TECH_COMPLETE') {
      if (wo.status !== 'IN_PROGRESS') {
        return NextResponse.json({ ok: false, error: 'Tech complete event not valid for current status' }, { status: 409 })
      }

      const updated = await prisma.workOrder.update({
        where: { id },
        data: { status: 'COMPLETE', completedAt: new Date() },
      })

      await logAudit({
        entityType: 'WORK_ORDER',
        action: 'EVENT_TECH_COMPLETE',
        message: 'Technician marked complete',
        workOrderId: updated.id,
        intakeRequestId: updated.intakeRequestId,
        metadata: { event },
      })

      return NextResponse.json({ ok: true, workOrder: updated })
    }

    return NextResponse.json({ ok: false, error: 'Unknown event' }, { status: 400 })
  } catch {
    return NextResponse.json({ ok: false, error: 'Failed to process event' }, { status: 500 })
  }
}
