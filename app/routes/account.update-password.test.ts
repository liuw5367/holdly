import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setPasswordRecoveryGrant } from '~/lib/password-recovery.server'
import { updatePasswordSchema } from '~/lib/update-password.schema'
import { action } from './account.update-password'

const { getUser, signInWithPassword, updateUser, createSupabaseServerClient } = vi.hoisted(() => ({
  getUser: vi.fn(),
  signInWithPassword: vi.fn(),
  updateUser: vi.fn(),
  createSupabaseServerClient: vi.fn(),
}))

vi.mock('~/lib/supabase.server', () => ({
  createSupabaseServerClient,
}))

describe('update password', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('PASSWORD_RECOVERY_SECRET', 'test-password-recovery-secret-32-chars')
    getUser.mockResolvedValue({ data: { user: { id: 'user-1', email: 'user@example.com' } } })
    signInWithPassword.mockResolvedValue({ error: null })
    updateUser.mockResolvedValue({ error: null })
    createSupabaseServerClient.mockReturnValue({
      supabase: { auth: { getUser, signInWithPassword, updateUser } },
      headers: new Headers(),
    })
  })

  afterEach(() => vi.unstubAllEnvs())

  it('requires the old password in change mode', () => {
    const result = updatePasswordSchema.safeParse({
      mode: 'change',
      password: 'new-password',
      confirmPassword: 'new-password',
    })

    expect(result.success).toBe(false)
    if (!result.success)
      expect(result.error.issues[0].message).toBe('请输入旧密码')
  })

  it('verifies the old password before updating it', async () => {
    const formData = new FormData()
    formData.set('mode', 'change')
    formData.set('oldPassword', 'old-password')
    formData.set('password', 'new-password')
    formData.set('confirmPassword', 'new-password')
    const request = new Request('https://holdly.example/account/update-password?mode=change', {
      method: 'POST',
      body: formData,
    })

    const response = await action({ request } as Parameters<typeof action>[0])

    expect(signInWithPassword).toHaveBeenCalledWith({ email: 'user@example.com', password: 'old-password' })
    expect(updateUser).toHaveBeenCalledWith({ password: 'new-password' })
    expect(response).toBeInstanceOf(Response)
    expect((response as Response).headers.get('Location')).toBe('/settings/account?passwordChanged=1')
  })

  it('拒绝普通会话伪装成密码恢复流程', async () => {
    const formData = new FormData()
    formData.set('mode', 'recovery')
    formData.set('password', 'new-password')
    formData.set('confirmPassword', 'new-password')
    const request = new Request('https://holdly.example/account/update-password', {
      method: 'POST',
      body: formData,
    })

    const response = await action({ request } as Parameters<typeof action>[0])

    expect((response as { init?: ResponseInit }).init?.status).toBe(403)
    expect(updateUser).not.toHaveBeenCalled()
  })

  it('验证签名恢复授权后更新密码并清除授权', async () => {
    const formData = new FormData()
    formData.set('mode', 'recovery')
    formData.set('password', 'new-password')
    formData.set('confirmPassword', 'new-password')
    const requestUrl = 'https://holdly.example/account/update-password'
    const grantHeaders = new Headers()
    setPasswordRecoveryGrant(grantHeaders, new Request(requestUrl), 'user-1')
    const cookie = grantHeaders.get('Set-Cookie')!.split(';')[0]
    const request = new Request(requestUrl, {
      method: 'POST',
      headers: { Cookie: cookie },
      body: formData,
    })

    const response = await action({ request } as Parameters<typeof action>[0])

    expect(updateUser).toHaveBeenCalledWith({ password: 'new-password' })
    expect((response as Response).headers.get('Set-Cookie')).toContain('holdly-password-recovery-grant=')
    expect((response as Response).headers.get('Location')).toBe('/settings/account?passwordChanged=1')
  })

  it('密码服务临时失败时保留恢复授权以便重试', async () => {
    updateUser.mockResolvedValue({ error: { message: 'temporary failure' } })
    const formData = new FormData()
    formData.set('mode', 'recovery')
    formData.set('password', 'new-password')
    formData.set('confirmPassword', 'new-password')
    const requestUrl = 'https://holdly.example/account/update-password'
    const grantHeaders = new Headers()
    setPasswordRecoveryGrant(grantHeaders, new Request(requestUrl), 'user-1')
    const cookie = grantHeaders.get('Set-Cookie')!.split(';')[0]

    const response = await action({ request: new Request(requestUrl, {
      method: 'POST',
      headers: { Cookie: cookie },
      body: formData,
    }) } as Parameters<typeof action>[0])

    expect((response as { data: { error: string } }).data.error).toBe('temporary failure')
    expect((response as { init?: ResponseInit }).init?.headers).not.toBeUndefined()
    expect(new Headers((response as { init?: ResponseInit }).init?.headers).get('Set-Cookie')).toBeNull()
  })
})
