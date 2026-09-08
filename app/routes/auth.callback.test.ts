import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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
    vi.stubEnv('PASSWORD_RECOVERY_SECRET', 'test-password-recovery-secret-32-chars')
    exchangeCodeForSession.mockResolvedValue({ error: null })
    verifyOtp.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
    createSupabaseServerClient.mockReturnValue({
      supabase: { auth: { exchangeCodeForSession, verifyOtp } },
      headers: new Headers({ 'Set-Cookie': 'sb-session=test; Path=/' }),
    })
  })

  afterEach(() => vi.unstubAllEnvs())

  it('consumes the recovery token and stores a signed short-lived grant', async () => {
    const recoveryToken = 'a'.repeat(64)
    const request = new Request(
      `https://holdly.example/auth/callback?token_hash=${recoveryToken}&type=recovery&next=%2Faccount%2Fupdate-password`,
    )

    const response = await loader({ request } as Parameters<typeof loader>[0])

    expect(verifyOtp).toHaveBeenCalledWith({ token_hash: recoveryToken, type: 'recovery' })
    expect(exchangeCodeForSession).not.toHaveBeenCalled()
    expect(response.headers.get('Location')).toBe('/account/update-password')
    expect(response.headers.get('Set-Cookie')).toContain('holdly-password-recovery-grant=')
    expect(response.headers.get('Set-Cookie')).not.toContain(recoveryToken)
    expect(response.headers.get('Set-Cookie')).toContain('HttpOnly')
    expect(response.headers.get('Referrer-Policy')).toBe('no-referrer')
  })

  it('keeps exchanging PKCE codes for OAuth and signup callbacks', async () => {
    const request = new Request('https://holdly.example/auth/callback?code=auth-code')

    await loader({ request } as Parameters<typeof loader>[0])

    expect(exchangeCodeForSession).toHaveBeenCalledWith('auth-code')
    expect(verifyOtp).not.toHaveBeenCalled()
  })
})
