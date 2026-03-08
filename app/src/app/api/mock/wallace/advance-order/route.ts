/**
 * POST /api/mock/wallace/advance-order
 *
 * Demo override: force-advances a single work order all the way to
 * "In Wallace · Ready for QuickBooks" in one call.
 *
 * Steps (mirror of simulate-workday for a single order):
 *   1. Mark wallaceEntered = true + assign a wallaceExternalId
 *   2. Set status = COMPLETE, wallaceSyncStatus = CONFIRMED
 *   3. Auto-create Wallace invoice (idempotent)
 *
 * No auth required — this is a demo/mock endpoint only.
 */

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'
import { buildQbInvoicePayload } from '@/lib/qb-map'
import { createWallaceInvoiceFromQboPayload, listWallaceInvoices } from '@/lib/mock-wallace-invoices'

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const workOrderId = body?.workOrderId ? String(body.workOrderId) : null

    if (!workOrderId) {
      return NextResponse.json({ ok: false, error: 'workOrderId required' }, { status: 400 })
    }

    const wo = await prisma.workOrder.findUnique({
      where: { id: workOrderId },
      include: { intakeRequest: true },
    })

    if (!wo) {
      return NextResponse.json({ ok: false, error: 'Work order not found' }, { status: 404 })
    }

    // Already in QuickBooks — nothing to advance
    if (wo.qbInvoiceId) {
      return NextResponse.json({ ok: false, error: 'Already exported to QuickBooks' }, { status: 409 })
    }

    const now = new Date()
    const wallaceExternalId = wo.wallaceExternalId ?? `WAL-${wo.id.slice(-6).toUpperCase()}`

    // Steps 1 + 2: mark entered + complete in a single update
    const updated = await prisma.workOrder.update({
      where: { id: workOrderId },
      data: {
        wallaceEntered: true,
        wallaceEnteredAt: wo.wallaceEnteredAt ?? now,
        wallaceExternalId,
        wallaceSyncStatus: 'CONFIRMED',
        status: 'COMPLETE',
        completedAt: wo.completedAt ?? now,
      },
    })

    await logAudit({
      entityType: 'WORK_ORDER',
      action: 'WALLACE_DEMO_ADVANCE',
      message: `Demo override: force-advanced to Wallace COMPLETE (${wallaceExternalId})`,
      workOrderId: updated.id,
      intakeRequestId: updated.intakeRequestId,
      metadata: { wallaceExternalId, simulated: true, demoOverride: true },
    })

    // Step 3: auto-create Wallace invoice if missing (idempotent)
    const existingInvoices = listWallaceInvoices(workOrderId)
    let invoiceCreated = false
    if (existingInvoices.length === 0) {
      const qbPayload = buildQbInvoicePayload(wo, wo.intakeRequest)
      createWallaceInvoiceFromQboPayload({
        marineflowWorkOrderId: updated.id,
        wallaceWorkOrderId: wallaceExternalId,
        customerName: wo.intakeRequest.customerName,
        vesselName: wo.intakeRequest.vesselName,
        location: wo.intakeRequest.location,
        qbPayload,
      })
      invoiceCreated = true

      await logAudit({
        entityType: 'WORK_ORDER',
        action: 'WALLACE_PACKET_SNAPSHOT',
        message: 'Wallace demo override auto-created invoice — ready for QuickBooks export',
        workOrderId: updated.id,
        intakeRequestId: updated.intakeRequestId,
        metadata: { wallaceExternalId, simulated: true, demoOverride: true },
      })
    }

    return NextResponse.json({
      ok: true,
      workOrder: { id: updated.id, status: updated.status, wallaceExternalId },
      invoiceCreated,
    })
  } catch (err) {
    console.error('[advance-order]', err)
    return NextResponse.json({ ok: false, error: 'Advance failed' }, { status: 500 })
  }
}
