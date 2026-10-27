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

  it('提醒端点接受原有兼容请求头', async () => {
    const request = new Request('https://holdly.example/api/cron/send-reminders', {
      method: 'POST',
      headers: { 'x-cron-trigger': 'true' },
    })

    const response = await reminderAction({ request })

    expect(response.status).toBe(200)
    expect(dbSelect).toHaveBeenCalled()
  })

  it('备份端点接受原有兼容请求头', async () => {
    const request = new Request('https://holdly.example/api/cron/send-backup', {
      method: 'POST',
      headers: { 'x-cron-trigger': 'true' },
    })

    const response = await backupAction({ request })

    expect(response.status).toBe(200)
    expect(dbSelect).toHaveBeenCalled()
  })

  it('按原有逻辑直接比较请求密钥与配置值', async () => {
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
    expect((await reminderAction({ request: emptyRequest })).status).toBe(200)
  })

  it('没有兼容请求头且密钥错误时拒绝未登录请求', async () => {
    const request = new Request('https://holdly.example/api/cron/send-reminders', {
      method: 'POST',
      headers: { 'x-cron-secret': 'wrong-secret' },
    })

    expect((await reminderAction({ request })).status).toBe(401)
    expect(dbSelect).not.toHaveBeenCalled()
  })
})
