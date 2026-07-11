import type { Route } from './+types/settings.account'

import { IconChevronRight, IconLoader2, IconLock, IconLogout, IconMail } from '@tabler/icons-react'
import { useEffect } from 'react'
import { data, Link, redirect, useFetcher, useLoaderData, useNavigate, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { SubPageHeader } from '~/components/page-header'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card'
import { createSupabaseServerClient } from '~/lib/supabase.server'

export async function loader({ request }: Route.LoaderArgs) {
  const { supabase, headers } = createSupabaseServerClient(request)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user)
    throw redirect('/login', { headers })

  return data({
    email: user.email || '',
    hasPassword: user.identities?.some(identity => identity.provider === 'email') ?? false,
  }, { headers })
}

export async function action({ request }: Route.ActionArgs) {
  const { supabase, headers } = createSupabaseServerClient(request)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user)
    throw redirect('/login', { headers })

  const formData = await request.formData()
  const intent = String(formData.get('intent') || '')

  if (intent === 'logout') {
    await supabase.auth.signOut()
    return redirect('/login', { headers })
  }

  if (intent === 'send_password_email' && user.email) {
    const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
      redirectTo: `${new URL(request.url).origin}/auth/callback?next=${encodeURIComponent('/account/update-password')}`,
    })
    if (error)
      return data({ success: false, error: error.message }, { headers })

    // OAuth-only 账户通过邮件建立密码，PKCE verifier 必须随响应写入 cookie。
    return data({ success: true, error: undefined }, { headers })
  }

  return data({ success: false, error: '不支持的操作' }, { headers })
}

export default function AccountSettingsPage() {
  const { email, hasPassword } = useLoaderData<typeof loader>()
  const passwordFetcher = useFetcher<typeof action>()
  const logoutFetcher = useFetcher<typeof action>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  useEffect(() => {
    if (searchParams.get('passwordChanged') === '1') {
      toast.success('密码修改成功')
      void navigate('/settings/account', { replace: true })
    }
  }, [navigate, searchParams])

  useEffect(() => {
    if (passwordFetcher.data?.success)
      toast.success('密码设置邮件已发送，请查看邮箱')
    else if (passwordFetcher.data?.error)
      toast.error(passwordFetcher.data.error)
  }, [passwordFetcher.data])

  const isSendingPasswordEmail = passwordFetcher.state !== 'idle'
  const isLoggingOut = logoutFetcher.state !== 'idle'

  return (
    <div className="pb-8">
      <SubPageHeader backTo="/settings" backLabel="设置" title="账户设置" />

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>登录账户</CardTitle>
          <CardDescription>管理登录邮箱和密码。</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center gap-3 rounded-xl bg-primary/10 p-3">
            <IconMail className="text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground">登录邮箱</p>
              <p className="truncate text-sm font-medium">{email}</p>
            </div>
          </div>

          {hasPassword
            ? (
                <Link
                  to="/account/update-password?mode=change"
                  className="flex items-center gap-3 rounded-xl border border-border p-3 transition-colors hover:bg-primary/15"
                >
                  <IconLock className="text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">修改密码</p>
                    <p className="text-xs text-muted-foreground">验证旧密码后设置新密码</p>
                  </div>
                  <IconChevronRight className="text-muted-foreground" />
                </Link>
              )
            : (
                <passwordFetcher.Form method="post">
                  <input type="hidden" name="intent" value="send_password_email" />
                  <Button type="submit" variant="outline" className="w-full" disabled={isSendingPasswordEmail}>
                    {isSendingPasswordEmail ? <IconLoader2 data-icon="inline-start" className="animate-spin" /> : <IconMail data-icon="inline-start" />}
                    发送密码设置邮件
                  </Button>
                </passwordFetcher.Form>
              )}
        </CardContent>
      </Card>

      <logoutFetcher.Form method="post" className="mt-8">
        <input type="hidden" name="intent" value="logout" />
        <Button type="submit" variant="destructive" className="w-full" disabled={isLoggingOut}>
          {isLoggingOut ? <IconLoader2 data-icon="inline-start" className="animate-spin" /> : <IconLogout data-icon="inline-start" />}
          退出登录
        </Button>
      </logoutFetcher.Form>
    </div>
  )
}
