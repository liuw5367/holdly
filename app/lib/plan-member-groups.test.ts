import { describe, expect, it } from 'vitest'
import { buildPlanMemberGroups } from './plan-member-groups'

const members = [
  { userId: 'a', displayName: '张三', avatarEmoji: '😀' },
  { userId: 'b', displayName: '李四', avatarEmoji: '🙂' },
]

describe('buildPlanMemberGroups', () => {
  it('当前用户优先并计算收入支出净额', () => {
    const groups = buildPlanMemberGroups(members, [
      { id: '1', memberId: 'a', itemType: 'income' as const, amount: '0.1' },
      { id: '2', memberId: 'a', itemType: 'income' as const, amount: '0.2' },
      { id: '3', memberId: 'a', itemType: 'expense' as const, amount: '0.1' },
      { id: '4', memberId: 'b', itemType: 'expense' as const, amount: '5' },
    ], 'b', true)

    expect(groups.map(group => group.member.userId)).toEqual(['b', 'a'])
    expect(groups[1]).toMatchObject({ totalIncome: 0.3, totalExpense: 0.1, netIncome: 0.2 })
  })

  it('历史退出成员排在当前成员之后', () => {
    const groups = buildPlanMemberGroups(members, [
      { id: '1', memberId: 'former', itemType: 'income' as const, amount: '10' },
    ], 'a', false)

    expect(groups.map(group => group.member.userId)).toEqual(['former'])
    expect(groups[0].member.displayName).toBe('已退出成员')
  })

  it('详情模式隐藏无子项成员，编辑模式保留', () => {
    expect(buildPlanMemberGroups(members, [], 'a', false)).toEqual([])
    expect(buildPlanMemberGroups(members, [], 'a', true)).toHaveLength(2)
  })
})
