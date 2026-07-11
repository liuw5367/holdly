import currency from 'currency.js'

interface TradeInValidationInput {
  purchaseDate: string
  tradeInDate: string
  listPrice: string
  tradeInPrice: string
  today: string
}

export type TradeInValidationResult
  = | { ok: true, actualCost: string }
    | { ok: false, error: string }

const MONEY_PATTERN = /^\d{1,10}(?:\.\d{1,2})?$/

export function validateTradeIn(input: TradeInValidationInput): TradeInValidationResult {
  if (!MONEY_PATTERN.test(input.listPrice) || !MONEY_PATTERN.test(input.tradeInPrice))
    return { ok: false, error: '金额格式不正确' }
  if (input.tradeInDate < input.purchaseDate)
    return { ok: false, error: '换新日期不能早于购买日期' }
  if (input.tradeInDate > input.today)
    return { ok: false, error: '换新日期不能晚于今天' }

  const actualCost = currency(input.listPrice).subtract(input.tradeInPrice)
  if (actualCost.value < 0)
    return { ok: false, error: '回收价不能高于新设备标价' }

  return { ok: true, actualCost: actualCost.format({ symbol: '', separator: '' }) }
}
