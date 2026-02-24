import { test, expect } from '@playwright/test'

test('money path: intake -> work order -> bucket update -> reminder', async ({ request, baseURL }) => {
  const intakeRes = await request.post(`${baseURL}/api/intake`, {
    data: {
      customerName: `Smoke Customer ${Date.now()}`,
      email: 'smoke@example.com',
      phone: '555-0100',
      vesselName: 'Test Vessel',
      serviceRequest: 'Generator troubleshooting',
      location: 'Dock B',
    },
  })
  expect(intakeRes.ok()).toBeTruthy()
  const intakeData = await intakeRes.json()
  expect(intakeData?.ok).toBe(true)

  const workOrderRes = await request.post(`${baseURL}/api/work-orders`, {
    data: { intakeRequestId: intakeData.intake.id },
  })
  expect(workOrderRes.ok()).toBeTruthy()
  const workOrderData = await workOrderRes.json()
  const workOrderId = workOrderData.workOrder.id

  const bucketRes = await request.patch(`${baseURL}/api/quickbooks/invoices/${workOrderId}/bucket`, {
    data: { bucket: 'DELINQUENT' },
  })
  expect(bucketRes.ok()).toBeTruthy()

  const remindRes = await request.post(`${baseURL}/api/quickbooks/invoices/${workOrderId}/remind`)
  expect(remindRes.ok()).toBeTruthy()
  const remindData = await remindRes.json()
  expect(remindData?.ok).toBe(true)
})
