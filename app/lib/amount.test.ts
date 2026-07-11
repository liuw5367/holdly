import { describe, expect, it } from 'vitest'
import { addAmounts, divideAmount, multiplyAmount, subtractAmounts, sumAmounts } from './amount'

describe('amount helpers', () => {
  it('使用十进制精度累计金额', () => {
    expect(sumAmounts(['0.1', '0.2', 0.3])).toBe(0.6)
    expect(addAmounts('0.1', '0.2')).toBe(0.3)
  })

  it('精确执行金额减法和折算', () => {
    expect(subtractAmounts('1000.10', '200.20')).toBe(799.9)
    expect(divideAmount('100', 3)).toBe(33.33)
    expect(multiplyAmount('33.33', 3)).toBe(99.99)
  })
})
