import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { assertServerEnv } from '@/lib/env'

function isAllowed(req: Request) {
  const secret = process.env.INTERNAL_WORKER_SECRET
  if (!secret) return false
  const provided = req.headers.get('x-internal-worker-secret')
  return provided === secret
}

export async function GET(req: Request) {
  assertServerEnv()
  if (!isAllowed(req)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const rows = await prisma.eventOutbox.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
  })

  return NextResponse.json({ ok: true, events: rows })
}
