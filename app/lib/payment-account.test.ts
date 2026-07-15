import { describe, expect, it } from 'vitest'
import { clampBillingDay, creditCardSchema, getNextCardDates } from './payment-account.schema'

const validCard = {
  paymentTypeId: 'type-1',
  name: 'Visa 白金卡',
  bankName: '招商银行',
  lastFour: '6821',
  notes: '',
  statementDay: 31,
  repaymentRule: 'fixed_day' as const,
  repaymentDay: 25,
  creditLimit: '50000',
  currencyCode: 'cny',
}

describe('信用卡资料', () => {
  it('规范化币种并接受安全的四位尾号', () => {
    const result = creditCardSchema.parse(validCard)
    expect(result.currencyCode).toBe('CNY')
    expect(result.lastFour).toBe('6821')
  })

  it('拒绝完整卡号、无效日期和负额度', () => {
    expect(creditCardSchema.safeParse({ ...validCard, lastFour: '6225888866666821' }).success).toBe(false)
    expect(creditCardSchema.safeParse({ ...validCard, statementDay: 32 }).success).toBe(false)
    expect(creditCardSchema.safeParse({ ...validCard, creditLimit: '-1' }).success).toBe(false)
  })

  it('将短月份的 31 日回退到月末', () => {
    expect(clampBillingDay(2026, 1, 31).getDate()).toBe(28)
    expect(getNextCardDates({ today: new Date(2026, 1, 20), statementDay: 31, repaymentRule: 'days_after_statement', repaymentDaysAfterStatement: 5 })).toEqual({
      statementDate: '2026-02-28',
      repaymentDate: '2026-03-05',
    })
  })
})
