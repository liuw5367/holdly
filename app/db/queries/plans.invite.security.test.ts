import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { plans } from '~/db/schema'
import { acceptInviteByToken, regenerateInviteLink, revokeInviteLink } from './plans.invite'

const { getActivePlanForUser, transaction } = vi.hoisted(() => ({
  getActivePlanForUser: vi.fn(),
  transaction: vi.fn(),
}))

vi.mock('~/db', () => ({ db: { transaction } }))
vi.mock('./plans.read', () => ({ getActivePlanForUser }))

const selectQueries: Array<{ for: ReturnType<typeof vi.fn> }> = []

function selectResult(rows: unknown[]) {
  const query = {
    from: vi.fn(),
    innerJoin: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
    limit: vi.fn(),
    for: vi.fn(),
    then: (resolve: (value: unknown[]) => unknown) => Promise.resolve(resolve(rows)),
  }
  query.from.mockReturnValue(query)
  query.innerJoin.mockReturnValue(query)
  query.where.mockReturnValue(query)
  query.orderBy.mockReturnValue(query)
  query.limit.mockReturnValue(query)
  query.for.mockReturnValue(query)
  selectQueries.push(query)
  return query
}

function updateResult() {
  const query = { set: vi.fn(), where: vi.fn().mockResolvedValue(undefined) }
  query.set.mockReturnValue(query)
  return query
}

function insertResult() {
  return { values: vi.fn().mockResolvedValue(undefined) }
}

function setupTransaction(selectRows: unknown[][]) {
  const tx = {
    select: vi.fn(),
    update: vi.fn(),
    insert: vi.fn(),
  }
  for (const rows of selectRows)
    tx.select.mockReturnValueOnce(selectResult(rows))
  transaction.mockImplementation(async callback => callback(tx))
  return tx
}

describe('plan invite membership removal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    selectQueries.length = 0
  })

  it('邀请有效期使用锁后实时数据库时间判断', () => {
    const source = readFileSync(resolve(process.cwd(), 'app/db/queries/plans.invite.ts'), 'utf8')
    const expiryCheckCount = source.split('expiresAt} > clock_timestamp()').length - 1

    expect(expiryCheckCount).toBe(2)
    expect(source).not.toContain('expiresAt} > now()')
  })

  it.each([
    ['重新生成', (expiresAt: Date) => regenerateInviteLink('plan-1', 'owner-1', expiresAt)],
    ['撤销', () => revokeInviteLink('plan-1', 'owner-1')],
  ])('%s邀请也先锁定同一计划行', async (_name, operation) => {
    getActivePlanForUser.mockResolvedValue({ canManage: true })
    const tx = setupTransaction([[{ id: 'plan-1' }]])
    tx.update.mockReturnValue(updateResult())
    tx.insert.mockReturnValue(insertResult())

    await operation(new Date('2026-10-01T00:00:00Z'))

    expect(transaction).toHaveBeenCalledOnce()
    expect(selectQueries[0].for).toHaveBeenCalledWith('update')
    expect(tx.update).toHaveBeenCalledOnce()
  })

  it('在同一事务中锁定邀请、计划和成员，避免撤销与接受竞态', async () => {
    const tx = setupTransaction([
      [{ planId: 'plan-1' }],
      [{ planId: 'plan-1', inviteId: 'invite-1', inviteCreatedAt: new Date('2026-09-10T00:00:00Z') }],
      [{ id: 'member-1', deletedAt: null }],
    ])

    const result = await acceptInviteByToken('active-token', 'user-1')

    expect(result).toEqual({ planId: 'plan-1', joined: false })
    expect(transaction).toHaveBeenCalledOnce()
    expect(tx.select).toHaveBeenCalledTimes(3)
    expect(selectQueries).toHaveLength(3)
    expect(selectQueries[0].for).toHaveBeenCalledWith('update', { of: plans })
    expect(selectQueries[1].for).toHaveBeenCalledWith('update')
    expect(selectQueries[2].for).toHaveBeenCalledWith('update')
  })

  it('数据库未返回有效邀请时不读取或写入成员', async () => {
    const tx = setupTransaction([[{ planId: 'plan-1' }], []])

    const result = await acceptInviteByToken('revoked-or-expired-token', 'user-1')

    expect(result).toBeNull()
    expect(tx.select).toHaveBeenCalledTimes(2)
    expect(tx.update).not.toHaveBeenCalled()
    expect(tx.insert).not.toHaveBeenCalled()
    expect(selectQueries[0].for).toHaveBeenCalledWith('update', { of: plans })
    expect(selectQueries[1].for).toHaveBeenCalledWith('update')
  })

  it('拒绝用成员移除前生成的旧链接恢复权限', async () => {
    const tx = setupTransaction([
      [{ planId: 'plan-1' }],
      [{ planId: 'plan-1', inviteId: 'invite-1', inviteCreatedAt: new Date('2026-09-01T00:00:00Z') }],
      [{ id: 'member-1', deletedAt: new Date('2026-09-05T00:00:00Z') }],
    ])

    const result = await acceptInviteByToken('old-token', 'user-1')

    expect(result).toBeNull()
    expect(tx.update).not.toHaveBeenCalled()
  })

  it('允许用成员移除后新生成的链接重新加入', async () => {
    const tx = setupTransaction([
      [{ planId: 'plan-1' }],
      [{ planId: 'plan-1', inviteId: 'invite-2', inviteCreatedAt: new Date('2026-09-10T00:00:00Z') }],
      [{ id: 'member-1', deletedAt: new Date('2026-09-05T00:00:00Z') }],
    ])
    tx.update.mockReturnValue(updateResult())

    const result = await acceptInviteByToken('new-token', 'user-1')

    expect(result).toEqual({ planId: 'plan-1', joined: true })
    expect(tx.update).toHaveBeenCalledOnce()
  })
})
