import { describe, expect, it } from 'vitest'
import { isCreditCardPaymentType, normalizePaymentTypeName, sortPaymentTypes } from './payment-type'

describe('支付类型规则', () => {
  it('预置类型优先，自定义类型随后按名称排序', () => {
    const result = sortPaymentTypes([
      { id: 'custom-z', name: '企业账户', isPreset: false },
      { id: 'other', name: '其他', isPreset: true },
      { id: 'alipay', name: '支付宝', isPreset: true },
      { id: 'custom-a', name: '报销账户', isPreset: false },
      { id: 'legacy-custom', name: '旧账户', isPreset: null },
      { id: 'credit-card', name: '信用卡', isPreset: true },
      { id: 'apple-pay', name: 'Apple Pay', isPreset: true },
      { id: 'cash', name: '现金', isPreset: true },
    ])

    expect(result.map(type => type.id)).toEqual([
      'credit-card',
      'alipay',
      'cash',
      'apple-pay',
      'other',
      'custom-a',
      'legacy-custom',
      'custom-z',
    ])
  })

  it('apple pay 和其他位于预置类型最后', () => {
    const result = sortPaymentTypes([
      { name: 'Apple Pay', isPreset: true },
      { name: '借记卡', isPreset: true },
      { name: '其他', isPreset: true },
      { name: '微信支付', isPreset: true },
    ])

    expect(result.map(type => type.name)).toEqual(['借记卡', '微信支付', 'Apple Pay', '其他'])
  })

  it('只有固定预置信用卡类型启用信用卡资料', () => {
    expect(isCreditCardPaymentType({ name: '信用卡', isPreset: true })).toBe(true)
    expect(isCreditCardPaymentType({ name: '信用卡', isPreset: false })).toBe(false)
    expect(isCreditCardPaymentType({ name: '公司信用卡', isPreset: true })).toBe(false)
  })

  it('重名比较忽略首尾空格和英文大小写', () => {
    expect(normalizePaymentTypeName('  Apple Pay ')).toBe('apple pay')
  })
})
