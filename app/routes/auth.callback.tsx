import type { Route } from './+types/auth.callback'
import { redirect } from 'react-router'
import { getAuthCallbackTarget } from '~/lib/auth-callback'
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
  // Recovery links may be opened outside the browser that requested them, so
  // they use the email token hash instead of relying on a local PKCE verifier.
  const { error } = tokenHash && type === 'recovery'
    ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'recovery' })
    : await supabase.auth.exchangeCodeForSession(code!)

  if (error) {
    return redirect(`/login?error=${encodeURIComponent(error.message)}`, { headers })
  }

  return redirect(target, { headers })
}
