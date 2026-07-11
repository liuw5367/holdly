import { beforeEach, describe, expect, it, vi } from 'vitest'
import { action } from './forgot-password'

const { resetPasswordForEmail, createSupabaseServerClient } = vi.hoisted(() => ({
  resetPasswordForEmail: vi.fn(),
  createSupabaseServerClient: vi.fn(),
}))

vi.mock('~/lib/supabase.server', () => ({
  createSupabaseServerClient,
}))

describe('forgot password action', () => {
  beforeEach(() => {
    resetPasswordForEmail.mockResolvedValue({ error: null })
    const headers = new Headers()
    headers.append('Set-Cookie', 'sb-test-auth-token-code-verifier=verifier; Path=/; HttpOnly')
    createSupabaseServerClient.mockReturnValue({
      supabase: { auth: { resetPasswordForEmail } },
      headers,
    })
  })

  it('returns the PKCE verifier cookie after sending the recovery email', async () => {
    const formData = new FormData()
    formData.set('email', 'user@example.com')
    const request = new Request('https://holdly.example/forgot-password', {
      method: 'POST',
      body: formData,
    })

    const result = await action({ request } as Parameters<typeof action>[0])

    if (!(result instanceof Object) || !('data' in result) || !('init' in result)) {
      throw new TypeError('Expected recovery data with response headers')
    }
    expect(result.data).toEqual({ success: true })
    expect(result.init?.headers).toBeInstanceOf(Headers)
    expect((result.init?.headers as Headers).get('Set-Cookie')).toContain('code-verifier=verifier')
  })
})
