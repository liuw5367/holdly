import { beforeEach, describe, expect, it, vi } from 'vitest'
import { savePlan, savePlanRecordPatch } from './plans.write'

const { transaction, getActivePlanForUser } = vi.hoisted(() => ({
  transaction: vi.fn(),
  getActivePlanForUser: vi.fn(),
}))

vi.mock('~/db', () => ({ db: { transaction } }))
vi.mock('./plans.read', () => ({ getActivePlanForUser }))

const selectQueries: Array<{ for: ReturnType<typeof vi.fn> }> = []

function selectResult(rows: unknown[]) {
  const query = {
    from: vi.fn(),
    innerJoin: vi.fn(),
    where: vi.fn(),
    limit: vi.fn(),
    for: vi.fn(),
    then: (resolve: (value: unknown[]) => unknown) => Promise.resolve(resolve(rows)),
  }
  query.from.mockReturnValue(query)
  query.innerJoin.mockReturnValue(query)
  query.where.mockReturnValue(query)
  query.limit.mockReturnValue(query)
  query.for.mockReturnValue(query)
  selectQueries.push(query)
  return query
}

describe('plan member ownership', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    selectQueries.length = 0
  })

  it('新计划不能直接伪造其他成员', async () => {
    await expect(savePlan({
      userId: 'user-1',
      name: '家庭计划',
      emoji: '💰',
      planMode: 'accumulate',
      permission: 'own',
      startingValue: '0',
      members: [
        { userId: 'user-1', role: 'owner' },
        { userId: 'foreign-user', role: 'editor' },
      ],
      defaultItems: [],
    })).rejects.toThrow('请通过邀请链接添加成员')
    expect(transaction).not.toHaveBeenCalled()
  })

  it('编辑计划时先锁定计划行，再读取和移除成员', async () => {
    getActivePlanForUser.mockResolvedValue({ canManage: true })
    const updateWhere = vi.fn().mockResolvedValue(undefined)
    const updateSet = vi.fn().mockReturnValue({ where: updateWhere })
    const insertValues = vi.fn().mockResolvedValue(undefined)
    const tx = {
      select: vi.fn()
        .mockReturnValueOnce(selectResult([{ id: 'plan-1' }]))
        .mockReturnValueOnce(selectResult([{ userId: 'owner-1' }, { userId: 'removed-user' }])),
      update: vi.fn().mockReturnValue({ set: updateSet }),
      insert: vi.fn().mockReturnValue({ values: insertValues }),
    }
    transaction.mockImplementation(async callback => callback(tx))

    await savePlan({
      planId: 'plan-1',
      userId: 'owner-1',
      name: '家庭计划',
      emoji: '💰',
      planMode: 'accumulate',
      permission: 'own',
      startingValue: '0',
      members: [{ userId: 'owner-1', role: 'owner' }],
      defaultItems: [],
    })

    expect(selectQueries[0].for).toHaveBeenCalledWith('update')
    expect(selectQueries[0].for.mock.invocationCallOrder[0]).toBeLessThan(tx.update.mock.invocationCallOrder[0])
    const memberRemoval = updateSet.mock.calls[1][0]
    expect(memberRemoval.deletedAt).not.toBeInstanceOf(Date)
    expect(memberRemoval.deletedAt.queryChunks[0].value).toContain('clock_timestamp()')
    const replacementMember = insertValues.mock.calls[0][0]
    expect(replacementMember.createdAt.queryChunks[0].value).toContain('clock_timestamp()')
    expect(replacementMember.updatedAt.queryChunks[0].value).toContain('clock_timestamp()')
  })

  it('月度记录不能写入非计划成员名下', async () => {
    getActivePlanForUser.mockResolvedValue({
      canEditAllItems: true,
      plan: { mode: 'accumulate' },
    })
    transaction.mockImplementation(async callback => callback({
      select: vi.fn()
        .mockReturnValueOnce(selectResult([{ mode: 'accumulate', ownerId: 'user-1', permission: 'all' }]))
        .mockReturnValueOnce(selectResult([{ userId: 'user-1' }])),
    }))

    await expect(savePlanRecordPatch({
      planId: 'plan-1',
      userId: 'user-1',
      mode: 'accumulate',
      year: 2026,
      month: 9,
      addedItems: [{ memberId: 'foreign-user', itemType: 'income', name: '收入', amount: '1' }],
      updatedItems: [],
      deletedItems: [],
      memberNotes: [],
    })).rejects.toThrow('记录成员无效')
    expect(selectQueries).toHaveLength(2)
    expect(selectQueries[0].for).toHaveBeenCalledWith('update')
    expect(selectQueries[1].for).toHaveBeenCalledWith('update')
  })

  it('事务开始前已被移除的成员不能继续删除记录', async () => {
    getActivePlanForUser.mockResolvedValue({
      canEditAllItems: false,
      plan: { mode: 'accumulate' },
    })
    transaction.mockImplementation(async callback => callback({
      select: vi.fn().mockReturnValue(selectResult([])),
    }))

    await expect(savePlanRecordPatch({
      planId: 'plan-1',
      userId: 'removed-user',
      mode: 'accumulate',
      year: 2026,
      month: 9,
      addedItems: [],
      updatedItems: [],
      deletedItems: [{ id: 'item-1' }],
      memberNotes: [],
    })).rejects.toThrow('计划不存在或无访问权限')
  })
})
