import { describe, expect, it } from 'vitest'
import { calculatePlanRecordAmounts } from './plan-record-amounts'

describe('calculatePlanRecordAmounts', () => {
  it('按十进制精度计算累加模式金额', () => {
    expect(calculatePlanRecordAmounts('0.1', 'accumulate', [
      { itemType: 'income', amount: '0.2' },
      { itemType: 'income', amount: '0.1' },
      { itemType: 'expense', amount: '0.1' },
    ])).toEqual({
      monthIncome: 0.3,
      monthExpense: 0.1,
      netIncome: 0.2,
      totalValue: 0.3,
    })
  })

  it('按当前总额计算快照模式的净变化', () => {
    expect(calculatePlanRecordAmounts('0.1', 'snapshot', [
      { itemType: 'income', amount: '0.3' },
      { itemType: 'expense', amount: '0.1' },
    ])).toEqual({
      monthIncome: 0.3,
      monthExpense: 0.1,
      netIncome: 0.1,
      totalValue: 0.2,
    })
  })
})
