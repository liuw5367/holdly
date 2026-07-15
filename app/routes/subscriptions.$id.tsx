import type { Route } from './+types/subscriptions.$id'
import { IconBell, IconCheck, IconLoader2, IconPencil, IconPlayerPlay, IconPlayerStop, IconRepeat, IconTrash, IconX } from '@tabler/icons-react'
import { addMonths, addYears, format } from 'date-fns'
import { useEffect, useMemo, useState } from 'react'
import { data, redirect, useActionData, useLoaderData, useNavigate, useNavigation, useSearchParams, useSubmit } from 'react-router'
import { toast } from 'sonner'
import { SubPageHeader } from '~/components/page-header'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '~/components/ui/alert-dialog'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { DatePicker } from '~/components/ui/date-picker'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import { Field, FieldGroup, FieldLabel } from '~/components/ui/field'
import { Input } from '~/components/ui/input'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select'
import { Switch } from '~/components/ui/switch'
import { Textarea } from '~/components/ui/textarea'
import {
  createRenewal,
  getAssetById,
  getAssetWithTags,
  getCategoriesByUserId,
  getPaymentAccountsByUserId,
  getPaymentTypesByUserId,
  getSubscriptionRenewals,
  getTagsByUserId,
  resumeSubscription,
  softDeleteAsset,
  stopSubscription,
  updateSubscriptionReminder,
} from '~/db/queries/assets'
import { getSettingsProfileByUserId } from '~/db/queries/settings'
import { calculateAssetDurationDays, formatDaysWithYears, formatInteger, formatNumber, getBillingCycleLabel } from '~/lib/asset-meta'
import { calcSubscriptionDailyCost } from '~/lib/cost'
import { createSupabaseServerClient } from '~/lib/supabase.server'

export async function loader({ request, params }: Route.LoaderArgs) {
  const { supabase, headers } = createSupabaseServerClient(request)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user)
    throw redirect('/login', { headers })

  const asset = await getAssetById(params.id, user.id)
  if (!asset)
    throw new Response('Not Found', { status: 404 })

  if (asset.assetType !== 'subscription')
    throw redirect(`/assets/${asset.id}`)

  const [tagIds, allCategories, allTags, paymentTypes, paymentAccounts, profile] = await Promise.all([
    getAssetWithTags(asset.id),
    getCategoriesByUserId(user.id),
    getTagsByUserId(user.id),
    getPaymentTypesByUserId(user.id),
    getPaymentAccountsByUserId(user.id),
    getSettingsProfileByUserId(user.id),
  ])

  const renewals = await getSubscriptionRenewals(asset.id)
  const latestRenewal = renewals[0] || null

  const ended = asset.subscriptionStatus === 'cancelled' || Boolean(asset.subscriptionStoppedAt)
  const holdingDays = calculateAssetDurationDays({
    assetType: 'subscription',
    purchaseDate: asset.purchaseDate,
    subscriptionStartDate: asset.subscriptionStartDate,
    subscriptionStoppedAt: asset.subscriptionStoppedAt,
    ended,
  })
  const dailyCost = asset.subscriptionPrice && asset.billingCycle
    ? calcSubscriptionDailyCost(Number(asset.subscriptionPrice), asset.billingCycle)
    : 0

  return data({
    asset,
    tagIds,
    allCategories,
    allTags,
    paymentTypes,
    paymentAccounts,
    holdingDays,
    dailyCost,
    globalReminderSubscriptionDays: profile?.reminderSubscriptionDays ?? 7,
    latestRenewal: latestRenewal
      ? { startDate: latestRenewal.startDate, price: latestRenewal.price }
      : null,
    renewals,
  }, { headers })
}

