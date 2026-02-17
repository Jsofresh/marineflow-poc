import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

function unauthorized() {
  return new NextResponse('Auth required', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="MarineFlow Demo"',
    },
  })
}

export function middleware(req: NextRequest) {
  const user = process.env.BASIC_AUTH_USER
  const pass = process.env.BASIC_AUTH_PASS

  if (!user || !pass) return NextResponse.next()

  const auth = req.headers.get('authorization')
  if (!auth?.startsWith('Basic ')) return unauthorized()

  try {
    const decoded = atob(auth.slice(6))
    const [u, p] = decoded.split(':')
    if (u !== user || p !== pass) return unauthorized()
  } catch {
    return unauthorized()
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/board', '/board/:path*'],
}
