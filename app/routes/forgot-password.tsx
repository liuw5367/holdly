import type { Route } from './+types/forgot-password'

import { data, Link, useFetcher } from 'react-router'
import { forgotPasswordSchema } from '~/lib/auth.schema'
import { createSupabaseServerClient } from '~/lib/supabase.server'

export async function action({ request }: Route.ActionArgs) {
  const { supabase, headers } = createSupabaseServerClient(request)
  const formData = await request.formData()

  const raw = { email: formData.get('email') }
  const parsed = forgotPasswordSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${new URL(request.url).origin}/auth/callback?next=${encodeURIComponent('/account/update-password')}`,
  })

  if (error) {
    return { error: error.message }
  }

  // 保留 SSR 客户端写入的认证 cookie；恢复邮件通过 token_hash 完成跨浏览器回调。
  return data({ success: true }, { headers })
}

export default function ForgotPassword() {
  const fetcher = useFetcher<{ error?: string, success?: boolean }>()
  const isSubmitting = fetcher.state !== 'idle'

  if (fetcher.data?.success) {
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
              background: 'var(--color-surface-card)',
              borderRadius: 16,
              padding: 24,
            }}
          >
            <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--color-ink)' }}>
              重置链接已发送
            </p>
            <p style={{ fontSize: 14, color: 'var(--color-muted)', marginTop: 8 }}>
              请查看你的邮箱，点击链接重置密码。
            </p>
            <Link to="/login">
              <button
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: 44,
                  padding: '12px 20px',
                  width: '100%',
                  marginTop: 16,
                  background: 'var(--color-primary)',
                  color: '#fff',
                  fontSize: 15,
                  fontWeight: 600,
                  borderRadius: 10,
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'background 0.15s, transform 0.1s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-primary-active)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'var(--color-primary)')}
                onMouseDown={e => (e.currentTarget.style.transform = 'scale(0.98)')}
                onMouseUp={e => (e.currentTarget.style.transform = 'scale(1)')}
              >
                返回登录
              </button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

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
          重置密码
        </div>
        <p style={{ fontSize: 13, color: 'var(--color-muted)', marginBottom: 32 }}>
          输入注册邮箱，我们会发送重置链接到你的邮箱。
        </p>

        {/* Auth group */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, textAlign: 'left' }}>
          {/* Error */}
          {fetcher.data?.error && (
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
              {fetcher.data.error}
            </div>
          )}

          <fetcher.Form method="post" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
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
                注册邮箱
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

            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
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
                opacity: isSubmitting ? 0.6 : 1,
                transition: 'background 0.15s, transform 0.1s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-primary-active)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'var(--color-primary)')}
              onMouseDown={e => (e.currentTarget.style.transform = 'scale(0.98)')}
              onMouseUp={e => (e.currentTarget.style.transform = 'scale(1)')}
            >
              {isSubmitting ? '发送中...' : '发送重置链接'}
            </button>
          </fetcher.Form>

          {/* Footer */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              gap: 24,
              marginTop: 20,
              fontSize: 14,
            }}
          >
            <Link to="/login" style={{ color: 'var(--color-primary)' }}>
              返回登录
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
