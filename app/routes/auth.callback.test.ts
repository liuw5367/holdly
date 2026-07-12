import { beforeEach, describe, expect, it, vi } from 'vitest'
import { loader } from './auth.callback'

const { exchangeCodeForSession, verifyOtp, createSupabaseServerClient } = vi.hoisted(() => ({
  exchangeCodeForSession: vi.fn(),
  verifyOtp: vi.fn(),
  createSupabaseServerClient: vi.fn(),
}))

vi.mock('~/lib/supabase.server', () => ({
  createSupabaseServerClient,
}))

describe('auth callback loader', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    exchangeCodeForSession.mockResolvedValue({ error: null })
    verifyOtp.mockResolvedValue({ error: null })
    createSupabaseServerClient.mockReturnValue({
      supabase: { auth: { exchangeCodeForSession, verifyOtp } },
      headers: new Headers({ 'Set-Cookie': 'sb-session=test; Path=/' }),
    })
  })

  it('verifies a recovery token hash without requiring a PKCE verifier cookie', async () => {
    const request = new Request(
      'https://holdly.example/auth/callback?token_hash=recovery-token&type=recovery&next=%2Faccount%2Fupdate-password',
    )

    const response = await loader({ request } as Parameters<typeof loader>[0])

    expect(verifyOtp).toHaveBeenCalledWith({ token_hash: 'recovery-token', type: 'recovery' })
    expect(exchangeCodeForSession).not.toHaveBeenCalled()
    expect(response.headers.get('Location')).toBe('/account/update-password')
    expect(response.headers.get('Set-Cookie')).toContain('sb-session=test')
  })

  it('keeps exchanging PKCE codes for OAuth and signup callbacks', async () => {
    const request = new Request('https://holdly.example/auth/callback?code=auth-code')

    await loader({ request } as Parameters<typeof loader>[0])

    expect(exchangeCodeForSession).toHaveBeenCalledWith('auth-code')
    expect(verifyOtp).not.toHaveBeenCalled()
  })
})
