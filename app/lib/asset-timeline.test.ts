import { describe, expect, it } from 'vitest'
import { buildAssetTimeline } from './asset-timeline'
import { assetSaleSchema, repairRecordSchema, warrantySchema } from './asset.schema'
import { calcSoldOneTimeDailyCost } from './cost'

describe('资产信息闭环', () => {
  it('按日期倒序生成完整时间线并跳过缺失日期', () => {
    expect(buildAssetTimeline({
      purchaseDate: '2024-01-01',
      tradedInAt: '2025-05-01',
      isTradeIn: true,
      warranty: { startDate: '2024-01-01', endDate: '2025-01-01' },
      repairs: [{ id: 'r1', repairDate: '2024-06-03', reason: '更换电池' }],
    })).toEqual([
      { id: 'disposed', date: '2025-05-01', label: '以旧换新' },
      { id: 'warranty-end', date: '2025-01-01', label: '保修结束' },
      { id: 'repair-r1', date: '2024-06-03', label: '维修记录', detail: '更换电池' },
      { id: 'warranty-start', date: '2024-01-01', label: '保修开始' },
      { id: 'purchase', date: '2024-01-01', label: '购入资产' },
    ])
  })

  it('拒绝负金额和倒置的保修日期', () => {
    expect(assetSaleSchema.safeParse({ tradeInPrice: '-1', tradedInAt: '2025-01-01' }).success).toBe(false)
    expect(repairRecordSchema.safeParse({ repairDate: '2025-01-01', cost: '-0.01', isDone: true }).success).toBe(false)
    expect(warrantySchema.safeParse({ startDate: '2025-02-01', endDate: '2025-01-01' }).success).toBe(false)
  })

  it('使用精确金额计算已卖出资产日均成本', () => {
    expect(calcSoldOneTimeDailyCost(100, 33.33, 3)).toBe(22.22333333)
  })
})
