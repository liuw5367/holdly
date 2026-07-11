import currency from 'currency.js'

export type AmountValue = string | number | null | undefined

export function addAmounts(left: AmountValue, right: AmountValue) {
  return currency(left ?? 0).add(right ?? 0).value
}

export function subtractAmounts(left: AmountValue, right: AmountValue) {
  return currency(left ?? 0).subtract(right ?? 0).value
}

export function multiplyAmount(value: AmountValue, multiplier: number) {
  return currency(value ?? 0).multiply(multiplier).value
}

export function divideAmount(value: AmountValue, divisor: number) {
  return currency(value ?? 0).divide(divisor).value
}

export function sumAmounts(values: AmountValue[]) {
  return values.reduce<number>((total, value) => currency(total).add(value ?? 0).value, 0)
}
