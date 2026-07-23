import { describe, expect, it } from 'vitest'
import { formatCurrencyGroups, getStatsModel } from './dashboard-view'

describe('统计总览视图', () => {
  it('默认展示买断统计，并从查询参数恢复订阅统计', () => {
    expect(getStatsModel(new URLSearchParams())).toBe('one_time')
    expect(getStatsModel(new URLSearchParams('model=subscription'))).toBe('subscription')
    expect(getStatsModel(new URLSearchParams('model=unknown'))).toBe('one_time')
  })

  it('按币种分别展示订阅预计费用', () => {
    expect(formatCurrencyGroups({ CNY: 128, USD: 12.5 })).toBe('¥128 · USD 13')
    expect(formatCurrencyGroups({})).toBe('—')
  })
})
