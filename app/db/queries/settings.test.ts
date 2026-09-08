import { beforeEach, describe, expect, it, vi } from 'vitest'
import { profiles } from '~/db/schema'
import { updateSettingsReminderConfig } from './settings'

const { dbUpdate, eqSpy, returning, set, where } = vi.hoisted(() => ({
  dbUpdate: vi.fn(),
  eqSpy: vi.fn(),
  returning: vi.fn(),
  set: vi.fn(),
  where: vi.fn(),
}))

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>()
  return {
    ...actual,
    eq: eqSpy.mockImplementation(actual.eq),
  }
})

vi.mock('~/db', () => ({
  db: { update: dbUpdate },
}))

describe('updateSettingsReminderConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    returning.mockResolvedValue([{ id: 'user-1' }])
    where.mockReturnValue({ returning })
    set.mockReturnValue({ returning, where })
    dbUpdate.mockReturnValue({ set })
  })

  it('只更新当前用户的提醒设置', async () => {
    await updateSettingsReminderConfig('user-1', {
      reminderEnabled: true,
      reminderSubscriptionDays: 7,
      reminderWarrantyDays: 14,
    })

    expect(eqSpy).toHaveBeenCalledWith(profiles.id, 'user-1')
    expect(where).toHaveBeenCalledOnce()
  })
})
