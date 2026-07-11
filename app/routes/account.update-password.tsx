import type { Route } from './+types/account.update-password'

import { IconEye, IconEyeOff, IconLoader2 } from '@tabler/icons-react'
import { useState } from 'react'
import { data, redirect, useFetcher, useLoaderData } from 'react-router'
import { SubPageHeader } from '~/components/page-header'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card'
import { Field, FieldError, FieldGroup, FieldLabel } from '~/components/ui/field'
import { Input } from '~/components/ui/input'
import { createSupabaseServerClient } from '~/lib/supabase.server'
import { updatePasswordSchema } from '~/lib/update-password.schema'

interface PasswordInputProps extends React.ComponentProps<typeof Input> {
  visible: boolean
  onToggleVisibility: () => void
}

function PasswordInput({ visible, onToggleVisibility, ...props }: PasswordInputProps) {
  return (
    <div className="relative">
      <Input {...props} type={visible ? 'text' : 'password'} className="pr-10" />
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground"
        aria-label={visible ? '隐藏密码' : '显示密码'}
        onClick={onToggleVisibility}
      >
        {visible ? <IconEyeOff /> : <IconEye />}
      </Button>
    </div>
  )
}

export async function loader({ request }: Route.LoaderArgs) {
  const { supabase, headers } = createSupabaseServerClient(request)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user)
    return redirect('/login', { headers })

  const requestedMode = new URL(request.url).searchParams.get('mode')
  const hasPassword = user.identities?.some(identity => identity.provider === 'email') ?? false
  if (requestedMode === 'change' && !hasPassword)
    return redirect('/settings/account', { headers })

  return data({
    mode: requestedMode === 'change' ? 'change' as const : 'recovery' as const,
    email: user.email || '',
  }, { headers })
}

export async function action({ request }: Route.ActionArgs) {
  const { supabase, headers } = createSupabaseServerClient(request)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user)
    return redirect('/login', { headers })

  const formData = await request.formData()
  const parsed = updatePasswordSchema.safeParse({
    mode: formData.get('mode'),
    oldPassword: formData.get('oldPassword') || undefined,
    password: formData.get('password'),
    confirmPassword: formData.get('confirmPassword'),
  })
  if (!parsed.success)
    return data({ error: parsed.error.issues[0].message }, { headers })

  if (parsed.data.mode === 'change') {
    if (!user.email)
      return data({ error: '当前账户没有可验证的登录邮箱' }, { headers })

    // Supabase 不提供单独的旧密码校验接口，重新登录可在改密前确认用户凭据。
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: parsed.data.oldPassword!,
    })
    if (signInError) {
      const message = signInError.message === 'Invalid login credentials' ? '旧密码不正确' : signInError.message
      return data({ error: message }, { headers })
    }
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password })
  if (error)
    return data({ error: error.message }, { headers })

  return redirect('/settings/account?passwordChanged=1', { headers })
}

export default function UpdatePasswordPage() {
  const { mode } = useLoaderData<typeof loader>()
  const fetcher = useFetcher<typeof action>()
  const [showPasswords, setShowPasswords] = useState(false)
  const isSubmitting = fetcher.state !== 'idle'
  const error = fetcher.data && 'error' in fetcher.data ? fetcher.data.error : undefined

  return (
    <div className="pb-8">
      <SubPageHeader backTo="/settings/account" backLabel="账户设置" title="修改密码" />

      <fetcher.Form method="post" className="mt-4">
        <input type="hidden" name="mode" value={mode} />
        <Card>
          <CardHeader>
            <CardTitle>{mode === 'change' ? '更新登录密码' : '设置新密码'}</CardTitle>
            <CardDescription>
              {mode === 'change' ? '验证当前密码后，设置至少 8 位的新密码。' : '为你的账户设置至少 8 位的新密码。'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              {mode === 'change' && (
                <Field>
                  <FieldLabel htmlFor="oldPassword">旧密码</FieldLabel>
                  <PasswordInput id="oldPassword" name="oldPassword" visible={showPasswords} onToggleVisibility={() => setShowPasswords(value => !value)} autoComplete="current-password" required />
                </Field>
              )}

              <Field>
                <FieldLabel htmlFor="password">新密码</FieldLabel>
                <PasswordInput id="password" name="password" visible={showPasswords} onToggleVisibility={() => setShowPasswords(value => !value)} autoComplete="new-password" minLength={8} required />
              </Field>

              <Field>
                <FieldLabel htmlFor="confirmPassword">确认新密码</FieldLabel>
                <PasswordInput id="confirmPassword" name="confirmPassword" visible={showPasswords} onToggleVisibility={() => setShowPasswords(value => !value)} autoComplete="new-password" minLength={8} required />
              </Field>

              {error && <FieldError>{error}</FieldError>}

            </FieldGroup>
          </CardContent>
        </Card>

        <Button type="submit" className="mt-4 w-full" disabled={isSubmitting}>
          {isSubmitting && <IconLoader2 data-icon="inline-start" className="animate-spin" />}
          {isSubmitting ? '更新中...' : '更新密码'}
        </Button>
      </fetcher.Form>
    </div>
  )
}
