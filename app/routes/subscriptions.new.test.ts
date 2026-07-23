import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { action } from './subscriptions.new'

const { createAsset, getUser, createSupabaseServerClient } = vi.hoisted(() => ({
  createAsset: vi.fn(),
  getUser: vi.fn(),
  createSupabaseServerClient: vi.fn(),
}))

vi.mock('~/db/queries/assets', () => ({
  createAsset,
  getCategoriesByUserId: vi.fn(),
  getPaymentAccountsByUserId: vi.fn(),
  getPaymentTypesByUserId: vi.fn(),
  getTagsByUserId: vi.fn(),
}))

vi.mock('~/lib/supabase.server', () => ({
  createSupabaseServerClient,
}))

describe('新建订阅 action', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-23T08:00:00Z'))
    getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    createAsset.mockResolvedValue('asset-1')
    createSupabaseServerClient.mockReturnValue({
      supabase: { auth: { getUser } },
      headers: new Headers(),
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('由服务端生成并持久化首次续费日期', async () => {
    const formData = new FormData()
    formData.set('name', '测试订阅')
    formData.set('emoji', '🔁')
    formData.set('categoryId', 'category-1')
    formData.set('purchaseDate', '2024-01-15')
    formData.set('subscriptionStartDate', '2024-01-15')
    formData.set('subscriptionPrice', '10')
    formData.set('billingCycle', 'monthly')
    const request = new Request('https://holdly.example/subscriptions/new', {
      method: 'POST',
      body: formData,
    })

    const response = await action({ request } as Parameters<typeof action>[0])

    expect(createAsset).toHaveBeenCalledWith(expect.objectContaining({
      nextRenewalDate: '2026-08-15',
      subscriptionStartDate: '2024-01-15',
    }))
    expect(response).toBeInstanceOf(Response)
    expect((response as Response).headers.get('Location')).toBe('/subscriptions/asset-1')
  })
})
