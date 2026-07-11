import { describe, expect, it } from 'vitest'
import { formatExpiryCountdown } from './expiry'

describe('formatExpiryCountdown', () => {
  it('formats an expiry date on the current day as today', () => {
    expect(formatExpiryCountdown(0)).toBe('今天')
  })

  it('formats a future expiry date as days remaining', () => {
    expect(formatExpiryCountdown(3)).toBe('3 天后')
  })
})
