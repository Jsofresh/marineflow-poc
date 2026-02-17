import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const timeline = await prisma.activityLog.findMany({
      where: { workOrderId: id },
      orderBy: { createdAt: 'asc' },
    })

    return NextResponse.json({ ok: true, timeline })
  } catch {
    return NextResponse.json({ ok: false, error: 'Timeline fetch failed' }, { status: 400 })
  }
}
