import { describe, expect, it } from 'vitest'
import { subscriptionRenewalSchema } from './asset.schema'
import { advanceRenewalDate, getRenewalPeriodEnd, getRenewalWindow, toMonthlySubscriptionCost, toYearlySubscriptionCost } from './subscription-renewal'

describe('订阅续费规则', () => {
  it('每次只推进一个周期，即使日期已逾期', () => {
    expect(advanceRenewalDate('2024-01-15', 'monthly')).toBe('2024-02-15')
    expect(advanceRenewalDate('2024-01-15', 'quarterly')).toBe('2024-04-15')
    expect(advanceRenewalDate('2024-01-15', 'yearly')).toBe('2025-01-15')
  })

  it('周期结束日是下次续费日前一天', () => {
    expect(getRenewalPeriodEnd('2026-05-15', 'monthly')).toBe('2026-06-14')
    expect(getRenewalPeriodEnd('2026-01-01', 'quarterly')).toBe('2026-03-31')
  })

  it('仅接受有限且大于零的续费金额', () => {
    expect(subscriptionRenewalSchema.safeParse({ price: '0', updateExpectedPrice: true }).success).toBe(false)
    expect(subscriptionRenewalSchema.safeParse({ price: 'Infinity', updateExpectedPrice: true }).success).toBe(false)
    expect(subscriptionRenewalSchema.safeParse({ price: '8.88', notes: '优惠', updateExpectedPrice: true }).success).toBe(true)
  })

  it('使用精确金额归一化月度和年度成本', () => {
    expect(toMonthlySubscriptionCost('99.99', 'quarterly')).toBe(33.33)
    expect(toYearlySubscriptionCost('9.99', 'monthly')).toBe(119.88)
  })

  it('正确划分续费时间窗口', () => {
    expect(getRenewalWindow('2026-07-14', '2026-07-15')).toBe('overdue')
    expect(getRenewalWindow('2026-07-22', '2026-07-15')).toBe('seven_days')
    expect(getRenewalWindow('2026-08-10', '2026-07-15')).toBe('thirty_days')
    expect(getRenewalWindow(null, '2026-07-15')).toBe('none')
  })
})
