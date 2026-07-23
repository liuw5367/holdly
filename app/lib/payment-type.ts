export interface PaymentTypeLike {
  name: string
  isPreset: boolean | null
}

const PRESET_PAYMENT_TYPE_ORDER = new Map([
  ['信用卡', 0],
  ['借记卡', 1],
  ['微信支付', 2],
  ['支付宝', 3],
  ['现金', 4],
  ['Apple Pay', 98],
  ['其他', 99],
])

export function isCreditCardPaymentType(type: PaymentTypeLike): boolean {
  return type.isPreset === true && type.name === '信用卡'
}

export function normalizePaymentTypeName(name: string): string {
  return name.trim().toLocaleLowerCase()
}

export function sortPaymentTypes<T extends PaymentTypeLike>(types: T[]): T[] {
  return [...types].sort((a, b) => {
    const aIsPreset = a.isPreset === true
    const bIsPreset = b.isPreset === true
    if (aIsPreset !== bIsPreset)
      return aIsPreset ? -1 : 1

    if (aIsPreset && bIsPreset) {
      const aOrder = PRESET_PAYMENT_TYPE_ORDER.get(a.name) ?? 90
      const bOrder = PRESET_PAYMENT_TYPE_ORDER.get(b.name) ?? 90
      if (aOrder !== bOrder)
        return aOrder - bOrder
    }

    return a.name.localeCompare(b.name, 'zh-CN')
  })
}
