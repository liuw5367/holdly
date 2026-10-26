import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createAsset } from './assets'

const { transaction, insert } = vi.hoisted(() => ({
  transaction: vi.fn(),
  insert: vi.fn(),
}))

const selectQueries: Array<{ for: ReturnType<typeof vi.fn> }> = []

vi.mock('~/db', () => ({ db: { transaction } }))

function selectResult(rows: unknown[]) {
  const query = {
    from: vi.fn(),
    where: vi.fn(),
    limit: vi.fn(),
    for: vi.fn(),
    then: (resolve: (value: unknown[]) => unknown) => Promise.resolve(resolve(rows)),
  }
  query.from.mockReturnValue(query)
  query.where.mockReturnValue(query)
  query.limit.mockReturnValue(query)
  query.for.mockReturnValue(query)
  selectQueries.push(query)
  return query
}

describe('asset relation ownership', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    selectQueries.length = 0
    transaction.mockImplementation(async callback => callback({
      select: vi.fn()
        .mockReturnValueOnce(selectResult([{ id: '11111111-1111-1111-1111-111111111111' }]))
        .mockReturnValueOnce(selectResult([])),
      insert,
    }))
  })

  it('拒绝不属于当前用户的标签', async () => {
    const result = await createAsset({
      userId: 'user-1',
      name: '电脑',
      emoji: '💻',
      categoryId: '11111111-1111-1111-1111-111111111111',
      assetType: 'one_time',
      tagIds: ['22222222-2222-2222-2222-222222222222'],
    })

    expect(result).toBeNull()
    expect(insert).not.toHaveBeenCalled()
    expect(selectQueries).toHaveLength(2)
    expect(selectQueries[0].for).toHaveBeenCalledWith('update')
    expect(selectQueries[1].for).toHaveBeenCalledWith('update')
  })

  it('畸形 UUID 在进入数据库查询前被拒绝', async () => {
    const result = await createAsset({
      userId: 'user-1',
      name: '电脑',
      emoji: '💻',
      categoryId: 'not-a-uuid',
      assetType: 'one_time',
    })

    expect(result).toBeNull()
    expect(insert).not.toHaveBeenCalled()
  })

  it('支付账户存在时必须同时提供匹配的支付类型', async () => {
    const result = await createAsset({
      userId: 'user-1',
      name: '电脑',
      emoji: '💻',
      categoryId: '11111111-1111-1111-1111-111111111111',
      assetType: 'one_time',
      paymentAccountId: '33333333-3333-3333-3333-333333333333',
    })

    expect(result).toBeNull()
    expect(insert).not.toHaveBeenCalled()
  })
})
