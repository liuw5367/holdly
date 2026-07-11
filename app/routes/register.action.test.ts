import { beforeEach, describe, expect, it, vi } from 'vitest'
import { action } from './register'

const { signUp, createSupabaseServerClient } = vi.hoisted(() => ({
  signUp: vi.fn(),
  createSupabaseServerClient: vi.fn(),
}))

vi.mock('~/lib/supabase.server', () => ({
  createSupabaseServerClient,
}))

describe('register action', () => {
  beforeEach(() => {
    signUp.mockResolvedValue({ data: { session: null }, error: null })
    const headers = new Headers()
    headers.append('Set-Cookie', 'sb-test-auth-token-code-verifier=verifier; Path=/; HttpOnly')
    createSupabaseServerClient.mockReturnValue({
      supabase: { auth: { signUp } },
      headers,
    })
  })

  it('returns the PKCE verifier cookie with the confirmation-email state', async () => {
    const formData = new FormData()
    formData.set('displayName', '测试用户')
    formData.set('email', 'user@example.com')
    formData.set('password', 'password123')
    formData.set('confirmPassword', 'password123')
    const request = new Request('https://holdly.example/register', {
      method: 'POST',
      body: formData,
    })

    const result = await action({ request } as Parameters<typeof action>[0])

    if (!(result instanceof Object) || !('data' in result) || !('init' in result)) {
      throw new TypeError('Expected registration data with response headers')
    }
    expect(result.data).toEqual({ success: true })
    expect(result.init?.headers).toBeInstanceOf(Headers)
    expect((result.init?.headers as Headers).get('Set-Cookie')).toContain('code-verifier=verifier')
  })
})
