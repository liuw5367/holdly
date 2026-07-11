import { describe, expect, it } from 'vitest'
import { validateTradeIn } from './trade-in'

describe('validateTradeIn', () => {
  const base = {
    purchaseDate: '2026-01-01',
    tradeInDate: '2026-06-01',
    listPrice: '1000',
    tradeInPrice: '300',
    today: '2026-07-11',
  }

  it('返回服务端计算的实际支出', () => {
    expect(validateTradeIn(base)).toEqual({ ok: true, actualCost: '700.00' })
  })

  it('拒绝早于购买日或晚于今天的换新日期', () => {
    expect(validateTradeIn({ ...base, tradeInDate: '2025-12-31' }).ok).toBe(false)
    expect(validateTradeIn({ ...base, tradeInDate: '2026-07-12' }).ok).toBe(false)
  })

  it('拒绝回收价高于新设备标价', () => {
    expect(validateTradeIn({ ...base, tradeInPrice: '1000.01' }).ok).toBe(false)
  })
})
