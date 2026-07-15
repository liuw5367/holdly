import { describe, expect, it } from 'vitest'
import { assetValueRecordSchema } from './asset.schema'

describe('资产估值记录校验', () => {
  it('接受零估值与可选备注', () => {
    expect(assetValueRecordSchema.safeParse({
      value: '0',
      valuedOn: '2026-07-15',
      source: 'manual',
      notes: '',
    }).success).toBe(true)
  })

  it('拒绝负数、空日期与未知来源', () => {
    expect(assetValueRecordSchema.safeParse({ value: '-1', valuedOn: '2026-07-15', source: 'manual' }).success).toBe(false)
    expect(assetValueRecordSchema.safeParse({ value: '10', valuedOn: '', source: 'manual' }).success).toBe(false)
    expect(assetValueRecordSchema.safeParse({ value: '10', valuedOn: '2026-07-15', source: 'automatic' }).success).toBe(false)
  })
})
