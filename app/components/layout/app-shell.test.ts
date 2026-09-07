import { describe, expect, it } from 'vitest'
import { isNavItemActive } from './nav-item'

describe('应用导航归属', () => {
  it('资产详情和订阅详情都归入资产入口', () => {
    expect(isNavItemActive('/assets', '/assets/asset-1')).toBe(true)
    expect(isNavItemActive('/assets', '/subscriptions/sub-1')).toBe(true)
    expect(isNavItemActive('/assets', '/plans/plan-1')).toBe(false)
  })

  it('子页面保持对应的计划和设置入口高亮', () => {
    expect(isNavItemActive('/plans', '/plans/plan-1/records/2026-09')).toBe(true)
    expect(isNavItemActive('/settings', '/settings/categories')).toBe(true)
    expect(isNavItemActive('/settings', '/assets')).toBe(false)
  })

  it('不会把相似前缀误判为当前入口', () => {
    expect(isNavItemActive('/plans', '/plans-old')).toBe(false)
    expect(isNavItemActive('/settings', '/settings2')).toBe(false)
  })
})
