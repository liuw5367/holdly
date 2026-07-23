import { beforeEach, describe, expect, it, vi } from 'vitest'
import { assets, paymentTypes } from '~/db/schema'
import { generateBackupHtml } from './backup.server'

const { dbSelect, eqSpy } = vi.hoisted(() => ({
  dbSelect: vi.fn(),
  eqSpy: vi.fn(),
}))

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>()
  return {
    ...actual,
    eq: eqSpy.mockImplementation(actual.eq),
  }
})

vi.mock('~/db', () => ({
  db: {
    select: dbSelect,
  },
}))

vi.mock('~/db/queries/assets', () => ({
  getAssetTagsByUserId: vi.fn().mockResolvedValue([]),
}))

describe('generateBackupHtml', () => {
  beforeEach(() => {
    eqSpy.mockClear()
    dbSelect.mockReset()

    const assetQuery = {
      from: vi.fn(),
      leftJoin: vi.fn(),
      where: vi.fn(),
      orderBy: vi.fn().mockResolvedValue([]),
    }
    assetQuery.from.mockReturnValue(assetQuery)
    assetQuery.leftJoin.mockReturnValue(assetQuery)
    assetQuery.where.mockReturnValue(assetQuery)

    const planQuery = {
      from: vi.fn(),
      innerJoin: vi.fn(),
      where: vi.fn().mockResolvedValue([]),
    }
    planQuery.from.mockReturnValue(planQuery)
    planQuery.innerJoin.mockReturnValue(planQuery)

    dbSelect
      .mockReturnValueOnce(assetQuery)
      .mockReturnValueOnce(planQuery)
  })

  it('使用资产的支付类型字段关联支付类型表', async () => {
    await generateBackupHtml('user-1')

    expect(eqSpy).toHaveBeenCalledWith(assets.paymentTypeId, paymentTypes.id)
    expect(eqSpy).not.toHaveBeenCalledWith(assets.categoryId, paymentTypes.id)
  })
})
