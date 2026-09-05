import type { Route } from './+types/assets.$id'
import { IconBell, IconCheck, IconCoin, IconLoader2, IconPencil, IconRefresh, IconShieldCheck, IconTools, IconTrash, IconTrendingUp, IconX } from '@tabler/icons-react'
import currency from 'currency.js'
import React, { useEffect, useMemo, useState } from 'react'
import { data, redirect, useActionData, useLoaderData, useNavigate, useNavigation, useSubmit } from 'react-router'
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts'
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
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '~/components/ui/chart'
import { DatePicker } from '~/components/ui/date-picker'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import {
  Field,
  FieldGroup,
  FieldLabel,
} from '~/components/ui/field'
import { Input } from '~/components/ui/input'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '~/components/ui/sheet'
import { Switch } from '~/components/ui/switch'
import { Textarea } from '~/components/ui/textarea'
import {
  createAssetValueRecord,
  createRepairRecord,
  deleteRepairRecord,
  getAssetById,
  getAssetRepairRecords,
  getAssetValueRecords,
  getAssetWarranty,
  getAssetWithTags,
  getCategoriesByUserId,
  getPaymentAccountsByUserId,
  getPaymentTypesByUserId,
  getTagsByUserId,
  getTradedFromAsset,
  getTradeToAsset,
  markAssetAsTradedIn,
  softDeleteAsset,
  softDeleteAssetValueRecord,
  updateAssetReminder,
  updateRepairRecord,
  upsertWarranty,
} from '~/db/queries/assets'
import { getSettingsProfileByUserId } from '~/db/queries/settings'
import { calculateHoldingDays, formatDaysWithYears, formatInteger, formatNumber, getAssetDetailPath, subAmount } from '~/lib/asset-meta'
import { buildAssetTimeline } from '~/lib/asset-timeline'
import { assetSaleSchema, assetValueRecordSchema, repairRecordSchema, warrantySchema } from '~/lib/asset.schema'
import { calcOneTimeDailyCost } from '~/lib/cost'
import { createSupabaseServerClient } from '~/lib/supabase.server'

export async function loader({ request, params }: Route.LoaderArgs) {
  const { supabase, headers } = createSupabaseServerClient(request)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user)
    throw redirect('/login', { headers })

  const userId = user.id
  const assetId = params.id

  const asset = await getAssetById(assetId, userId)
  if (!asset)
    throw new Response('Not Found', { status: 404 })

  if (asset.assetType === 'subscription')
    throw redirect(`/subscriptions/${asset.id}`)

  const [tagIds, warranty, repairRecords, valueRecords, allCategories, allTags, paymentTypes, paymentAccounts, tradedFromAsset, tradeToAsset, profile] = await Promise.all([
    getAssetWithTags(assetId),
    getAssetWarranty(assetId),
    getAssetRepairRecords(assetId),
    getAssetValueRecords(assetId, userId),
    getCategoriesByUserId(userId),
    getTagsByUserId(userId),
    getPaymentTypesByUserId(userId),
    getPaymentAccountsByUserId(userId),
    asset.tradedFromAssetId ? getTradedFromAsset(asset.tradedFromAssetId) : Promise.resolve(null),
    getTradeToAsset(asset.id, userId),
    getSettingsProfileByUserId(userId),
  ])

  const holdingDays = calculateHoldingDays(asset.purchaseDate, asset.tradedInAt)
  const dailyCost = asset.purchasePrice
    ? asset.tradedInAt
      ? currency(subAmount(asset.purchasePrice, asset.tradeInPrice)).divide(Math.max(1, holdingDays)).value
      : calcOneTimeDailyCost(Number(asset.purchasePrice), asset.purchaseDate || new Date().toISOString().split('T')[0])
    : 0

  return data({
    asset,
    tagIds,
    warranty,
    repairRecords,
    valueRecords,
    dailyCost,
    holdingDays,
    allCategories,
    allTags,
    paymentTypes,
    paymentAccounts,
    tradedFromAsset,
    tradeToAsset,
    globalReminderWarrantyDays: profile?.reminderWarrantyDays ?? 14,
  }, { headers })
}

