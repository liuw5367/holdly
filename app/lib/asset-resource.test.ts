import { describe, expect, it } from 'vitest'
import { belongsToAsset } from './asset-resource'

describe('belongsToAsset', () => {
  it('仅允许操作属于当前资产的子资源', () => {
    expect(belongsToAsset({ assetId: 'asset-a' }, 'asset-a')).toBe(true)
    expect(belongsToAsset({ assetId: 'asset-b' }, 'asset-a')).toBe(false)
    expect(belongsToAsset(null, 'asset-a')).toBe(false)
  })
})
