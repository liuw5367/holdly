import type { Route } from './+types/login'

import { IconEye, IconEyeOff, IconLoader2 } from '@tabler/icons-react'
import { useEffect, useState } from 'react'
import { Link, redirect, data as routeData, useFetcher, useSearchParams } from 'react-router'
import { loginSchema } from '~/lib/auth.schema'
import { getDisplayedLoginError, getPendingLoginIntent } from '~/lib/login-state'
import { safeRedirect } from '~/lib/redirect'
import { createSupabaseServerClient } from '~/lib/supabase.server'

const OAUTH_PROVIDERS = ['github', 'google'] as const
type OAuthProvider = typeof OAUTH_PROVIDERS[number]

export async function loader({ request }: Route.LoaderArgs) {
  const { supabase, headers } = createSupabaseServerClient(request)
  const { data: { user } } = await supabase.auth.getUser()
  const url = new URL(request.url)
  const next = url.searchParams.get('next')
  if (user) {
    return redirect(safeRedirect(next, '/dashboard'), { headers })
  }
  return new Response(null, { headers })
}

export async function action({ request }: Route.ActionArgs) {
  const { supabase, headers } = createSupabaseServerClient(request)
  const url = new URL(request.url)
  const next = url.searchParams.get('next')
  const target = safeRedirect(next, '/dashboard')
  const formData = await request.formData()
  const intent = formData.get('intent')

  if (intent === 'oauth') {
    const provider = formData.get('provider')
    if (typeof provider !== 'string' || !OAUTH_PROVIDERS.includes(provider as OAuthProvider)) {
      return { error: '不支持的登录方式' }
    }
    const callbackQuery = next && safeRedirect(next, '') ? `?next=${encodeURIComponent(target)}` : ''
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: provider as OAuthProvider,
      options: {
        redirectTo: `${url.origin}/auth/callback${callbackQuery}`,
      },
    })
    if (error) {
      return { error: error.message }
    }
    // OAuth PKCE verifier 由 Supabase 写入 cookie，回调换取 session 时必须带回。
    return routeData({ url: data.url }, { headers })
  }

  const raw = {
    email: formData.get('email'),
    password: formData.get('password'),
  }

  const parsed = loginSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  const { error } = await supabase.auth.signInWithPassword(parsed.data)
  if (error) {
    return { error: error.message === 'Invalid login credentials' ? '邮箱或密码错误' : error.message }
  }

  return redirect(target, { headers })
}

