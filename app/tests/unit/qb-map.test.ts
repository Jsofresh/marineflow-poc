import { describe, expect, it } from 'vitest'
import { buildQbInvoicePayload } from '@/lib/qb-map'

describe('buildQbInvoicePayload', () => {
  it('builds a valid payload with invoice lines and memo', () => {
    const payload = buildQbInvoicePayload(
      { id: 'cm1234567890', status: 'IN_PROGRESS', completedAt: null },
      {
        customerName: 'Test Customer',
        email: 'test@example.com',
        phone: '555-0100',
        vesselName: 'Blue Current',
        serviceRequest: 'Engine diagnostics and pump replacement',
        location: 'Salem',
      }
    )

    expect(payload.DocNumber).toContain('WO-')
    expect(payload.CustomerRef.name).toBe('Test Customer')
    expect(payload.Line.length).toBeGreaterThanOrEqual(2)
    expect(payload.BillEmail?.Address).toBe('test@example.com')
  })
})
