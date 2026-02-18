import { inngest } from './client'

export const cmsIntakeReceived = inngest.createFunction(
  { id: 'cms-intake-received' },
  { event: 'cms/intake.received' },
  async ({ event, step }) => {
    await step.run('log-webhook-receipt', async () => {
      console.log('[Inngest] cms/intake.received', {
        idempotencyKey: event.data.idempotencyKey,
        formType: event.data.formType,
      })
    })

    return { ok: true }
  }
)

export const functions = [cmsIntakeReceived]
