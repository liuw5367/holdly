import type { AmountValue } from './amount'
import type { PlanMode } from '~/db/queries/plans.types'
import { addAmounts, subtractAmounts, sumAmounts } from './amount'

interface PlanRecordAmountItem {
  amount: AmountValue
  itemType: string
}

export function calculatePlanRecordAmounts(
  previousTotal: AmountValue,
  planMode: PlanMode,
  items: PlanRecordAmountItem[],
) {
  const monthIncome = sumAmounts(items.filter(item => item.itemType === 'income').map(item => item.amount))
  const monthExpense = sumAmounts(items.filter(item => item.itemType === 'expense').map(item => item.amount))
  const monthNet = subtractAmounts(monthIncome, monthExpense)
  const totalValue = planMode === 'snapshot'
    ? monthNet
    : addAmounts(previousTotal, monthNet)
  const netIncome = planMode === 'snapshot'
    ? subtractAmounts(totalValue, previousTotal)
    : monthNet

  return { monthIncome, monthExpense, netIncome, totalValue }
}