export async function action({ request, params }: Route.ActionArgs) {
  const { supabase, headers } = createSupabaseServerClient(request)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user)
    throw redirect('/login', { headers })

  const formData = await request.formData()
  const intent = String(formData.get('intent') || '')

  const ownedAsset = await getAssetById(params.id, user.id)
  if (!ownedAsset || ownedAsset.assetType !== 'subscription')
    throw new Response('Not Found', { status: 404, headers })

  if (intent === 'cancel') {
    const stoppedAt = String(formData.get('stoppedAt') || '')
    await stopSubscription(params.id, user.id, stoppedAt)
    return data({ ok: true }, { headers })
  }

  if (intent === 'resume') {
    await resumeSubscription(params.id, user.id)
    return data({ ok: true }, { headers })
  }

  if (intent === 'delete') {
    await softDeleteAsset(params.id, user.id)
    return redirect('/assets', { headers })
  }

  if (intent === 'update_reminder') {
    const reminderEnabled = formData.get('reminderEnabled') === 'true'
    const daysRaw = formData.get('reminderSubscriptionDaysOverride')
    const reminderSubscriptionDaysOverride = daysRaw && daysRaw !== 'null' ? Number(daysRaw) : null

    await updateSubscriptionReminder(params.id, user.id, { reminderEnabled, reminderSubscriptionDaysOverride })

    return data({ ok: true }, { headers })
  }

  if (intent === 'renew') {
    const asset = ownedAsset
    if (asset.subscriptionStatus === 'cancelled')
      return data({ ok: false, error: '已取消的订阅无法续费' }, { headers })

    const price = String(formData.get('price') || '')
    const notes = String(formData.get('notes') || '').trim()
    const updateExpectedPrice = formData.get('updateExpectedPrice') === 'true'

    if (!price || Number(price) <= 0)
      return data({ ok: false, error: '金额必须大于 0' }, { headers })
    const result = await createRenewal(params.id, user.id, { price, notes: notes || undefined, updateExpectedPrice })
    if (result.status === 'duplicate')
      return data({ ok: false, error: '这个周期已经确认过续费' }, { status: 409, headers })
    if (result.status === 'invalid')
      return data({ ok: false, error: '订阅状态或下次续费日期无效' }, { status: 400, headers })

    return data({ ok: true }, { headers })
  }

  return data({ ok: false }, { headers })
}

