import { beforeEach, describe, expect, it, vi } from 'vitest'
import { action } from './settings/payment-types'

const {
  createSettingsPaymentType,
  getUser,
  softDeleteSettingsPaymentType,
  updateSettingsPaymentType,
  createSupabaseServerClient,
} = vi.hoisted(() => ({
  createSettingsPaymentType: vi.fn(),
  getUser: vi.fn(),
  softDeleteSettingsPaymentType: vi.fn(),
  updateSettingsPaymentType: vi.fn(),
  createSupabaseServerClient: vi.fn(),
}))

vi.mock('~/db/queries/settings', () => ({
  createSettingsPaymentType,
  getSettingsPaymentTypesByUserId: vi.fn(),
  softDeleteSettingsPaymentType,
  updateSettingsPaymentType,
}))

vi.mock('~/lib/supabase.server', () => ({
  createSupabaseServerClient,
}))

describe('支付类型 action', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    createSupabaseServerClient.mockReturnValue({
      supabase: { auth: { getUser } },
      headers: new Headers(),
    })
  })

  it('拒绝创建重名支付类型', async () => {
    createSettingsPaymentType.mockResolvedValue(null)

    const response = await action({
      request: createRequest({ intent: 'create', name: '信用卡' }),
    } as Parameters<typeof action>[0])

    expect(response).toMatchObject({
      data: { error: '支付类型名称已存在' },
      init: { status: 400 },
    })
  })

  it('拒绝修改预置支付类型', async () => {
    updateSettingsPaymentType.mockResolvedValue('forbidden')

    const response = await action({
      request: createRequest({ intent: 'update', id: 'type-1', name: '新名称' }),
    } as Parameters<typeof action>[0])

    expect(response).toMatchObject({
      data: { error: '预置支付类型不能修改' },
      init: { status: 400 },
    })
  })

  it('拒绝删除预置支付类型', async () => {
    softDeleteSettingsPaymentType.mockResolvedValue('forbidden')

    const response = await action({
      request: createRequest({ intent: 'delete', id: 'type-1' }),
    } as Parameters<typeof action>[0])

    expect(response).toMatchObject({
      data: { error: '预置支付类型不能删除' },
      init: { status: 400 },
    })
  })
})

function createRequest(values: Record<string, string>): Request {
  const formData = new FormData()
  for (const [key, value] of Object.entries(values))
    formData.set(key, value)
  return new Request('https://holdly.example/settings/payment-types', { method: 'POST', body: formData })
}
