import { beforeEach, describe, expect, it, vi } from 'vitest'
import { action } from './subscriptions.$id'

const mocks = vi.hoisted(() => ({ getUser: vi.fn(), getAssetById: vi.fn(), softDeleteSubscriptionRenewal: vi.fn() }))
vi.mock('~/lib/supabase.server', () => ({
  createSupabaseServerClient: () => ({ supabase: { auth: { getUser: mocks.getUser } }, headers: new Headers() }),
}))
vi.mock('~/db/queries/assets', () => mocks)
vi.mock('~/db/queries/settings', () => ({ getSettingsProfileByUserId: vi.fn() }))

function remove(recordId = '12345678-1234-1234-1234-123456789abc') {
  const body = new FormData()
  body.set('intent', 'delete-renewal')
  body.set('recordId', recordId)
  return action({ request: new Request('https://holdly.example/subscriptions/sub-1', { method: 'POST', body }), params: { id: 'sub-1' } } as Parameters<typeof action>[0])
}

beforeEach(() => {
  vi.resetAllMocks()
  mocks.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
  mocks.getAssetById.mockResolvedValue({ assetType: 'subscription' })
  mocks.softDeleteSubscriptionRenewal.mockResolvedValue(true)
})

describe('删除续费记录 action', () => {
  it('使用当前用户和路由订阅限定删除范围', async () => {
    expect(await remove()).toMatchObject({ data: { ok: true } })
    expect(mocks.softDeleteSubscriptionRenewal).toHaveBeenCalledWith('12345678-1234-1234-1234-123456789abc', 'sub-1', 'user-1')
  })
  it('未登录不能删除', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } })
    await expect(remove()).rejects.toMatchObject({ status: 302 })
    expect(mocks.softDeleteSubscriptionRenewal).not.toHaveBeenCalled()
  })
  it.each([null, { assetType: 'one_time' }])('无权访问或非订阅资产不能删除', async (asset) => {
    mocks.getAssetById.mockResolvedValue(asset)
    await expect(remove()).rejects.toMatchObject({ status: 404 })
    expect(mocks.softDeleteSubscriptionRenewal).not.toHaveBeenCalled()
  })
  it('拒绝无效记录标识', async () => {
    expect(await remove('invalid')).toMatchObject({ init: { status: 400 } })
    expect(mocks.softDeleteSubscriptionRenewal).not.toHaveBeenCalled()
  })
  it('跨订阅或已删除记录返回未找到', async () => {
    mocks.softDeleteSubscriptionRenewal.mockResolvedValue(false)
    expect(await remove()).toMatchObject({ data: { ok: false }, init: { status: 404 } })
  })
})
