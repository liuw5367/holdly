import { beforeEach, describe, expect, it, vi } from 'vitest'
import { action } from './settings.payment-account-editor'

const {
  createSettingsCreditCard,
  createSettingsPaymentAccount,
  getSettingsPaymentAccountById,
  getSettingsPaymentTypesByUserId,
  getUser,
  updateSettingsCreditCard,
  updateSettingsPaymentAccount,
  createSupabaseServerClient,
} = vi.hoisted(() => ({
  createSettingsCreditCard: vi.fn(),
  createSettingsPaymentAccount: vi.fn(),
  getSettingsPaymentAccountById: vi.fn(),
  getSettingsPaymentTypesByUserId: vi.fn(),
  getUser: vi.fn(),
  updateSettingsCreditCard: vi.fn(),
  updateSettingsPaymentAccount: vi.fn(),
  createSupabaseServerClient: vi.fn(),
}))

vi.mock('~/db/queries/settings', () => ({
  createSettingsCreditCard,
  createSettingsPaymentAccount,
  getSettingsPaymentAccountById,
  getSettingsPaymentTypesByUserId,
  updateSettingsCreditCard,
  updateSettingsPaymentAccount,
}))

vi.mock('~/lib/supabase.server', () => ({
  createSupabaseServerClient,
}))

describe('支付账户编辑 action', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    getSettingsPaymentAccountById.mockResolvedValue(null)
    getSettingsPaymentTypesByUserId.mockResolvedValue([
      { id: 'credit-card', name: '信用卡', isPreset: true },
      { id: 'wechat', name: '微信支付', isPreset: true },
    ])
    createSettingsPaymentAccount.mockResolvedValue('account-1')
    createSettingsCreditCard.mockResolvedValue('card-1')
    createSupabaseServerClient.mockReturnValue({
      supabase: { auth: { getUser } },
      headers: new Headers(),
    })
  })

  it('非信用卡类型只写入普通账户字段', async () => {
    const response = await action({
      request: createRequest({
        paymentTypeId: 'wechat',
        name: '微信零钱',
      }),
      params: {},
    } as Parameters<typeof action>[0])

    expect(createSettingsPaymentAccount).toHaveBeenCalledWith('user-1', {
      paymentTypeId: 'wechat',
      name: '微信零钱',
    })
    expect(createSettingsCreditCard).not.toHaveBeenCalled()
    expect((response as Response).headers.get('Location')).toBe('/settings/payment-accounts')
  })

  it('固定预置信用卡类型写入完整信用卡资料', async () => {
    const response = await action({
      request: createRequest({
        paymentTypeId: 'credit-card',
        name: 'Visa 白金卡',
        bankName: '招商银行',
        lastFour: '6288',
        statementDay: '12',
        repaymentRule: 'fixed_day',
        repaymentDay: '25',
        creditLimit: '50000',
        currencyCode: 'CNY',
        notes: '',
      }),
      params: {},
    } as Parameters<typeof action>[0])

    expect(createSettingsCreditCard).toHaveBeenCalledWith('user-1', expect.objectContaining({
      paymentTypeId: 'credit-card',
      name: 'Visa 白金卡',
      bankName: '招商银行',
      lastFour: '6288',
    }))
    expect(createSettingsPaymentAccount).not.toHaveBeenCalled()
    expect((response as Response).headers.get('Location')).toBe('/settings/payment-accounts/card-1')
  })
})

function createRequest(values: Record<string, string>): Request {
  const formData = new FormData()
  for (const [key, value] of Object.entries(values))
    formData.set(key, value)
  return new Request('https://holdly.example/settings/payment-accounts/new', { method: 'POST', body: formData })
}
