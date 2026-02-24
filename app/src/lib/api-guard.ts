import { NextResponse } from 'next/server'
import { ZodType } from 'zod'

const requestWindow = new Map<string, number[]>()

function getClientId(req: Request) {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'local'
  )
}

export function rateLimit(req: Request, key: string, limit = 60, windowMs = 60_000) {
  const client = getClientId(req)
  const bucketKey = `${key}:${client}`
  const now = Date.now()
  const previous = requestWindow.get(bucketKey) ?? []
  const kept = previous.filter((t) => now - t < windowMs)
  kept.push(now)
  requestWindow.set(bucketKey, kept)
  return kept.length <= limit
}

export function requireAdminToken(req: Request) {
  const configured = process.env.INTERNAL_ADMIN_TOKEN
  if (!configured) return true
  const provided = req.headers.get('x-internal-admin-token')
  return provided === configured
}

export async function parseJson<T>(req: Request, schema: ZodType<T>) {
  const body = await req.json().catch(() => ({}))
  return schema.safeParse(body)
}

export function apiError(error: string, status = 400, correlationId?: string) {
  return NextResponse.json({ ok: false, error, correlationId }, { status })
}
