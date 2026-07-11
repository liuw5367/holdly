import { beforeEach, describe, expect, it, vi } from 'vitest'
import { action } from './login'

const { signInWithOAuth, createSupabaseServerClient } = vi.hoisted(() => ({
  signInWithOAuth: vi.fn(),
  createSupabaseServerClient: vi.fn(),
}))

vi.mock('~/lib/supabase.server', () => ({
  createSupabaseServerClient,
}))

describe('login action', () => {
  beforeEach(() => {
    signInWithOAuth.mockResolvedValue({
      data: { url: 'https://github.com/login/oauth/authorize' },
      error: null,
    })

    const headers = new Headers()
    headers.append('Set-Cookie', 'sb-test-auth-token-code-verifier=verifier; Path=/; HttpOnly')
    createSupabaseServerClient.mockReturnValue({
      supabase: { auth: { signInWithOAuth } },
      headers,
    })
  })

  it('returns the PKCE verifier cookie with the OAuth authorization URL', async () => {
    const formData = new FormData()
    formData.set('intent', 'oauth')
    formData.set('provider', 'github')
    const request = new Request('https://holdly.example/login', {
      method: 'POST',
      body: formData,
    })

    const result = await action({ request } as Parameters<typeof action>[0])

    if (!(result instanceof Object) || !('data' in result) || !('init' in result)) {
      throw new TypeError('Expected OAuth action data with response headers')
    }
    expect(result.data).toEqual({
      url: 'https://github.com/login/oauth/authorize',
    })
    expect(result.init?.headers).toBeInstanceOf(Headers)
    expect((result.init?.headers as Headers).get('Set-Cookie')).toContain('code-verifier=verifier')
  })
})
