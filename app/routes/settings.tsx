import type { Route } from './+types/settings'
import {
  IconCheck,
  IconChevronRight,
  IconDeviceDesktop,
  IconMoon,
  IconPencil,
  IconSun,
  IconX,
} from '@tabler/icons-react'
import EmojiPicker from 'emoji-picker-react'
import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import { data, Link, redirect, useFetcher, useLoaderData } from 'react-router'
import { toast } from 'sonner'
import { MainPageHeader } from '~/components/page-header'
import { PublicAvatar } from '~/components/public-avatar'
import { Button } from '~/components/ui/button'
import { Field, FieldContent } from '~/components/ui/field'
import { Input } from '~/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '~/components/ui/popover'
import {
  getSettingsCategoriesByUserId,
  getSettingsPaymentAccountsByUserId,
  getSettingsPaymentTypesByUserId,
  getSettingsProfileByUserId,
  getSettingsTagsByUserId,
  updateSettingsProfile,
} from '~/db/queries/settings'
import { createSupabaseServerClient } from '~/lib/supabase.server'

export async function loader({ request }: Route.LoaderArgs) {
  const { supabase, headers } = createSupabaseServerClient(request)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user)
    throw redirect('/login', { headers })

  const [profile, categories, tags, paymentTypes, paymentAccounts] = await Promise.all([
    getSettingsProfileByUserId(user.id),
    getSettingsCategoriesByUserId(user.id),
    getSettingsTagsByUserId(user.id),
    getSettingsPaymentTypesByUserId(user.id),
    getSettingsPaymentAccountsByUserId(user.id),
  ])

  return data({
    profile: {
      displayName: profile?.displayName?.trim() || user.user_metadata?.display_name || user.email?.split('@')[0] || '用户',
      email: profile?.email || user.email || '',
      avatarEmoji: profile?.avatarEmoji || '',
    },
    counts: {
      categories: categories.length,
      tags: tags.length,
      paymentTypes: paymentTypes.length,
      paymentAccounts: paymentAccounts.length,
    },
  }, { headers })
}

export async function action({ request }: Route.ActionArgs) {
  const { supabase, headers } = createSupabaseServerClient(request)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user)
    throw redirect('/login', { headers })

  const formData = await request.formData()
  const intent = String(formData.get('intent') || '')

  if (intent === 'update_profile') {
    const displayName = String(formData.get('displayName') || '').trim()
    const avatarEmoji = String(formData.get('avatarEmoji') || '').trim()

    if (!displayName) {
      return data({ ok: false, intent, error: '昵称不能为空' }, { headers })
    }

    if (displayName.length > 30) {
      return data({ ok: false, intent, error: '昵称最多 30 个字符' }, { headers })
    }

    await updateSettingsProfile(user.id, { displayName, avatarEmoji })

    return data({ ok: true, intent, error: undefined }, { headers })
  }

  return data({ ok: false, intent, error: '不支持的操作' }, { headers })
}

const modes = [
  { key: 'system', label: '自动', icon: IconDeviceDesktop },
  { key: 'light', label: '浅色', icon: IconSun },
  { key: 'dark', label: '深色', icon: IconMoon },
] as const

