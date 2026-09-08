import type { Route } from './+types/auth.callback'
import { redirect } from 'react-router'
import { getAuthCallbackTarget } from '~/lib/auth-callback'
import { assertPasswordRecoveryConfigured, setPasswordRecoveryGrant } from '~/lib/password-recovery.server'
import { createSupabaseServerClient } from '~/lib/supabase.server'

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const tokenHash = url.searchParams.get('token_hash')
  const type = url.searchParams.get('type')
  const next = url.searchParams.get('next')
  const registered = url.searchParams.get('registered')
  const target = getAuthCallbackTarget(next, registered)

  if (!code && !(tokenHash && type === 'recovery')) {
    return redirect('/login?error=missing_code')
  }

  const { supabase, headers } = createSupabaseServerClient(request)
  if (tokenHash && type === 'recovery') {
    if (tokenHash.length < 16 || tokenHash.length > 2048)
      return redirect('/login?error=invalid_recovery_token', { headers })

    try {
      assertPasswordRecoveryConfigured()
    }
    catch {
      return redirect('/login?error=recovery_not_configured', { headers })
    }

    const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'recovery' })
    if (error || !data.user)
      return redirect(`/login?error=${encodeURIComponent(error?.message || 'invalid_recovery_token')}`, { headers })

    setPasswordRecoveryGrant(headers, request, data.user.id)
    headers.set('Referrer-Policy', 'no-referrer')
    return redirect('/account/update-password', { headers })
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code!)

  if (error) {
    return redirect(`/login?error=${encodeURIComponent(error.message)}`, { headers })
  }

  return redirect(target, { headers })
}
