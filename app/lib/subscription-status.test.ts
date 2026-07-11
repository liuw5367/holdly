import { describe, expect, it } from 'vitest'
import { isSubscriptionActive } from './subscription-status'

describe('isSubscriptionActive', () => {
  it('未来取消日期前仍视为活跃', () => {
    expect(isSubscriptionActive({
      subscriptionStatus: 'cancelled',
      subscriptionStartDate: '2026-01-01',
      purchaseDate: null,
      subscriptionStoppedAt: '2026-08-01',
    }, '2026-07-11')).toBe(true)
  })

  it('取消日当天及之后不再活跃', () => {
    const subscription = {
      subscriptionStatus: 'cancelled',
      subscriptionStartDate: '2026-01-01',
      purchaseDate: null,
      subscriptionStoppedAt: '2026-07-11',
    }
    expect(isSubscriptionActive(subscription, '2026-07-11')).toBe(false)
    expect(isSubscriptionActive(subscription, '2026-07-12')).toBe(false)
  })

  it('未开始和自然过期的订阅不活跃', () => {
    expect(isSubscriptionActive({ subscriptionStatus: 'active', subscriptionStartDate: '2026-08-01', purchaseDate: null, subscriptionStoppedAt: null }, '2026-07-11')).toBe(false)
    expect(isSubscriptionActive({ subscriptionStatus: 'expired', subscriptionStartDate: '2026-01-01', purchaseDate: null, subscriptionStoppedAt: null }, '2026-07-11')).toBe(false)
  })
})