export default function SettingsPage() {
  const { profile, counts } = useLoaderData<typeof loader>()
  const profileFetcher = useFetcher<typeof action>()

  const [displayName, setDisplayName] = useState(profile.displayName)
  const [avatarEmoji, setAvatarEmoji] = useState(profile.avatarEmoji)
  const [editingDisplayName, setEditingDisplayName] = useState(false)
  const [emojiOpen, setEmojiOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const { theme, setTheme } = useTheme()

  useEffect(() => {
    setDisplayName(profile.displayName)
    setAvatarEmoji(profile.avatarEmoji)
    setEditingDisplayName(false)
  }, [profile.avatarEmoji, profile.displayName])

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (profileFetcher.data && !profileFetcher.data.ok)
      toast.error(profileFetcher.data.error)
  }, [profileFetcher.data])

  const currentTheme: 'system' | 'light' | 'dark'
    = theme === 'light' || theme === 'dark' || theme === 'system'
      ? theme
      : 'system'

  function submitProfile(displayNameValue: string, avatarEmojiValue: string) {
    const fd = new FormData()
    fd.set('intent', 'update_profile')
    fd.set('displayName', displayNameValue)
    fd.set('avatarEmoji', avatarEmojiValue)
    profileFetcher.submit(fd, { method: 'post' })
  }

  return (
    <div className="pb-8 pt-6">
      <MainPageHeader title="设置" />

      <profileFetcher.Form
        method="post"
        className="mb-8 rounded-2xl p-4"
        style={{ backgroundColor: 'var(--color-surface-card)' }}
      >
        <input type="hidden" name="intent" value="update_profile" />
        <input type="hidden" name="avatarEmoji" value={avatarEmoji} />
        {!editingDisplayName && <input type="hidden" name="displayName" value={displayName} />}

        <div className="flex items-start gap-3">
          <Popover open={emojiOpen} onOpenChange={setEmojiOpen}>
            <PopoverTrigger render={<Button size="icon-lg" variant="secondary" className="h-14 w-14 shrink-0 rounded-full p-0" />}>
              <PublicAvatar
                emoji={avatarEmoji}
                nickname={displayName || profile.displayName}
                size="xl"
                backgroundColor="var(--color-primary-muted)"
                textColor="var(--color-primary)"
                className="h-full w-full"
              />
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" side="bottom" align="start">
              <EmojiPicker
                onEmojiClick={(emojiData) => {
                  const nextEmoji = emojiData.emoji
                  setAvatarEmoji(nextEmoji)
                  const safeDisplayName = displayName.trim() || profile.displayName
                  submitProfile(safeDisplayName, nextEmoji)
                  setEmojiOpen(false)
                }}
                lazyLoadEmojis
                skinTonesDisabled
                width={320}
                height={360}
              />
            </PopoverContent>
          </Popover>

          <div className="min-w-0 flex-1">
            <Field>
              <FieldContent>
                <div className="flex items-center gap-1.5">
                  {editingDisplayName
                    ? (
                        <Input
                          name="displayName"
                          value={displayName}
                          maxLength={30}
                          onChange={e => setDisplayName(e.target.value)}
                          autoFocus
                        />
                      )
                    : (
                        <p className="flex-1">
                          {displayName}
                        </p>
                      )}
                  {editingDisplayName
                    ? (
                        <>
                          <Button
                            type="button"
                            size="icon-sm"
                            variant="ghost"
                            style={{ color: 'var(--color-primary)' }}
                            onClick={() => {
                              setEditingDisplayName(false)
                              const safeDisplayName = displayName.trim() || profile.displayName
                              submitProfile(safeDisplayName, avatarEmoji)
                            }}
                          >
                            <IconCheck />
                          </Button>
                          <Button
                            type="button"
                            size="icon-sm"
                            variant="ghost"
                            style={{ color: 'var(--color-primary)' }}
                            onClick={() => {
                              setDisplayName(profile.displayName)
                              setEditingDisplayName(false)
                            }}
                          >
                            <IconX />
                          </Button>
                        </>
                      )
                    : (
                        <Button
                          type="button"
                          size="icon-sm"
                          variant="ghost"
                          style={{ color: 'var(--color-primary)' }}
                          onClick={() => setEditingDisplayName(true)}
                        >
                          <IconPencil size={18} />
                        </Button>
                      )}
                </div>
              </FieldContent>
            </Field>
            <p className="mt-1 text-sm" style={{ color: 'var(--color-muted-soft)' }}>
              {profile.email}
            </p>
            {profileFetcher.data && !profileFetcher.data.ok && (
              <p className="mt-2 text-sm" style={{ color: 'var(--color-error)' }}>
                {profileFetcher.data.error}
              </p>
            )}
          </div>
        </div>
      </profileFetcher.Form>

      <section className="mb-8">
        <h2
          className="mb-3 text-sm font-medium uppercase tracking-wide"
          style={{ color: 'var(--color-muted-soft)' }}
        >
          账户
        </h2>
        <Link
          to="/settings/account"
          className="flex items-center justify-between rounded-2xl px-4 py-3.5 transition-colors hover:opacity-85"
          style={{ backgroundColor: 'var(--color-surface-card)' }}
        >
          <span className="text-sm" style={{ color: 'var(--color-ink)' }}>账户设置</span>
          <IconChevronRight size={18} style={{ color: 'var(--color-muted-soft)' }} />
        </Link>
      </section>

      <section className="mb-8">
        <h2
          className="mb-3 text-sm font-medium uppercase tracking-wide"
          style={{ color: 'var(--color-muted-soft)' }}
        >
          数据管理
        </h2>
        <div
          className="overflow-hidden rounded-2xl"
          style={{ backgroundColor: 'var(--color-surface-card)' }}
        >
          {[
            { label: '分类管理', to: '/settings/categories', desc: `${counts.categories} 个分类` },
            { label: '标签管理', to: '/settings/tags', desc: `${counts.tags} 个标签` },
            { label: '支付类型管理', to: '/settings/payment-types', desc: `${counts.paymentTypes} 个类型` },
            { label: '支付账户管理', to: '/settings/payment-accounts', desc: `${counts.paymentAccounts} 个账户` },
            { label: '提醒设置', to: '/settings/reminders', desc: '订阅续费 · 保修到期' },
            { label: '数据备份', to: '/settings/data', desc: '定时备份 · 导出数据' },
          ].map((item, i) => (
            <Link
              key={item.to}
              to={item.to}
              className="flex items-center justify-between px-4 py-3.5 transition-colors hover:opacity-85"
              style={{
                borderBottom:
                  i < 5 ? '1px solid var(--color-hairline)' : undefined,
              }}
            >
              <div>
                <span
                  className="block text-sm"
                  style={{ color: 'var(--color-ink)' }}
                >
                  {item.label}
                </span>
                <span className="mt-0.5 block text-xs" style={{ color: 'var(--color-muted-soft)' }}>
                  {item.desc}
                </span>
              </div>
              <IconChevronRight
                size={18}
                style={{ color: 'var(--color-muted-soft)' }}
              />
            </Link>
          ))}
        </div>
      </section>

      <section className="mb-8">
        <h2
          className="mb-3 text-sm font-medium uppercase tracking-wide"
          style={{ color: 'var(--color-muted-soft)' }}
        >
          显示
        </h2>
        <div className="rounded-2xl p-4" style={{ backgroundColor: 'var(--color-surface-card)' }}>
          <div
            className="flex gap-2 rounded-xl p-1"
            style={{ backgroundColor: 'var(--color-surface-strong)' }}
          >
            {modes.map((m) => {
              const Icon = m.icon
              const isActive = mounted ? currentTheme === m.key : m.key === 'system'
              return (
                <Button
                  key={m.key}
                  type="button"
                  onClick={() => setTheme(m.key)}
                  variant="ghost"
                  className="h-10 flex-1 gap-1.5 rounded-lg"
                  style={{
                    backgroundColor: isActive
                      ? 'var(--color-surface-card)'
                      : 'transparent',
                    color: isActive
                      ? 'var(--color-ink)'
                      : 'var(--color-muted-soft)',
                    boxShadow: isActive
                      ? '0 1px 3px rgba(0,0,0,0.08)'
                      : 'none',
                  }}
                >
                  <Icon size={16} />
                  {m.label}
                </Button>
              )
            })}
          </div>
        </div>
      </section>

    </div>
  )
}
