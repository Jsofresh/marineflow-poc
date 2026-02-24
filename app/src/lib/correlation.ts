import crypto from 'crypto'

export function getCorrelationId(req: Request) {
  return req.headers.get('x-correlation-id')?.trim() || crypto.randomUUID()
}

export function shortHash(value: string) {
  return crypto.createHash('sha256').update(value).digest('hex')
}

export function jsonHash(value: unknown) {
  return shortHash(JSON.stringify(value))
}
