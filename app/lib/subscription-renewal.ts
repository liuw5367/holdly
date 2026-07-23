import currency from 'currency.js'
import { addMonths, addYears, format, isAfter, subDays } from 'date-fns'

export type BillingCycle = 'monthly' | 'quarterly' | 'yearly'

export function advanceRenewalDate(startDate: string, cycle: BillingCycle): string {
  const base = new Date(`${startDate}T00:00:00`)
  const next = cycle === 'monthly'
    ? addMonths(base, 1)
    : cycle === 'quarterly'
      ? addMonths(base, 3)
      : addYears(base, 1)
  return format(next, 'yyyy-MM-dd')
}

export function getInitialRenewalDate(startDate: string, cycle: BillingCycle, today = format(new Date(), 'yyyy-MM-dd')): string {
  let next = new Date(`${startDate}T00:00:00`)
  const todayDate = new Date(`${today}T00:00:00`)
  do {
    next = new Date(`${advanceRenewalDate(format(next, 'yyyy-MM-dd'), cycle)}T00:00:00`)
  } while (!isAfter(next, todayDate))
  return format(next, 'yyyy-MM-dd')
}

export function getRenewalPeriodEnd(startDate: string, cycle: BillingCycle): string {
  return format(subDays(new Date(`${advanceRenewalDate(startDate, cycle)}T00:00:00`), 1), 'yyyy-MM-dd')
}

export function toMonthlySubscriptionCost(price: string | number, cycle: BillingCycle): number {
  if (cycle === 'monthly')
    return currency(price).value
  if (cycle === 'quarterly')
    return currency(price).divide(3).value
  return currency(price).divide(12).value
}

export function toYearlySubscriptionCost(price: string | number, cycle: BillingCycle): number {
  if (cycle === 'monthly')
    return currency(price).multiply(12).value
  if (cycle === 'quarterly')
    return currency(price).multiply(4).value
  return currency(price).value
}

export function getRenewalWindow(date: string | null, today: string): 'overdue' | 'seven_days' | 'thirty_days' | 'later' | 'none' {
  if (!date)
    return 'none'
  const days = Math.round((new Date(`${date}T00:00:00`).getTime() - new Date(`${today}T00:00:00`).getTime()) / 86400000)
  if (days < 0)
    return 'overdue'
  if (days <= 7)
    return 'seven_days'
  if (days <= 30)
    return 'thirty_days'
  return 'later'
}
