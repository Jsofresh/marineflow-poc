import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { assertServerEnv } from '@/lib/env'

function isAllowed(req: Request) {
  const secret = process.env.INTERNAL_WORKER_SECRET
  if (!secret) return false
  const provided = req.headers.get('x-internal-worker-secret')
  return provided === secret
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  assertServerEnv()
  if (!isAllowed(req)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  const updated = await prisma.eventOutbox.update({
    where: { id },
    data: {
      status: 'PENDING',
      nextAttemptAt: new Date(),
      lastError: null,
      processedAt: null,
    },
  })

  return NextResponse.json({ ok: true, event: updated })
}
