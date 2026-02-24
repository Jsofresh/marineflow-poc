import { describe, expect, it } from 'vitest'
import { computeOutboxBackoffMs, shouldDeadLetterOutbox } from '@/lib/outbox'

describe('outbox backoff + dead-letter policy', () => {
  it('uses linear backoff with a 15m cap', () => {
    expect(computeOutboxBackoffMs(1)).toBe(60_000)
    expect(computeOutboxBackoffMs(2)).toBe(120_000)
    expect(computeOutboxBackoffMs(10)).toBe(15 * 60_000)
  })

  it('treats attempts>=5 as dead-letter', () => {
    expect(shouldDeadLetterOutbox(0)).toBe(false)
    expect(shouldDeadLetterOutbox(4)).toBe(false)
    expect(shouldDeadLetterOutbox(5)).toBe(true)
    expect(shouldDeadLetterOutbox(99)).toBe(true)
  })
})
