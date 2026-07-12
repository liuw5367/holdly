import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockSendEmail = vi.fn()
const mockInsertValues = vi.fn()
const queryResults: unknown[] = []

function makeBuilder(result: unknown) {
  const builder = {
    from: vi.fn(() => builder),
    innerJoin: vi.fn(() => builder),
    where: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    then: (resolve: (value: unknown) => void) => Promise.resolve(result).then(resolve),
  }
  return builder
}

vi.mock('drizzle-orm', () => ({
  and: vi.fn(() => ({})),
  eq: vi.fn(() => ({})),
  gte: vi.fn(() => ({})),
  isNull: vi.fn(() => ({})),
  lte: vi.fn(() => ({})),
}))

vi.mock('~/db', () => ({
  db: {
    select: vi.fn(() => makeBuilder(queryResults.shift())),
    insert: vi.fn(() => ({ values: mockInsertValues })),
  },
}))

vi.mock('~/db/schema', () => ({
  assets: {
    id: {},
    userId: {},
    assetType: {},
    subscriptionStatus: {},
    deletedAt: {},
    reminderEnabled: {},
  },
  profiles: {
    id: {},
    reminderSubscriptionDays: {},
    reminderWarrantyDays: {},
    email: {},
  },
  reminderJobs: {
    id: {},
    assetId: {},
    reminderType: {},
    scheduledAt: {},
  },
  warranties: {
    assetId: {},
    endDate: {},
  },
}))

vi.mock('~/lib/email.server', () => ({
  sendEmail: mockSendEmail,
}))

describe('processUserReminders delivery accounting', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-05T08:00:00Z'))
    queryResults.length = 0
    mockSendEmail.mockReset()
    mockInsertValues.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('does not create a reminder job or count sent when email delivery fails', async () => {
    queryResults.push(
      [{ email: 'user@example.com', reminderSubscriptionDays: 3, reminderWarrantyDays: 14 }],
      [{
        id: 'asset-1',
        userId: 'user-1',
        name: 'Test Subscription',
        subscriptionPrice: '10.00',
        subscriptionStatus: 'active',
        nextRenewalDate: '2026-06-06',
        subscriptionStartDate: null,
        subscriptionStoppedAt: null,
        purchaseDate: '2026-01-01',
        billingCycle: 'monthly',
        reminderSubscriptionDaysOverride: null,
      }],
      [],
      [],
    )
    mockSendEmail.mockResolvedValue({ ok: false, error: 'Domain not verified' })

    const { processUserReminders } = await import('./reminder.server')

    await expect(processUserReminders('user-1')).resolves.toBe(0)
    expect(mockSendEmail).toHaveBeenCalledWith(expect.objectContaining({
      html: expect.stringContaining('订阅续费提醒'),
      text: expect.stringContaining('Test Subscription'),
    }))
    expect(mockInsertValues).not.toHaveBeenCalled()
  })
})
