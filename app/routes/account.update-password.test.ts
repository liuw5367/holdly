import { beforeEach, describe, expect, it, vi } from 'vitest'
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
    getUser.mockResolvedValue({ data: { user: { email: 'user@example.com' } } })
    signInWithPassword.mockResolvedValue({ error: null })
    updateUser.mockResolvedValue({ error: null })
    createSupabaseServerClient.mockReturnValue({
      supabase: { auth: { getUser, signInWithPassword, updateUser } },
      headers: new Headers(),
    })
  })

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

  it('恢复模式使用当前会话更新密码，无需额外授权 cookie', async () => {
    const formData = new FormData()
    formData.set('mode', 'recovery')
    formData.set('password', 'new-password')
    formData.set('confirmPassword', 'new-password')

    const response = await action({ request: new Request('https://holdly.example/account/update-password', {
      method: 'POST',
      body: formData,
    }) } as Parameters<typeof action>[0])

    expect(signInWithPassword).not.toHaveBeenCalled()
    expect(updateUser).toHaveBeenCalledWith({ password: 'new-password' })
    expect((response as Response).headers.get('Location')).toBe('/settings/account?passwordChanged=1')
  })

  it('未登录时拒绝恢复改密并跳转登录页', async () => {
    getUser.mockResolvedValue({ data: { user: null } })

    const response = await action({ request: new Request('https://holdly.example/account/update-password', {
      method: 'POST',
      body: new FormData(),
    }) } as Parameters<typeof action>[0])

    expect(updateUser).not.toHaveBeenCalled()
    expect((response as Response).headers.get('Location')).toBe('/login')
  })
})