export default function Login() {
  const fetcher = useFetcher<{ error?: string, url?: string }>()
  const [searchParams] = useSearchParams()
  const [showPassword, setShowPassword] = useState(false)
  const displayedError = getDisplayedLoginError(fetcher.data?.error, searchParams.get('error'))
  const pendingIntent = getPendingLoginIntent(
    fetcher.state,
    fetcher.formData?.get('intent'),
    fetcher.formData?.get('provider'),
  )

  useEffect(() => {
    if (fetcher.data?.url) {
      window.location.href = fetcher.data.url
    }
  }, [fetcher.data?.url])

  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '48px 24px 32px',
        textAlign: 'center',
        background: 'var(--color-canvas)',
      }}
    >
      <div style={{ width: '100%', maxWidth: 360 }}>
        {/* Brand */}
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 42,
            color: 'var(--color-primary)',
            marginBottom: 20,
          }}
        >
          Holdly
        </div>
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 22,
            color: 'var(--color-ink)',
            lineHeight: 1.3,
            marginBottom: 8,
          }}
        >
          把每一件资产，
          <br />
          变成看得清的日常成本。
        </div>
        <p style={{ fontSize: 13, color: 'var(--color-muted)', marginBottom: 32 }}>
          开始记录你的每件物品，追踪真实持有成本。
        </p>

        {/* Auth group */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, textAlign: 'left' }}>
          {/* Error */}
          {displayedError && (
            <div
              style={{
                borderRadius: 8,
                padding: '10px 12px',
                textAlign: 'center',
                fontSize: 14,
                background: 'color-mix(in srgb, var(--color-error) 10%, transparent)',
                color: 'var(--color-error)',
              }}
            >
              {displayedError}
            </div>
          )}

          {/* GitHub OAuth */}
          <fetcher.Form method="post">
            <input type="hidden" name="intent" value="oauth" />
            <input type="hidden" name="provider" value="github" />
            <button
              type="submit"
              disabled={pendingIntent === 'oauth:github'}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                height: 44,
                padding: '0 16px',
                width: '100%',
                background: 'var(--color-canvas)',
                color: 'var(--color-ink)',
                fontSize: 15,
                fontWeight: 500,
                border: '1px solid var(--color-hairline)',
                borderRadius: 10,
                cursor: 'pointer',
                opacity: pendingIntent === 'oauth:github' ? 0.6 : 1,
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-surface-soft)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'var(--color-canvas)')}
            >
              {pendingIntent === 'oauth:github' && <IconLoader2 size={16} className="animate-spin" />}
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
              </svg>
              使用 GitHub 登录
            </button>
          </fetcher.Form>

          {/* Google OAuth */}
          <fetcher.Form method="post">
            <input type="hidden" name="intent" value="oauth" />
            <input type="hidden" name="provider" value="google" />
            <button
              type="submit"
              disabled={pendingIntent === 'oauth:google'}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                height: 44,
                padding: '0 16px',
                width: '100%',
                background: 'var(--color-canvas)',
                color: 'var(--color-ink)',
                fontSize: 15,
                fontWeight: 500,
                border: '1px solid var(--color-hairline)',
                borderRadius: 10,
                cursor: 'pointer',
                opacity: pendingIntent === 'oauth:google' ? 0.6 : 1,
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-surface-soft)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'var(--color-canvas)')}
            >
              {pendingIntent === 'oauth:google' && <IconLoader2 size={16} className="animate-spin" />}
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              使用 Google 登录
            </button>
          </fetcher.Form>

          {/* Divider */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              color: 'var(--color-muted)',
              fontSize: 12,
              margin: '16px 0',
            }}
          >
            <span style={{ flex: 1, height: 1, background: 'var(--color-hairline)' }} />
            <span>或</span>
            <span style={{ flex: 1, height: 1, background: 'var(--color-hairline)' }} />
          </div>

          {/* Email / password form */}
          <fetcher.Form method="post" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <input type="hidden" name="intent" value="password" />
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: 12,
                  fontWeight: 500,
                  color: 'var(--color-muted)',
                  marginBottom: 6,
                }}
              >
                邮箱
              </label>
              <input
                name="email"
                type="email"
                placeholder="your@email.com"
                style={{
                  width: '100%',
                  height: 44,
                  padding: '0 12px',
                  background: 'var(--color-canvas)',
                  border: '1px solid var(--color-hairline)',
                  borderRadius: 10,
                  fontSize: 15,
                  color: 'var(--color-ink)',
                  outline: 'none',
                  transition: 'border-color 0.15s, box-shadow 0.15s',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'var(--color-primary)'
                  e.currentTarget.style.boxShadow = '0 0 0 3px var(--color-primary-muted)'
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'var(--color-hairline)'
                  e.currentTarget.style.boxShadow = 'none'
                }}
                required
              />
            </div>
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: 12,
                  fontWeight: 500,
                  color: 'var(--color-muted)',
                  marginBottom: 6,
                }}
              >
                密码
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  style={{
                    width: '100%',
                    height: 44,
                    padding: '0 40px 0 12px',
                    background: 'var(--color-canvas)',
                    border: '1px solid var(--color-hairline)',
                    borderRadius: 10,
                    fontSize: 15,
                    color: 'var(--color-ink)',
                    outline: 'none',
                    transition: 'border-color 0.15s, box-shadow 0.15s',
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = 'var(--color-primary)'
                    e.currentTarget.style.boxShadow = '0 0 0 3px var(--color-primary-muted)'
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = 'var(--color-hairline)'
                    e.currentTarget.style.boxShadow = 'none'
                  }}
                  required
                  minLength={8}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: 12,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: 'var(--color-muted)',
                    cursor: 'pointer',
                    padding: 0,
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  {showPassword
                    ? (
                        <IconEyeOff size={18} />
                      )
                    : (
                        <IconEye size={18} />
                      )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={pendingIntent === 'password'}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                height: 44,
                padding: '12px 20px',
                width: '100%',
                background: 'var(--color-primary)',
                color: '#fff',
                fontSize: 15,
                fontWeight: 600,
                borderRadius: 10,
                border: 'none',
                cursor: 'pointer',
                opacity: pendingIntent === 'password' ? 0.6 : 1,
                transition: 'background 0.15s, transform 0.1s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-primary-active)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'var(--color-primary)')}
              onMouseDown={e => (e.currentTarget.style.transform = 'scale(0.98)')}
              onMouseUp={e => (e.currentTarget.style.transform = 'scale(1)')}
            >
              {pendingIntent === 'password' && <IconLoader2 size={16} className="animate-spin" />}
              {pendingIntent === 'password' ? '登录中...' : '登录'}
            </button>
          </fetcher.Form>

          {/* Footer links */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              gap: 24,
              marginTop: 20,
              fontSize: 14,
            }}
          >
            <Link to="/forgot-password" style={{ color: 'var(--color-primary)' }}>
              忘记密码？
            </Link>
            <Link to="/register" style={{ color: 'var(--color-primary)' }}>
              没有账号？去注册
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
