import currency from 'currency.js'

interface GroupMember {
  userId: string
  displayName: string
  avatarEmoji: string
}

interface GroupItem {
  memberId: string
  itemType: 'income' | 'expense'
  amount: string | number
}

export interface PlanMemberGroup<T extends GroupItem> {
  member: GroupMember
  isActiveMember: boolean
  incomeItems: T[]
  expenseItems: T[]
  totalIncome: number
  totalExpense: number
  netIncome: number
}

export function buildPlanMemberGroups<T extends GroupItem>(
  members: GroupMember[],
  items: T[],
  currentUserId: string,
  includeEmpty: boolean,
): PlanMemberGroup<T>[] {
  const memberMap = new Map(members.map(member => [member.userId, member]))
  const orderedMemberIds = [
    ...members.map(member => member.userId === currentUserId ? [0, member.userId] as const : [1, member.userId] as const)
      .sort((left, right) => left[0] - right[0])
      .map(([, userId]) => userId),
    ...items.map(item => item.memberId).filter(memberId => !memberMap.has(memberId)),
  ]

  return [...new Set(orderedMemberIds)].flatMap((memberId) => {
    const memberItems = items.filter(item => item.memberId === memberId)
    if (!includeEmpty && memberItems.length === 0)
      return []

    const incomeItems = memberItems.filter(item => item.itemType === 'income')
    const expenseItems = memberItems.filter(item => item.itemType === 'expense')
    const totalIncome = incomeItems.reduce((sum, item) => currency(sum).add(item.amount || 0).value, 0)
    const totalExpense = expenseItems.reduce((sum, item) => currency(sum).add(item.amount || 0).value, 0)

    return [{
      member: memberMap.get(memberId) ?? {
        userId: memberId,
        displayName: '已退出成员',
        avatarEmoji: '',
      },
      isActiveMember: memberMap.has(memberId),
      incomeItems,
      expenseItems,
      totalIncome,
      totalExpense,
      netIncome: currency(totalIncome).subtract(totalExpense).value,
    }]
  })
}
