import { describe, expect, it } from 'vitest'
import { advanceRenewalDate, getRenewalWindow, toMonthlySubscriptionCost, toYearlySubscriptionCost } from './subscription-renewal'

describe('订阅续费规则', () => {
  it('每次只推进一个周期，即使日期已逾期', () => {
    expect(advanceRenewalDate('2024-01-15', 'monthly')).toBe('2024-02-15')
    expect(advanceRenewalDate('2024-01-15', 'quarterly')).toBe('2024-04-15')
    expect(advanceRenewalDate('2024-01-15', 'yearly')).toBe('2025-01-15')
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