export async function action({ request, params }: Route.ActionArgs) {
  const { supabase, headers } = createSupabaseServerClient(request)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user)
    throw redirect('/login', { headers })

  const formData = await request.formData()
  const intent = formData.get('intent') as string
  const assetId = params.id

  const asset = await getAssetById(assetId, user.id)
  if (!asset || asset.assetType !== 'one_time')
    throw new Response('Not Found', { status: 404, headers })

  if (intent === 'delete') {
    await softDeleteAsset(assetId, user.id)
    return redirect('/assets', { headers })
  }

  if (intent === 'sell') {
    if (asset.tradedInAt)
      return data({ ok: false, error: '该资产已卖出或换新，不能重复操作' }, { status: 400, headers })
    const parsed = assetSaleSchema.safeParse({
      tradeInPrice: String(formData.get('tradeInPrice') || ''),
      tradedInAt: String(formData.get('tradedInAt') || ''),
    })
    if (!parsed.success)
      return data({ ok: false, error: parsed.error.issues[0]?.message || '卖出信息无效' }, { status: 400, headers })
    await markAssetAsTradedIn(assetId, user.id, parsed.data.tradeInPrice, parsed.data.tradedInAt)
    return data({ ok: true }, { headers })
  }

  if (intent === 'add-repair') {
    const parsed = repairRecordSchema.safeParse({
      repairDate: String(formData.get('repairDate') || ''),
      cost: String(formData.get('cost') || '0'),
      reason: String(formData.get('reason') || '') || undefined,
      vendor: String(formData.get('vendor') || '') || undefined,
      result: String(formData.get('result') || '') || undefined,
      isDone: formData.get('isDone') === 'true',
    })
    if (!parsed.success)
      return data({ ok: false, error: parsed.error.issues[0]?.message || '维修信息无效' }, { status: 400, headers })
    await createRepairRecord({
      assetId,
      ...parsed.data,
    })
    return data({ ok: true }, { headers })
  }

  if (intent === 'update-repair') {
    const repairId = formData.get('repairId') as string
    const parsed = repairRecordSchema.safeParse({
      repairDate: formData.get('repairDate') as string,
      cost: (formData.get('cost') as string) || '0',
      reason: (formData.get('reason') as string) || undefined,
      vendor: (formData.get('vendor') as string) || undefined,
      result: (formData.get('result') as string) || undefined,
      isDone: formData.get('isDone') === 'true',
    })
    if (!repairId || !parsed.success)
      return data({ ok: false, error: parsed.success ? '维修记录不存在' : parsed.error.issues[0]?.message }, { status: 400, headers })
    const updated = await updateRepairRecord(assetId, repairId, parsed.data)
    if (!updated)
      throw new Response('Not Found', { status: 404, headers })
    return data({ ok: true }, { headers })
  }

  if (intent === 'delete-repair') {
    const repairId = formData.get('repairId') as string
    const deleted = await deleteRepairRecord(assetId, repairId)
    if (!deleted)
      throw new Response('Not Found', { status: 404, headers })
    return data({ ok: true }, { headers })
  }

  if (intent === 'add-value-record') {
    const parsed = assetValueRecordSchema.safeParse({
      value: String(formData.get('value') || ''),
      valuedOn: String(formData.get('valuedOn') || ''),
      source: String(formData.get('source') || 'manual'),
      notes: String(formData.get('notes') || '') || undefined,
    })
    if (!parsed.success)
      return data({ ok: false, error: parsed.error.issues[0]?.message || '估值记录无效' }, { status: 400, headers })
    const record = await createAssetValueRecord(assetId, user.id, parsed.data)
    if (!record)
      throw new Response('Not Found', { status: 404, headers })
    return data({ ok: true }, { headers })
  }

  if (intent === 'delete-value-record') {
    const recordId = String(formData.get('recordId') || '')
    const deleted = recordId && await softDeleteAssetValueRecord(recordId, assetId, user.id)
    if (!deleted)
      throw new Response('Not Found', { status: 404, headers })
    return data({ ok: true }, { headers })
  }

  if (intent === 'upsert-warranty') {
    const startDate = String(formData.get('startDate') || '')
    const endDate = String(formData.get('endDate') || '')
    const notes = String(formData.get('notes') || '')

    const parsed = warrantySchema.safeParse({ startDate, endDate, notes: notes || undefined })
    if (!parsed.success)
      return data({ ok: false, error: parsed.error.issues[0]?.message || '保修信息无效' }, { status: 400, headers })

    await upsertWarranty({
      assetId,
      ...parsed.data,
    })

    return data({ ok: true }, { headers })
  }

  if (intent === 'update_reminder') {
    const reminderEnabled = formData.get('reminderEnabled') === 'true'
    const daysRaw = formData.get('reminderWarrantyDaysOverride')
    const reminderWarrantyDaysOverride = daysRaw && daysRaw !== 'null' ? Number(daysRaw) : null

    await updateAssetReminder(assetId, user.id, { reminderEnabled, reminderWarrantyDaysOverride })

    return data({ ok: true }, { headers })
  }

  return data({ ok: false }, { headers })
}

