import type { assets } from '~/db/schema'
import { describe, expect, it } from 'vitest'
import { calcDueDate, isReminderProfileEnabled } from './reminder.server'

function makeAsset(overrides: Partial<typeof assets.$inferSelect>): typeof assets.$inferSelect {
  return {
    id: 'test',
    userId: 'test',
    name: 'Test',
    emoji: '📦',
    categoryId: null,
    assetType: 'subscription',
    purchasePrice: null,
    currentValue: null,
    purchaseDate: null,
    purchaseReceipt: null,
    subscriptionPrice: null,
    billingCycle: null,
    nextRenewalDate: null,
    subscriptionStartDate: null,
    subscriptionStatus: 'active',
    subscriptionStoppedAt: null,
    paymentTypeId: null,
    paymentAccountId: null,
    notes: null,
    reminderEnabled: false,
    reminderSubscriptionDaysOverride: null,
    reminderWarrantyDaysOverride: null,
    deletedAt: null,
    tradedInAt: null,
    tradeInPrice: null,
    tradedFromAssetId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

describe('calcDueDate', () => {
  it('订阅有 nextRenewalDate 且未过期时返回它', () => {
    const asset = makeAsset({
      billingCycle: 'monthly',
      subscriptionStartDate: '2026-01-01',
      nextRenewalDate: '2026-06-15',
    })
    expect(calcDueDate(asset, new Date('2026-06-01T00:00:00'))).toBe('2026-06-15')
  })

  it('nextRenewalDate 已过期时忽略，重新推算', () => {
    const asset = makeAsset({
      billingCycle: 'monthly',
      subscriptionStartDate: '2026-01-01',
      nextRenewalDate: '2020-01-01',
    })
    const result = calcDueDate(asset, new Date('2026-06-01T00:00:00'))
    expect(result).not.toBe('2020-01-01')
    expect(result).toBeTruthy()
  })

  it('无 billingCycle 返回 null', () => {
    const asset = makeAsset({
      billingCycle: null,
      subscriptionStartDate: '2026-01-01',
    })
    expect(calcDueDate(asset, new Date('2026-06-01T00:00:00'))).toBeNull()
  })

  it('无 startDate 返回 null', () => {
    const asset = makeAsset({
      billingCycle: 'monthly',
      subscriptionStartDate: null,
      purchaseDate: null,
    })
    expect(calcDueDate(asset, new Date('2026-06-01T00:00:00'))).toBeNull()
  })

  it('月付推算下一个续费日', () => {
    const start = new Date()
    start.setMonth(start.getMonth() - 1)
    const startStr = start.toISOString().slice(0, 10)
    const asset = makeAsset({
      billingCycle: 'monthly',
      subscriptionStartDate: startStr,
    })
    const result = calcDueDate(asset, new Date())
    expect(result).toBeTruthy()
    const resultDate = new Date(`${result}T00:00:00`)
    expect(resultDate.getTime()).toBeGreaterThan(start.getTime())
  })
})

describe('isReminderProfileEnabled', () => {
  it('全局提醒关闭时拒绝处理提醒', () => {
    expect(isReminderProfileEnabled({ reminderEnabled: false, email: 'a@example.com' })).toBe(false)
  })

  it('仅在全局开启且存在邮箱时处理提醒', () => {
    expect(isReminderProfileEnabled({ reminderEnabled: true, email: 'a@example.com' })).toBe(true)
    expect(isReminderProfileEnabled({ reminderEnabled: true, email: null })).toBe(false)
  })
})
