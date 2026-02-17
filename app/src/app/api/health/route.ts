import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`
    return NextResponse.json({ ok: true, service: 'marineflow', db: 'ok', ts: new Date().toISOString() })
  } catch {
    return NextResponse.json({ ok: false, service: 'marineflow', db: 'error', ts: new Date().toISOString() }, { status: 503 })
  }
}