export default function AssetDetailPage() {
  const {
    asset,
    tagIds,
    warranty,
    repairRecords,
    valueRecords,
    dailyCost,
    holdingDays,
    allCategories,
    allTags,
    paymentTypes,
    paymentAccounts,
    tradedFromAsset,
    tradeToAsset,
    globalReminderWarrantyDays,
  } = useLoaderData<typeof loader>()
  const actionData = useActionData<typeof action>()

  const navigate = useNavigate()
  const submit = useSubmit()
  const navigation = useNavigation()
  const isSubmitting = navigation.state === 'submitting'
  const todayDate = useMemo(() => new Date().toISOString().split('T')[0], [])

  const category = allCategories.find(c => c.id === asset.categoryId)
  const assetTags = allTags.filter(t => tagIds.includes(t.id))
  const paymentType = asset.paymentTypeId ? paymentTypes.find(p => p.id === asset.paymentTypeId) : null
  const paymentAccount = asset.paymentAccountId ? paymentAccounts.find(a => a.id === asset.paymentAccountId) : null

  const [sheetOpen, setSheetOpen] = useState(false)
  const [editingRepairId, setEditingRepairId] = useState<string | null>(null)
  const [repairDate, setRepairDate] = useState(todayDate)
  const [repairCost, setRepairCost] = useState('')
  const [repairReason, setRepairReason] = useState('')
  const [repairVendor, setRepairVendor] = useState('')
  const [repairResult, setRepairResult] = useState('')
  const [repairIsDone, setRepairIsDone] = useState(true)

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [warrantyDialogOpen, setWarrantyDialogOpen] = useState(false)
  const [warrantyStartDate, setWarrantyStartDate] = useState(warranty?.startDate || todayDate)
  const [warrantyEndDate, setWarrantyEndDate] = useState(warranty?.endDate || todayDate)
  const [warrantyNotes, setWarrantyNotes] = useState(warranty?.notes || '')
  const [sellDialogOpen, setSellDialogOpen] = useState(false)
  const [sellPrice, setSellPrice] = useState('')
  const [sellDate, setSellDate] = useState(todayDate)
  const [reminderDialogOpen, setReminderDialogOpen] = useState(false)
  const [valueDialogOpen, setValueDialogOpen] = useState(false)
  const [valueAmount, setValueAmount] = useState('')
  const [valuedOn, setValuedOn] = useState(todayDate)
  const [valueSource, setValueSource] = useState<'manual' | 'market' | 'professional'>('manual')
  const [valueNotes, setValueNotes] = useState('')
  const [deletingValueRecordId, setDeletingValueRecordId] = useState<string | null>(null)
  const [reminderEnabled, setReminderEnabled] = useState(asset.reminderEnabled ?? false)
  const [reminderWarrantyDaysOverride, setReminderWarrantyDaysOverride] = useState<number | null>(
    asset.reminderWarrantyDaysOverride ?? null,
  )
  const reminderFollowGlobal = reminderWarrantyDaysOverride === null
  const warrantyStatus = warranty ? (warranty.endDate >= todayDate ? '保修中' : '已过保') : null

  useEffect(() => {
    if (actionData && !actionData.ok && 'error' in actionData && actionData.error)
      toast.error(String(actionData.error))
  }, [actionData])

  const assetStatus = asset.tradedInAt ? (tradeToAsset ? '已换新' : '已卖出') : '持有中'
  const isTradeInOldAsset = Boolean(asset.tradedInAt && tradeToAsset)
  const isTradeInNewAsset = Boolean(tradedFromAsset)
  // const isSoldOldAsset = Boolean(asset.tradedInAt && !tradeToAsset)

  function handleDelete() {
    const fd = new FormData()
    fd.append('intent', 'delete')
    submit(fd, { method: 'post' })
  }

  function handleSell() {
    const fd = new FormData()
    fd.append('intent', 'sell')
    fd.append('tradeInPrice', sellPrice || '0')
    fd.append('tradedInAt', sellDate)
    submit(fd, { method: 'post' })
    setSellDialogOpen(false)
  }

  function handleAddRepair() {
    const fd = new FormData()
    if (editingRepairId) {
      fd.append('intent', 'update-repair')
      fd.append('repairId', editingRepairId)
    }
    else {
      fd.append('intent', 'add-repair')
    }
    fd.append('repairDate', repairDate)
    fd.append('cost', repairCost || '0')
    fd.append('reason', repairReason)
    fd.append('vendor', repairVendor)
    fd.append('result', repairResult)
    fd.append('isDone', String(repairIsDone))
    submit(fd, { method: 'post' })
    setSheetOpen(false)
    resetRepairForm()
  }

  function handleDeleteRepair(repairId: string) {
    const fd = new FormData()
    fd.append('intent', 'delete-repair')
    fd.append('repairId', repairId)
    submit(fd, { method: 'post' })
  }

  function openEditRepair(record: typeof repairRecords[number]) {
    setEditingRepairId(record.id)
    setRepairDate(record.repairDate)
    setRepairCost(record.cost ? String(record.cost) : '')
    setRepairReason(record.reason || '')
    setRepairVendor(record.vendor || '')
    setRepairResult(record.result || '')
    setRepairIsDone(record.isDone ?? true)
    setSheetOpen(true)
  }

  function handleOpenAddRepair() {
    resetRepairForm()
    setSheetOpen(true)
  }

  function handleRepairSheetOpenChange(open: boolean) {
    setSheetOpen(open)
    if (!open)
      resetRepairForm()
  }

  function resetRepairForm() {
    setEditingRepairId(null)
    setRepairDate(todayDate)
    setRepairCost('')
    setRepairReason('')
    setRepairVendor('')
    setRepairResult('')
    setRepairIsDone(true)
  }

  function handleSaveWarranty() {
    const fd = new FormData()
    fd.append('intent', 'upsert-warranty')
    fd.append('startDate', warrantyStartDate)
    fd.append('endDate', warrantyEndDate)
    fd.append('notes', warrantyNotes)
    submit(fd, { method: 'post' })
    setWarrantyDialogOpen(false)
  }

  function handleSaveReminder() {
    const fd = new FormData()
    fd.append('intent', 'update_reminder')
    fd.append('reminderEnabled', String(reminderEnabled))
    fd.append('reminderWarrantyDaysOverride', reminderFollowGlobal ? 'null' : String(reminderWarrantyDaysOverride))
    submit(fd, { method: 'post' })
    setReminderDialogOpen(false)
  }

  function handleOpenReminderDialog() {
    setReminderEnabled(asset.reminderEnabled ?? false)
    setReminderWarrantyDaysOverride(asset.reminderWarrantyDaysOverride ?? null)
    setReminderDialogOpen(true)
  }

  function handleAddValueRecord() {
    const fd = new FormData()
    fd.append('intent', 'add-value-record')
    fd.append('value', valueAmount)
    fd.append('valuedOn', valuedOn)
    fd.append('source', valueSource)
    fd.append('notes', valueNotes)
    submit(fd, { method: 'post' })
    setValueDialogOpen(false)
    setValueAmount('')
    setValueNotes('')
  }

  function handleDeleteValueRecord() {
    if (!deletingValueRecordId)
      return
    const fd = new FormData()
    fd.append('intent', 'delete-value-record')
    fd.append('recordId', deletingValueRecordId)
    submit(fd, { method: 'post' })
    setDeletingValueRecordId(null)
  }

  const basicRows: Array<{ label: string, value: React.ReactNode, primary?: boolean }> = []
  if (asset.purchasePrice)
    basicRows.push({ label: '购入价', value: formatInteger(asset.purchasePrice) })
  if (asset.currentValue !== null)
    basicRows.push({ label: '当前估价', value: formatInteger(asset.currentValue) })
  basicRows.push({ label: '每日成本', value: `${formatNumber(dailyCost)}/天`, primary: true })
  basicRows.push({ label: '持有天数', value: formatDaysWithYears(holdingDays) })
  if (paymentType)
    basicRows.push({ label: '支付类型', value: paymentType.name })
  if (paymentAccount)
    basicRows.push({ label: '支付方式', value: paymentAccount.name })
  if (category)
    basicRows.push({ label: '分类', value: `${category.emoji} ${category.name}` })
  if (asset.purchaseReceipt) {
    const isUrl = /^https?:\/\/\S+$/i.test(asset.purchaseReceipt)
    basicRows.push({
      label: '购买凭证',
      value: isUrl
        ? <a href={asset.purchaseReceipt} target="_blank" rel="noreferrer" className="break-all font-medium text-primary">查看凭证</a>
        : <span className="break-words">{asset.purchaseReceipt}</span>,
    })
  }

  const timeline = buildAssetTimeline({
    purchaseDate: asset.purchaseDate,
    tradedInAt: asset.tradedInAt,
    isTradeIn: isTradeInOldAsset,
    warranty,
    repairs: repairRecords.map(record => ({ id: record.id, repairDate: record.repairDate, reason: record.reason })),
  })

  const statusRows: Array<{ label: string, value: React.ReactNode, primary?: boolean }> = [
    {
      label: '资产状态',
      value: (
        <Badge variant="secondary" className={assetStatus === '持有中' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}>
          {assetStatus}
        </Badge>
      ),
    },
  ]
  if (asset.purchaseDate)
    statusRows.push({ label: '购买日期', value: asset.purchaseDate })

  if (isTradeInOldAsset && tradeToAsset) {
    if (asset.tradeInPrice)
      statusRows.push({ label: '回收价格', value: formatInteger(asset.tradeInPrice) })
    if (asset.tradedInAt)
      statusRows.push({ label: '回收日期', value: asset.tradedInAt })
    if (asset.purchasePrice && asset.tradeInPrice) {
      statusRows.push({
        label: '回收差值',
        value: formatInteger(subAmount(asset.purchasePrice, asset.tradeInPrice)),
      })
    }
    statusRows.push({
      label: '换新资产',
      value: (
        <button
          type="button"
          className="font-medium text-primary"
          onClick={() => navigate(getAssetDetailPath(tradeToAsset))}
        >
          {tradeToAsset.name}
        </button>
      ),
    })
    if (tradeToAsset.purchasePrice)
      statusRows.push({ label: '换新价格', value: formatInteger(tradeToAsset.purchasePrice) })
    if (tradeToAsset.purchasePrice && asset.tradeInPrice) {
      statusRows.push({
        label: '换新支付',
        value: formatInteger(subAmount(tradeToAsset.purchasePrice, asset.tradeInPrice)),
      })
    }
  }

  if (!isTradeInOldAsset) {
    if (asset.tradeInPrice)
      statusRows.push({ label: '卖出价格', value: formatInteger(asset.tradeInPrice) })
    if (asset.tradedInAt)
      statusRows.push({ label: '卖出日期', value: asset.tradedInAt })
    if (asset.purchasePrice && asset.tradeInPrice) {
      statusRows.push({
        label: '卖出差值',
        value: formatInteger(subAmount(asset.purchasePrice, asset.tradeInPrice)),
      })
    }
  }

  if (isTradeInNewAsset && tradedFromAsset) {
    statusRows.push({
      label: '回收资产',
      value: (
        <button
          type="button"
          className="font-medium text-primary"
          onClick={() => navigate(getAssetDetailPath(tradedFromAsset))}
        >
          {tradedFromAsset.name}
        </button>
      ),
    })
    if (tradedFromAsset.tradeInPrice)
      statusRows.push({ label: '回收价格', value: formatInteger(tradedFromAsset.tradeInPrice) })

    if (asset.purchasePrice && tradedFromAsset.tradeInPrice) {
      statusRows.push({
        label: '换新支付',
        value: formatInteger(subAmount(asset.purchasePrice, tradedFromAsset.tradeInPrice)),
      })
    }
  }

  return (
    <div className="pb-8">
      <SubPageHeader
        backTo="/assets"
        backLabel="返回"
        title=""
        primaryAction={{
          label: '编辑',
          icon: IconPencil,
          to: `/assets/${asset.id}/edit`,
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
          <DetailRow key={row.label} label={row.label} value={row.value} primary={row.primary} isLast={index === statusRows.length - 1} />
        ))}
      </SectionCard>

      {asset.currentValue !== null && (
        <SectionCard
          title="价值历史"
          className="mt-3"
          action={<Button type="button" size="sm" variant="ghost" onClick={() => setValueDialogOpen(true)}>记录估值</Button>}
        >
          <div className="flex items-end justify-between gap-4 py-3">
            <div>
              <div className="text-xs" style={{ color: 'var(--color-muted)' }}>当前估值</div>
              <div className="mt-1 text-2xl font-semibold tabular-nums" style={{ color: 'var(--color-ink)' }}>{formatInteger(asset.currentValue)}</div>
              {asset.purchasePrice && (
                <div className="mt-1 text-xs tabular-nums" style={{ color: 'var(--color-muted)' }}>
                  较购入价
                  {' '}
                  {currency(asset.currentValue).subtract(asset.purchasePrice).value >= 0 ? '+' : ''}
                  {formatInteger(currency(asset.currentValue).subtract(asset.purchasePrice).value)}
                </div>
              )}
            </div>
            {valueRecords[0] && (
              <time className="text-xs tabular-nums" style={{ color: 'var(--color-muted)' }}>
                更新于
                {valueRecords[0].valuedOn}
              </time>
            )}
          </div>
          {valueRecords.length > 1 && (
            <ChartContainer config={{ value: { label: '估值', color: 'var(--color-primary)' } }} className="h-48 w-full aspect-auto">
              <LineChart data={[...valueRecords].reverse()} margin={{ top: 12, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="valuedOn" tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} />
                <YAxis width="auto" tickLine={false} axisLine={false} tickMargin={8} tickFormatter={value => formatInteger(value)} domain={['dataMin', 'dataMax']} />
                <ChartTooltip content={<ChartTooltipContent labelKey="valuedOn" />} />
                <Line dataKey="value" type="monotone" stroke="var(--color-value)" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 4 }} />
              </LineChart>
            </ChartContainer>
          )}
          <div className="flex flex-col">
            {valueRecords.map((record, index) => (
              <div key={record.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 py-3" style={{ borderTop: index > 0 || valueRecords.length > 1 ? '1px solid var(--color-hairline)' : undefined }}>
                <span className="font-medium tabular-nums" style={{ color: 'var(--color-ink)' }}>{formatInteger(record.value)}</span>
                <time className="text-right text-xs tabular-nums" style={{ color: 'var(--color-muted)' }}>{record.valuedOn}</time>
                <div className="mt-1 break-words text-xs" style={{ color: 'var(--color-muted)' }}>
                  {({ manual: '手动估值', market: '市场参考', professional: '专业估值', baseline: '历史基线' })[record.source]}
                  {record.notes ? ` · ${record.notes}` : ''}
                </div>
                <Button type="button" size="icon-xs" variant="ghost" className="size-7 self-end justify-self-end text-muted-foreground" aria-label="删除估值记录" onClick={() => setDeletingValueRecordId(record.id)}>
                  <IconX className="size-3" stroke={1.5} />
                </Button>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {timeline.length > 0 && (
        <SectionCard title="资产时间线" className="mt-3">
          <div className="flex flex-col">
            {timeline.map((event, index) => (
              <div key={event.id} className="flex gap-3 py-3" style={{ borderBottom: index < timeline.length - 1 ? '1px solid var(--color-hairline)' : undefined }}>
                <span className="mt-1 size-2 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-sm font-medium" style={{ color: 'var(--color-ink)' }}>{event.label}</span>
                    <time className="shrink-0 text-xs tabular-nums" style={{ color: 'var(--color-muted)' }}>{event.date}</time>
                  </div>
                  {event.detail && <p className="mt-1 break-words text-xs" style={{ color: 'var(--color-muted)' }}>{event.detail}</p>}
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {warranty && (
        <SectionCard title="保修" className="mt-3" action={<span onClick={() => setWarrantyDialogOpen(true)}>编辑保修</span>}>
          <DetailRow
            label="状态"
            value={(
              <Badge variant="secondary" className={warrantyStatus === '保修中' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}>
                {warrantyStatus}
              </Badge>
            )}
          />
          <DetailRow label="保修开始" value={warranty.startDate} />
          <DetailRow label="保修结束" value={warranty.endDate} />
          {warranty.notes && <DetailRow label="备注" value={warranty.notes} />}
          <DetailRow
            label="保修提醒"
            value={(
              <span className="flex items-center gap-1">
                {asset.reminderEnabled
                  ? (
                      <>
                        <IconBell size={14} className="text-primary" />
                        {' '}
                        {asset.reminderWarrantyDaysOverride ?? globalReminderWarrantyDays}
                        天前
                      </>
                    )
                  : <span style={{ color: 'var(--color-muted-soft)' }}>已关闭</span>}
              </span>
            )}
            isLast
          />
        </SectionCard>
      )}

      {repairRecords.length > 0 && (
        <SectionCard
          title="维修信息"
          className="mt-3"
          action={(
            <button type="button" className="cursor-pointer" onClick={handleOpenAddRepair}>
              添加维修
            </button>
          )}
        >
          {repairRecords.map((record, index) => (
            <div key={record.id} className={`py-3 ${index < repairRecords.length - 1 ? 'border-b' : ''}`} style={{ borderColor: 'var(--color-hairline)' }}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center gap-2">
                    <span className="text-[13px]" style={{ color: 'var(--color-muted)' }}>{record.repairDate}</span>
                    <Badge variant="secondary" className={record.isDone ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}>
                      {record.isDone ? '已完成' : '处理中'}
                    </Badge>
                  </div>
                  <div className="space-y-1 text-[13px]" style={{ color: 'var(--color-ink)' }}>
                    <div>
                      原因：
                      {record.reason || '未填写'}
                    </div>
                    <div>
                      维修商：
                      {record.vendor || '未填写'}
                    </div>
                    <div>
                      维修结果：
                      {record.result || '未填写'}
                    </div>
                    <div>
                      费用：
                      {formatInteger(record.cost || 0)}
                    </div>
                  </div>

                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-primary"
                    onClick={() => openEditRepair(record)}
                    aria-label="编辑维修"
                  >
                    <IconPencil size={16} />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => handleDeleteRepair(record.id)}
                    aria-label="删除维修"
                  >
                    <IconTrash size={16} />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </SectionCard>
      )}

      <Sheet open={sheetOpen} onOpenChange={handleRepairSheetOpenChange}>
        <SheetContent side="bottom" className="rounded-t-xl">
          <SheetHeader className="pb-1">
            <SheetTitle>{editingRepairId ? '编辑维修' : '添加维修'}</SheetTitle>
          </SheetHeader>
          <FieldGroup className="mt-2 px-4 pb-8">
            <Field>
              <FieldLabel>维修日期</FieldLabel>
              <DatePicker value={repairDate} onChange={setRepairDate} />
            </Field>
            <Field>
              <FieldLabel>维修费用</FieldLabel>
              <Input type="number" step="0.01" placeholder="请输入维修费用" value={repairCost} onChange={e => setRepairCost(e.target.value)} />
            </Field>
            <Field>
              <FieldLabel>维修原因</FieldLabel>
              <Input placeholder="请输入维修原因" value={repairReason} onChange={e => setRepairReason(e.target.value)} />
            </Field>
            <Field>
              <FieldLabel>维修商</FieldLabel>
              <Input placeholder="请输入维修商" value={repairVendor} onChange={e => setRepairVendor(e.target.value)} />
            </Field>
            <Field>
              <FieldLabel>维修结果</FieldLabel>
              <Input placeholder="请输入维修结果" value={repairResult} onChange={e => setRepairResult(e.target.value)} />
            </Field>
            <Field>
              <FieldLabel>已完成</FieldLabel>
              <div className="flex h-11 items-center justify-between rounded-md border px-3">
                <span className="text-sm">状态</span>
                <Switch checked={repairIsDone} onCheckedChange={setRepairIsDone} />
              </div>
            </Field>
            <Button className="h-10 text-[13px]" variant="default" onClick={handleAddRepair} disabled={isSubmitting}>
              {isSubmitting && <IconLoader2 size={14} className="animate-spin" />}
              {!isSubmitting && <IconCheck size={14} data-icon="inline-start" />}
              保存
            </Button>
          </FieldGroup>
        </SheetContent>
      </Sheet>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button size="sm" className="h-10 text-[13px]" variant="secondary" onClick={() => setValueDialogOpen(true)}>
          <IconTrendingUp className="size-3.5" data-icon="inline-start" />
          记录估值
        </Button>
        {!warranty && (
          <Button size="sm" className="h-10 text-[13px]" variant="secondary" onClick={() => setWarrantyDialogOpen(true)}>
            <IconShieldCheck className="size-3.5" data-icon="inline-start" />
            编辑保修
          </Button>
        )}
        {repairRecords.length === 0 && (
          <Button size="sm" className="h-10 text-[13px]" variant="secondary" onClick={handleOpenAddRepair}>
            <IconTools className="size-3.5" data-icon="inline-start" />
            添加维修
          </Button>
        )}
        <Button size="sm" className="h-10 text-[13px]" variant="secondary" onClick={() => navigate(`/assets/${asset.id}/edit`)}>
          <IconPencil className="size-3.5" data-icon="inline-start" />
          编辑资产
        </Button>
        <Button size="sm" className="h-10 text-[13px]" variant="secondary" onClick={handleOpenReminderDialog}>
          <IconBell className="size-3.5" data-icon="inline-start" />
          提醒设置
        </Button>
        {!asset.tradedInAt && (
          <Button size="sm" className="h-10 text-[13px]" variant="secondary" onClick={() => setSellDialogOpen(true)}>
            <IconCoin className="size-3.5" data-icon="inline-start" />
            卖出资产
          </Button>
        )}
        {!asset.tradedInAt && (
          <Button size="sm" className="h-10 text-[13px]" variant="secondary" onClick={() => navigate(`/assets/${asset.id}/trade-in`)}>
            <IconRefresh className="size-3.5" data-icon="inline-start" />
            以旧换新
          </Button>
        )}
        <Button size="sm" className="h-10 text-[13px]" variant="destructive" onClick={() => setDeleteDialogOpen(true)}>
          <IconTrash className="size-3.5" data-icon="inline-start" />
          删除资产
        </Button>
      </div>

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
            <AlertDialogAction className="h-10" variant="destructive" onClick={handleDelete}>
              <IconTrash size={14} data-icon="inline-start" />
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={Boolean(deletingValueRecordId)} onOpenChange={open => !open && setDeletingValueRecordId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除估值记录</AlertDialogTitle>
            <AlertDialogDescription>删除后，当前估值会回退到上一条有效记录；此操作不会删除资产。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel variant="secondary">取消</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleDeleteValueRecord}>删除记录</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={valueDialogOpen} onOpenChange={setValueDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>记录资产估值</DialogTitle>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel>估值金额</FieldLabel>
              <Input type="number" min="0" step="0.01" inputMode="decimal" value={valueAmount} onChange={event => setValueAmount(event.target.value)} placeholder="0.00" />
            </Field>
            <Field>
              <FieldLabel>估值日期</FieldLabel>
              <DatePicker value={valuedOn} onChange={setValuedOn} />
            </Field>
            <Field>
              <FieldLabel>估值来源</FieldLabel>
              <Select
                items={[
                  { label: '手动估值', value: 'manual' },
                  { label: '市场参考', value: 'market' },
                  { label: '专业估值', value: 'professional' },
                ]}
                value={valueSource}
                onValueChange={value => value && setValueSource(value as typeof valueSource)}
              >
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="manual">手动估值</SelectItem>
                    <SelectItem value="market">市场参考</SelectItem>
                    <SelectItem value="professional">专业估值</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel>备注</FieldLabel>
              <Textarea value={valueNotes} onChange={event => setValueNotes(event.target.value)} placeholder="可选，例如参考平台或成色说明" />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setValueDialogOpen(false)}>取消</Button>
            <Button onClick={handleAddValueRecord} disabled={isSubmitting || !valueAmount || !valuedOn}>
              {isSubmitting && <IconLoader2 className="animate-spin" data-icon="inline-start" />}
              保存估值
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={warrantyDialogOpen} onOpenChange={setWarrantyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑保修</DialogTitle>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel>开始日期</FieldLabel>
              <DatePicker value={warrantyStartDate} onChange={setWarrantyStartDate} />
            </Field>
            <Field>
              <FieldLabel>结束日期</FieldLabel>
              <DatePicker value={warrantyEndDate} onChange={setWarrantyEndDate} />
            </Field>
            <Field>
              <FieldLabel>备注</FieldLabel>
              <Textarea placeholder="请输入保修备注" value={warrantyNotes} onChange={e => setWarrantyNotes(e.target.value)} />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button className="h-10" variant="secondary" onClick={() => setWarrantyDialogOpen(false)}>
              <IconX size={14} data-icon="inline-start" />
              取消
            </Button>
            <Button className="h-10" variant="default" onClick={handleSaveWarranty} disabled={isSubmitting}>
              <IconCheck size={14} data-icon="inline-start" />
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={sellDialogOpen} onOpenChange={setSellDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>卖出资产</DialogTitle>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel>卖出价格</FieldLabel>
              <Input type="number" step="0.01" placeholder="请输入卖出价格" value={sellPrice} onChange={e => setSellPrice(e.target.value)} />
            </Field>
            <Field>
              <FieldLabel>卖出日期</FieldLabel>
              <DatePicker value={sellDate} onChange={setSellDate} />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button className="h-10" variant="secondary" onClick={() => setSellDialogOpen(false)}>
              <IconX size={14} data-icon="inline-start" />
              取消
            </Button>
            <Button className="h-10" variant="default" onClick={handleSell} disabled={isSubmitting}>
              <IconCheck size={14} data-icon="inline-start" />
              确认
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={reminderDialogOpen} onOpenChange={setReminderDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>保修提醒设置</DialogTitle>
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
                  value={reminderFollowGlobal ? 'global' : String(reminderWarrantyDaysOverride)}
                  onValueChange={(v) => {
                    if (v === 'global') {
                      setReminderWarrantyDaysOverride(null)
                    }
                    else {
                      setReminderWarrantyDaysOverride(Number(v))
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue>
                      {value => value === 'global' ? `跟随全局（${globalReminderWarrantyDays}天）` : `${value} 天前`}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="global">
                      跟随全局（
                      {globalReminderWarrantyDays}
                      天）
                    </SelectItem>
                    <SelectItem value="7">7 天前</SelectItem>
                    <SelectItem value="14">14 天前</SelectItem>
                    <SelectItem value="30">30 天前</SelectItem>
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
    </div>
  )
}

function SectionCard({
  title,
  action,
  className,
  children,
}: {
  title?: string
  action?: React.ReactNode
  className?: string
  children: React.ReactNode
}) {
  return (
    <section className={className}>
      {title && (
        <div className="flex items-center justify-between mb-2">
          <h3 className=" text-[15px] font-semibold" style={{ color: 'var(--color-ink)' }}>{title}</h3>
          <span className="text-[12px]  text-primary">{action}</span>
        </div>
      )}
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
