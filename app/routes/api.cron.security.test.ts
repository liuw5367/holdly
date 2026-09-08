import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { action as backupAction } from './api.cron.send-backup'
import { action as reminderAction } from './api.cron.send-reminders'

const { dbSelect, getUser, processUserReminders } = vi.hoisted(() => ({
  dbSelect: vi.fn(),
  getUser: vi.fn(),
  processUserReminders: vi.fn(),
}))

vi.mock('~/db', () => ({
  db: { select: dbSelect },
}))

vi.mock('~/lib/reminder.server', () => ({ processUserReminders }))
vi.mock('~/lib/supabase.server', () => ({
  createSupabaseServerClient: () => ({
    supabase: { auth: { getUser } },
    headers: new Headers(),
  }),
}))

describe('cron authentication', () => {
  beforeEach(() => {
    vi.stubEnv('CRON_SECRET', 'real-secret')
    getUser.mockResolvedValue({ data: { user: null } })
    processUserReminders.mockResolvedValue(0)

    const query = {
      from: vi.fn(),
      where: vi.fn().mockResolvedValue([]),
    }
    query.from.mockReturnValue(query)
    dbSelect.mockReturnValue(query)
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.unstubAllEnvs()
  })

  it('拒绝伪造的兼容请求头', async () => {
    const request = new Request('https://holdly.example/api/cron/send-reminders', {
      method: 'POST',
      headers: { 'x-cron-trigger': 'true' },
    })

    const response = await reminderAction({ request })

    expect(response.status).toBe(401)
    expect(dbSelect).not.toHaveBeenCalled()
  })

  it('备份端点同样拒绝伪造的兼容请求头', async () => {
    const request = new Request('https://holdly.example/api/cron/send-backup', {
      method: 'POST',
      headers: { 'x-cron-trigger': 'true' },
    })

    const response = await backupAction({ request })

    expect(response.status).toBe(401)
    expect(dbSelect).not.toHaveBeenCalled()
  })

  it('只接受非空且正确的 Cron 密钥', async () => {
    const validRequest = new Request('https://holdly.example/api/cron/send-reminders', {
      method: 'POST',
      headers: { 'x-cron-secret': 'real-secret' },
    })

    expect((await reminderAction({ request: validRequest })).status).toBe(200)

    vi.stubEnv('CRON_SECRET', '')
    const emptyRequest = new Request('https://holdly.example/api/cron/send-reminders', {
      method: 'POST',
      headers: { 'x-cron-secret': '' },
    })
    expect((await reminderAction({ request: emptyRequest })).status).toBe(401)
  })
})
