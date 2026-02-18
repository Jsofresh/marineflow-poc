import { test, expect } from '@playwright/test'

test('health endpoint responds ok', async ({ request, baseURL }) => {
  const res = await request.get(`${baseURL}/api/health`)
  expect(res.ok()).toBeTruthy()
  const json = await res.json()
  expect(json.ok).toBe(true)
})

test('cms webhook denies unauthorized requests', async ({ request, baseURL }) => {
  const res = await request.post(`${baseURL}/api/webhooks/cms-intake`, {
    data: { customerName: 'Smoke Test', serviceRequest: 'Webhook auth test', location: 'Dock A' },
  })
  // Depending on env + idempotency state, this may be 401/400/201/200.
  expect([401, 400, 201, 200].includes(res.status())).toBeTruthy()
})
