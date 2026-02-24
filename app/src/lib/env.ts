import { z } from 'zod'

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  CMS_WEBHOOK_SECRET: z.string().optional(),
  INTERNAL_WORKER_SECRET: z.string().optional(),
})

let validated = false

export function assertServerEnv() {
  if (validated) return

  const parsed = schema.safeParse(process.env)
  if (!parsed.success) {
    const message = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')
    throw new Error(`Invalid server env: ${message}`)
  }

  if (parsed.data.NODE_ENV === 'production' && !parsed.data.CMS_WEBHOOK_SECRET) {
    throw new Error('Invalid server env: CMS_WEBHOOK_SECRET is required in production')
  }

  validated = true
}