export default function SubscriptionDetailPage() {
  const {
    asset,
    tagIds,
    allCategories,
    allTags,
    paymentTypes,
    paymentAccounts,
    holdingDays,
    dailyCost,
    globalReminderSubscriptionDays,
    latestRenewal,
    renewals,
  } = useLoaderData<typeof loader>()
  const actionData = useActionData<typeof action>()
  const [searchParams, setSearchParams] = useSearchParams()

  const navigate = useNavigate()
  const submit = useSubmit()
  const navigation = useNavigation()
  const isSubmitting = navigation.state === 'submitting'
  const todayDate = useMemo(() => new Date().toISOString().split('T')[0], [])

  const category = allCategories.find(c => c.id === asset.categoryId)
  const assetTags = allTags.filter(t => tagIds.includes(t.id))
  const paymentType = asset.paymentTypeId ? paymentTypes.find(p => p.id === asset.paymentTypeId) : null
  const paymentAccount = asset.paymentAccountId ? paymentAccounts.find(a => a.id === asset.paymentAccountId) : null
  const nextRenewalDate = asset.nextRenewalDate

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
  const [cancelDate, setCancelDate] = useState(todayDate)
  const [reminderDialogOpen, setReminderDialogOpen] = useState(false)
  const [reminderEnabled, setReminderEnabled] = useState(asset.reminderEnabled ?? false)
  const [reminderSubscriptionDaysOverride, setReminderSubscriptionDaysOverride] = useState<number | null>(
    asset.reminderSubscriptionDaysOverride ?? null,
  )
  const reminderFollowGlobal = reminderSubscriptionDaysOverride === null
  const [renewDialogOpen, setRenewDialogOpen] = useState(false)
  const [renewPrice, setRenewPrice] = useState(asset.subscriptionPrice || '')
  const [renewNotes, setRenewNotes] = useState('')
  const [updateExpectedPrice, setUpdateExpectedPrice] = useState(true)

  useEffect(() => {
    if (actionData && !actionData.ok && 'error' in actionData && actionData.error)
      toast.error(String(actionData.error))
  }, [actionData])

  useEffect(() => {
    if (searchParams.get('renew') === '1') {
      setRenewDialogOpen(true)
      setSearchParams({}, { replace: true })
    }
  }, [searchParams, setSearchParams])

  const renewStartDate = nextRenewalDate
  const periodEndDate = renewStartDate && asset.billingCycle
    ? (() => {
        const d = new Date(`${renewStartDate}T00:00:00`)
        if (asset.billingCycle === 'monthly')
          return format(addMonths(d, 1), 'yyyy-MM-dd')
        if (asset.billingCycle === 'quarterly')
          return format(addMonths(d, 3), 'yyyy-MM-dd')
        return format(addYears(d, 1), 'yyyy-MM-dd')
      })()
    : null

  function onCancel() {
    const fd = new FormData()
    fd.append('intent', 'cancel')
    fd.append('stoppedAt', cancelDate)
    submit(fd, { method: 'post' })
    setCancelDialogOpen(false)
  }

  function onResume() {
    const fd = new FormData()
    fd.append('intent', 'resume')
    submit(fd, { method: 'post' })
  }

  function onDelete() {
    const fd = new FormData()
    fd.append('intent', 'delete')
    submit(fd, { method: 'post' })
  }

  function handleSaveReminder() {
    const fd = new FormData()
    fd.append('intent', 'update_reminder')
    fd.append('reminderEnabled', String(reminderEnabled))
    fd.append('reminderSubscriptionDaysOverride', reminderFollowGlobal ? 'null' : String(reminderSubscriptionDaysOverride))
    submit(fd, { method: 'post' })
    setReminderDialogOpen(false)
  }

  function handleOpenReminderDialog() {
    setReminderEnabled(asset.reminderEnabled ?? false)
    setReminderSubscriptionDaysOverride(asset.reminderSubscriptionDaysOverride ?? null)
    setReminderDialogOpen(true)
  }

  function handleOpenRenewDialog() {
    setRenewPrice(asset.subscriptionPrice || '')
    setRenewNotes('')
    setUpdateExpectedPrice(true)
    setRenewDialogOpen(true)
  }

  function onRenew() {
    if (!renewStartDate || !renewPrice || Number(renewPrice) <= 0)
      return
    const fd = new FormData()
    fd.append('intent', 'renew')
    fd.append('price', renewPrice)
    fd.append('notes', renewNotes)
    fd.append('updateExpectedPrice', String(updateExpectedPrice))
    submit(fd, { method: 'post' })
    setRenewDialogOpen(false)
  }

  const ended = asset.subscriptionStatus === 'cancelled' || Boolean(asset.subscriptionStoppedAt)

  const subscriptionCost = dailyCost * holdingDays

  const basicRows = [
    asset.billingCycle ? { label: '订阅周期', value: getBillingCycleLabel(asset.billingCycle) } : null,
    asset.subscriptionPrice ? { label: '订阅金额', value: formatInteger(asset.subscriptionPrice) } : null,
    { label: '每日成本', value: `${formatNumber(dailyCost)}/天`, primary: true },
    nextRenewalDate ? { label: '下次续费日期', value: nextRenewalDate } : null,
    latestRenewal ? { label: '最近续费', value: `${latestRenewal.startDate} · ${formatInteger(latestRenewal.price)}` } : null,
    paymentType ? { label: '支付类型', value: paymentType.name } : null,
    paymentAccount
      ? { label: '支付方式', value: `${paymentAccount.bankName ? `${paymentAccount.bankName} · ` : ''}${paymentAccount.name}${paymentAccount.lastFour ? ` · ${paymentAccount.lastFour}` : ''}` }
      : null,
    category ? { label: '分类', value: `${category.emoji} ${category.name}` } : null,
    {
      label: '续费提醒',
      value: (
        <span className="flex items-center gap-1">
          {asset.reminderEnabled
            ? (
                <>
                  <IconBell size={14} className="text-primary" />
                  {' '}
                  {asset.reminderSubscriptionDaysOverride ?? globalReminderSubscriptionDays}
                  天前
                </>
              )
            : <span style={{ color: 'var(--color-muted-soft)' }}>已关闭</span>}
        </span>
      ),
    },
  ].filter(Boolean) as Array<{ label: string, value: React.ReactNode, primary?: boolean }>

  const statusRows = [
    {
      label: '订阅状态',
      value: (
        <Badge variant="secondary" className={ended ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}>
          {ended ? '已取消' : '订阅中'}
        </Badge>
      ),
    },
    asset.subscriptionStartDate || asset.purchaseDate
      ? { label: '订阅日期', value: asset.subscriptionStartDate || asset.purchaseDate || '' }
      : null,
    { label: '订阅天数', value: formatDaysWithYears(holdingDays) },
    { label: '订阅花费', value: formatInteger(subscriptionCost), primary: true },
    ended && asset.subscriptionStoppedAt
      ? { label: '取消日期', value: asset.subscriptionStoppedAt }
      : null,
  ].filter(Boolean) as Array<{ label: string, value: React.ReactNode, primary?: boolean }>

  return (
    <div className="pb-8">
      <SubPageHeader
        backTo="/assets"
        backLabel="返回"
        title=""
        primaryAction={{
          label: '编辑',
          icon: IconPencil,
          to: `/subscriptions/${asset.id}/edit`,
        }}
      />

      <div className="py-3 text-center">
        <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-xl bg-[var(--color-surface-soft)] text-[30px]">{asset.emoji}</div>
        <div className="text-[20px] font-semibold" style={{ color: 'var(--color-ink)' }}>{asset.name}</div>
        {assetTags.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
            {assetTags.map(tag => (
              <Badge key={tag.id} className="rounded-full" style={{ background: `${tag.color}22`, color: tag.color }}>{tag.name}</Badge>
            ))}
          </div>
        )}
      </div>

      <SectionCard>
        {basicRows.map((row, index) => (
          <DetailRow key={row.label} label={row.label} value={row.value} primary={row.primary} isLast={index === basicRows.length - 1} />
        ))}
      </SectionCard>

      <SectionCard title="状态" className="mt-3">
        {statusRows.map((row, index) => (
          <DetailRow key={`${row.label}-${index}`} label={row.label} value={row.value} primary={row.primary} isLast={index === statusRows.length - 1} />
        ))}
      </SectionCard>

      {renewals.length > 0 && (
        <SectionCard title="续费历史" className="mt-3">
          {renewals.map((renewal, index) => (
            <div key={renewal.id} className="py-3" style={{ borderBottom: index < renewals.length - 1 ? '1px solid var(--color-hairline)' : undefined }}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-medium tabular-nums" style={{ color: 'var(--color-ink)' }}>{formatInteger(renewal.price)}</span>
                <time className="text-xs tabular-nums" style={{ color: 'var(--color-muted)' }}>{renewal.startDate}</time>
              </div>
              <div className="mt-1 text-xs" style={{ color: 'var(--color-muted)' }}>
                {getBillingCycleLabel(renewal.billingCycle)}
                {renewal.notes ? ` · ${renewal.notes}` : ''}
              </div>
            </div>
          ))}
        </SectionCard>
      )}

      {!ended && (
        <Button className="mt-4 h-10 w-full text-[13px]" variant="default" onClick={handleOpenRenewDialog}>
          <IconRepeat size={14} data-icon="inline-start" />
          记录续费
        </Button>
      )}

      <div className="mt-2 grid grid-cols-2 gap-2">
        <Button className="h-10 text-[13px]" variant="default" onClick={() => navigate(`/subscriptions/${asset.id}/edit`)}>
          <IconPencil size={14} data-icon="inline-start" />
          编辑订阅
        </Button>
        <Button className="h-10 text-[13px]" variant="default" onClick={handleOpenReminderDialog}>
          <IconBell size={14} data-icon="inline-start" />
          提醒设置
        </Button>
        {ended
          ? (
              <Button className="h-10 text-[13px]" variant="default" onClick={onResume} disabled={isSubmitting}>
                {isSubmitting && <IconLoader2 size={14} className="animate-spin" />}
                {!isSubmitting && <IconPlayerPlay size={14} data-icon="inline-start" />}
                恢复订阅
              </Button>
            )
          : (
              <Button className="h-10 text-[13px]" variant="default" onClick={() => setCancelDialogOpen(true)}>
                <IconPlayerStop size={14} data-icon="inline-start" />
                取消订阅
              </Button>
            )}
        <Button className="h-10 text-[13px]" variant="destructive" onClick={() => setDeleteDialogOpen(true)}>
          <IconTrash size={14} data-icon="inline-start" />
          删除订阅
        </Button>
      </div>

      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>取消订阅</DialogTitle>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel>取消日期</FieldLabel>
              <DatePicker value={cancelDate} onChange={setCancelDate} />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button className="h-10" variant="secondary" onClick={() => setCancelDialogOpen(false)}>
              <IconX size={14} data-icon="inline-start" />
              取消
            </Button>
            <Button className="h-10" variant="default" onClick={onCancel} disabled={isSubmitting}>
              {isSubmitting && <IconLoader2 size={14} className="animate-spin" />}
              {!isSubmitting && <IconCheck size={14} data-icon="inline-start" />}
              确认取消
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={reminderDialogOpen} onOpenChange={setReminderDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>续费提醒设置</DialogTitle>
          </DialogHeader>
          <FieldGroup>
            <Field orientation="horizontal" className="justify-between">
              <FieldLabel>开启提醒</FieldLabel>
              <Switch checked={reminderEnabled} onCheckedChange={setReminderEnabled} />
            </Field>
            {reminderEnabled && (
              <Field>
                <FieldLabel>提醒时间</FieldLabel>
                <Select
                  value={reminderFollowGlobal ? 'global' : String(reminderSubscriptionDaysOverride)}
                  onValueChange={(v) => {
                    if (v === 'global') {
                      setReminderSubscriptionDaysOverride(null)
                    }
                    else {
                      setReminderSubscriptionDaysOverride(Number(v))
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue>
                      {value => value === 'global' ? `跟随全局（${globalReminderSubscriptionDays}天）` : `${value} 天前`}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="global">
                        跟随全局（
                        {globalReminderSubscriptionDays}
                        天）
                      </SelectItem>
                      <SelectItem value="3">3 天前</SelectItem>
                      <SelectItem value="7">7 天前</SelectItem>
                      <SelectItem value="14">14 天前</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
            )}
          </FieldGroup>
          <DialogFooter>
            <Button className="h-10" variant="secondary" onClick={() => setReminderDialogOpen(false)}>
              <IconX size={14} data-icon="inline-start" />
              取消
            </Button>
            <Button className="h-10" variant="default" onClick={handleSaveReminder} disabled={isSubmitting}>
              {isSubmitting && <IconLoader2 size={14} className="animate-spin" />}
              {!isSubmitting && <IconCheck size={14} data-icon="inline-start" />}
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={renewDialogOpen} onOpenChange={setRenewDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>记录续费</DialogTitle>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel>续费金额</FieldLabel>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={renewPrice}
                onChange={e => setRenewPrice(e.target.value)}
              />
            </Field>
            {asset.billingCycle && (
              <Field orientation="horizontal" className="justify-between">
                <FieldLabel>计费周期</FieldLabel>
                <span className="text-sm" style={{ color: 'var(--color-ink)' }}>{getBillingCycleLabel(asset.billingCycle)}</span>
              </Field>
            )}
            {renewStartDate && periodEndDate && (
              <Field orientation="horizontal" className="justify-between">
                <FieldLabel>本次周期</FieldLabel>
                <span className="text-sm" style={{ color: 'var(--color-ink)' }}>
                  {renewStartDate}
                  {' → '}
                  {periodEndDate}
                </span>
              </Field>
            )}
            {periodEndDate && (
              <Field orientation="horizontal" className="justify-between">
                <FieldLabel>下次续费日期</FieldLabel>
                <span className="text-sm font-medium" style={{ color: 'var(--color-primary)' }}>{periodEndDate}</span>
              </Field>
            )}
            <Field orientation="horizontal" className="justify-between">
              <div>
                <FieldLabel>更新后续预计价格</FieldLabel>
                <p className="mt-1 text-xs" style={{ color: 'var(--color-muted)' }}>临时优惠或一次性补扣时可以关闭</p>
              </div>
              <Switch checked={updateExpectedPrice} onCheckedChange={setUpdateExpectedPrice} />
            </Field>
            <Field>
              <FieldLabel>备注</FieldLabel>
              <Textarea value={renewNotes} onChange={event => setRenewNotes(event.target.value)} placeholder="可选，例如涨价、优惠或补扣说明" />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button className="h-10" variant="secondary" onClick={() => setRenewDialogOpen(false)}>
              <IconX size={14} data-icon="inline-start" />
              取消
            </Button>
            <Button className="h-10" variant="default" onClick={onRenew} disabled={isSubmitting || !renewPrice || Number(renewPrice) <= 0}>
              {isSubmitting && <IconLoader2 size={14} className="animate-spin" />}
              {!isSubmitting && <IconCheck size={14} data-icon="inline-start" />}
              确认续费
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除「
              {asset.name}
              」吗？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-10" variant="secondary">
              <IconX size={14} data-icon="inline-start" />
              取消
            </AlertDialogCancel>
            <AlertDialogAction className="h-10" variant="destructive" onClick={onDelete}>
              <IconTrash size={14} data-icon="inline-start" />
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function SectionCard({
  title,
  className,
  children,
}: {
  title?: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <section className={className}>
      {title && <h3 className="mb-2 text-[15px] font-semibold" style={{ color: 'var(--color-ink)' }}>{title}</h3>}
      <div className="rounded-xl border px-4" style={{ borderColor: 'var(--color-hairline)', background: 'var(--color-surface-card)' }}>
        {children}
      </div>
    </section>
  )
}

function DetailRow({
  label,
  value,
  primary,
  isLast,
}: {
  label: string
  value: React.ReactNode
  primary?: boolean
  isLast?: boolean
}) {
  return (
    <div className={`flex items-center justify-between py-3 ${isLast ? '' : 'border-b'}`} style={{ borderColor: 'var(--color-hairline)' }}>
      <span className="text-[14px]" style={{ color: 'var(--color-muted)' }}>{label}</span>
      <span className="text-[15px] font-medium" style={{ color: primary ? 'var(--color-primary)' : 'var(--color-ink)' }}>{value}</span>
    </div>
  )
}
