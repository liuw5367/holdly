import currency from 'currency.js'
import { differenceInCalendarMonths, differenceInDays } from 'date-fns'

const RATE_OPTIONS = { precision: 8 }

/**
 * 买断型资产当日持有成本（动态递减）
 * dailyCost = P_b / n，n = D - D_b + 1（购买日当天 n=1）
 */
export function calcOneTimeDailyCost(purchasePrice: number, purchaseDate: string): number {
  const n = Math.max(1, differenceInDays(new Date(), new Date(purchaseDate)) + 1)
  return currency(purchasePrice, RATE_OPTIONS).divide(n).value
}

export function calcSoldOneTimeDailyCost(purchasePrice: number, tradeInPrice: number, holdingDays: number): number {
  return currency(purchasePrice, RATE_OPTIONS)
    .subtract(tradeInPrice)
    .divide(Math.max(1, holdingDays))
    .value
}

/**
 * 订阅型资产每日成本
 * monthly → P_m / 30，quarterly → P_m / 91，yearly → P_m / 365
 */
export function calcSubscriptionDailyCost(
  price: number,
  cycle: 'monthly' | 'quarterly' | 'yearly',
): number {
  const cycleDays = { monthly: 30, quarterly: 91, yearly: 365 }
  return currency(price, RATE_OPTIONS).divide(cycleDays[cycle]).value
}

/**
 * 订阅在区间 [rangeStart, rangeEnd] 内的有效天数
 * D_s ≤ D ≤ min(B, D_e-1)，D_e 为 null 时取 B
 */
export function activeDaysInRange(
  rangeStart: Date,
  rangeEnd: Date,
  subStartDate: string,
  subEndDate: string | null,
): number {
  const start = Math.max(rangeStart.getTime(), new Date(subStartDate).getTime())
  const endDateExclusive = subEndDate
    ? new Date(subEndDate).getTime() - 86400000
    : rangeEnd.getTime()
  const end = Math.min(rangeEnd.getTime(), endDateExclusive)
  if (end < start)
    return 0
  return Math.floor((end - start) / 86400000) + 1
}

/**
 * 买断持有中资产在区间 [A, B] 的持有成本
 * 调和级数逐项求和：P_b × Σ(1/n)，n ∈ [max(n_start, 1), n_end]
 * n_start = A - D_b + 1，n_end = B - D_b + 1
 */
export function calcOneTimeCostRange(
  purchasePrice: number,
  purchaseDate: string,
  rangeStart: Date,
  rangeEnd: Date,
): number {
  const nStart = differenceInDays(rangeStart, new Date(purchaseDate)) + 1
  const nEnd = differenceInDays(rangeEnd, new Date(purchaseDate)) + 1
  if (nEnd < 1 || nStart > nEnd)
    return 0
  const s = Math.max(1, nStart)
  let harmonic = 0
  for (let n = s; n <= nEnd; n++)
    harmonic += 1 / n
  return currency(purchasePrice, RATE_OPTIONS).multiply(harmonic).value
}

/**
 * 买断已卖出资产在区间 [A, B] 的持有成本
 * 公式同上，但区间限制在 [D_b, D_r-1] 的交集内
 */
export function calcSoldOneTimeCostRange(
  purchasePrice: number,
  purchaseDate: string,
  tradeInPrice: number,
  tradeInDate: string,
  rangeStart: Date,
  rangeEnd: Date,
): number {
  const soldEnd = new Date(tradeInDate).getTime() - 86400000
  const effStart = Math.max(rangeStart.getTime(), new Date(purchaseDate).getTime())
  const effEnd = Math.min(rangeEnd.getTime(), soldEnd)
  if (effEnd < effStart)
    return 0
  const nStart = differenceInDays(new Date(effStart), new Date(purchaseDate)) + 1
  const nEnd = differenceInDays(new Date(effEnd), new Date(purchaseDate)) + 1
  if (nEnd < 1)
    return 0
  const s = Math.max(1, nStart)
  let harmonic = 0
  for (let n = s; n <= nEnd; n++)
    harmonic += 1 / n
  return currency(purchasePrice, RATE_OPTIONS).subtract(tradeInPrice).multiply(harmonic).value
}

/**
 * 某月内订阅的续费次数（0 或 1）
 * 续费日 = D_s + k × cycleMonths，判断是否有续费日落在 [monthStart, monthEnd]
 */
export function countSubPaymentsInMonth(
  monthStart: Date,
  monthEnd: Date,
  subStartDate: string,
  cycle: 'monthly' | 'quarterly' | 'yearly',
): number {
  const cycleMonths = { monthly: 1, quarterly: 3, yearly: 12 }
  const start = new Date(subStartDate)
  if (start > monthEnd)
    return 0
  const monthsToStart = differenceInCalendarMonths(monthStart, start)
  const c = cycleMonths[cycle]
  const k = Math.max(0, Math.ceil(monthsToStart / c))
  const renewalDate = new Date(start)
  renewalDate.setMonth(renewalDate.getMonth() + k * c)
  return renewalDate >= monthStart && renewalDate <= monthEnd ? 1 : 0
}

/**
 * 订阅在区间 [rangeStart, rangeEnd] 的持有成本
 * (P_m / 30) × activeDays
 */
export function calcSubscriptionCostRange(
  price: number,
  subStartDate: string,
  subEndDate: string | null,
  rangeStart: Date,
  rangeEnd: Date,
): number {
  const days = activeDaysInRange(rangeStart, rangeEnd, subStartDate, subEndDate)
  return currency(price, RATE_OPTIONS).divide(30).multiply(days).value
}
