import type { Route } from './+types/plans.$id'
import type { ChartConfig } from '~/components/ui/chart'
import {
  IconPencil,
  IconPlus,
  IconTrash,
  IconTrendingDown,
  IconTrendingUp,
} from '@tabler/icons-react'
import { useMemo, useState } from 'react'
import { data, Form, Link, redirect, useActionData, useLoaderData, useNavigation, useSubmit } from 'react-router'
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { SubPageHeader } from '~/components/page-header'
import { PlanInvitePanel } from '~/components/plan-invite-panel'
import { PublicAvatar } from '~/components/public-avatar'
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
import { Button } from '~/components/ui/button'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '~/components/ui/chart'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import {
  getActiveInviteLink,
  getPlanDetailById,
  regenerateInviteLink,
  revokeInviteLink,
  softDeletePlan,
} from '~/db/queries/plans'
import { buildPlanAvatarToneMap } from '~/lib/plan-avatar'
import { createSupabaseServerClient } from '~/lib/supabase.server'

const trendChartConfig = {
  netValue: {
    label: '净值',
    color: 'var(--color-primary)',
  },
  netIncome: {
    label: '净收入',
    color: 'var(--color-primary)',
  },
  annualNetIncome: {
    label: '年度净收入',
    color: 'var(--color-primary)',
  },
} satisfies ChartConfig

type TrendMetric = 'netValue' | 'netIncome' | 'annual'

function currentMonthKey() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function formatTrendYAxis(value: number) {
  const trimZeros = (n: number) => n.toFixed(2).replace(/\.?0+$/, '')
  const num = Number(value) || 0
  const sign = num < 0 ? '-' : ''
  const abs = Math.abs(num)
  if (abs >= 10000)
    return `${sign}${trimZeros(abs / 10000)}w`
  if (abs >= 1000)
    return `${sign}${trimZeros(abs / 1000)}k`
  return `${num}`
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const { supabase, headers } = createSupabaseServerClient(request)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user)
    throw redirect('/login', { headers })

  const detail = await getPlanDetailById(params.id, user.id)
  if (!detail)
    throw new Response('Not Found', { status: 404 })

  const origin = new URL(request.url).origin
  const activeInvite = detail.canManage ? await getActiveInviteLink(params.id, user.id) : null

  return data({
    ...detail,
    inviteLink: activeInvite ? `${origin}/plans/invite/${activeInvite.token}` : null,
    inviteExpiresAt: activeInvite?.expiresAt?.toISOString() || null,
  }, { headers })
}

export async function action({ request, params }: Route.ActionArgs) {
  const { supabase, headers } = createSupabaseServerClient(request)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user)
    throw redirect('/login', { headers })

  const formData = await request.formData()
  const intent = formData.get('intent')

  if (intent === 'delete-plan') {
    await softDeletePlan(params.id, user.id)
    return redirect('/plans', { headers })
  }

  if (intent === 'regenerate-invite') {
    const origin = new URL(request.url).origin
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    const { token } = await regenerateInviteLink(params.id, user.id, expiresAt)
    return data({
      ok: true,
      intent,
      inviteLink: `${origin}/plans/invite/${token}`,
      inviteExpiresAt: expiresAt.toISOString(),
    }, { headers })
  }

  if (intent === 'revoke-invite') {
    await revokeInviteLink(params.id, user.id)
    return data({
      ok: true,
      intent,
      inviteLink: null,
      inviteExpiresAt: null,
    }, { headers })
  }

  return data(null, { headers })
}

export default function PlansDetail() {
  const detail = useLoaderData<typeof loader>()
  const actionData = useActionData<typeof action>()
  const navigation = useNavigation()
  const submit = useSubmit()
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [trendMetric, setTrendMetric] = useState<TrendMetric>('netValue')

  const isSubmittingDelete = navigation.state !== 'idle'
    && navigation.formData?.get('intent') === 'delete-plan'

  const currentMonth = currentMonthKey()
  const memberToneMap = useMemo(
    () => buildPlanAvatarToneMap(detail.members.map(member => member.userId)),
    [detail.members],
  )
  const memberNameMap = useMemo(
    () => new Map(detail.members.map(member => [member.userId, member.displayName])),
    [detail.members],
  )
  const availableYears = useMemo(
    () => [...new Set(detail.records.map(record => record.year))].sort((a, b) => b - a),
    [detail.records],
  )
  const [selectedYear, setSelectedYear] = useState<string>(
    () => availableYears.length > 0 ? String(availableYears[0]) : 'all',
  )
  const filteredRecords = useMemo(
    () => selectedYear === 'all'
      ? detail.records
      : detail.records.filter(record => String(record.year) === selectedYear),
    [detail.records, selectedYear],
  )
  const annualNetIncome = useMemo(
    () => selectedYear === 'all'
      ? null
      : filteredRecords.reduce((sum, record) => sum + record.netIncome, 0),
    [filteredRecords, selectedYear],
  )
  const planModeLabel = detail.planMode === 'snapshot' ? '总额记录' : '收支累加'
  const trendData = useMemo(() => {
    const netIncomeByMonth = new Map(
      detail.records.map(record => [`${record.year}-${String(record.month).padStart(2, '0')}`, record.netIncome]),
    )

    return detail.trend.map((point) => {
      const monthNumber = String(Number(point.month.split('-')[1] || '0'))
      return {
        ...point,
        monthNumber,
        netValue: point.amount,
        netIncome: netIncomeByMonth.get(point.month) ?? 0,
      }
    })
  }, [detail.records, detail.trend])
  const annualData = useMemo(() => {
    const yearMap = new Map<number, number>()
    for (const record of detail.records) {
      yearMap.set(record.year, (yearMap.get(record.year) ?? 0) + record.netIncome)
    }
    const years = [...yearMap.keys()].sort((a, b) => b - a).slice(0, 6).reverse()
    return years.map(year => ({
      year,
      yearShort: String(year).slice(-2),
      annualNetIncome: yearMap.get(year) ?? 0,
    }))
  }, [detail.records])
  const trendDataKey: TrendMetric = trendMetric === 'netIncome' ? 'netIncome' : 'netValue'
  const inviteLink = actionData && 'inviteLink' in actionData ? actionData.inviteLink : detail.inviteLink
  const inviteExpiresAt = actionData && 'inviteExpiresAt' in actionData ? actionData.inviteExpiresAt : detail.inviteExpiresAt
  const inviteIntent = navigation.formData?.get('intent')
  const isRegeneratingInvite = navigation.state !== 'idle' && inviteIntent === 'regenerate-invite'
  const isRevokingInvite = navigation.state !== 'idle' && inviteIntent === 'revoke-invite'

  function submitIntent(intent: string) {
    const fd = new FormData()
    fd.set('intent', intent)
    submit(fd, { method: 'post' })
  }

  return (
    <div className="pb-8">
      <SubPageHeader
        backTo="/plans"
        backLabel="返回"
        title=""
        primaryAction={detail.canManage
          ? {
              label: '编辑',
              icon: IconPencil,
              to: `/plans/${detail.id}/edit`,
            }
          : undefined}
        moreItems={detail.canManage
          ? [{
              label: '删除计划',
              icon: IconTrash,
              variant: 'destructive',
              onClick: () => setDeleteDialogOpen(true),
            }]
          : undefined}
      />

      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="text-3xl">{detail.emoji}</span>
          <h1
            className="truncate font-[family-name:var(--font-display)] text-2xl"
            style={{ color: 'var(--color-ink)' }}
          >
            {detail.name}
          </h1>
        </div>
        <span
          className="shrink-0 rounded-md px-2.5 py-1 text-xs font-medium"
          style={{
            background: 'var(--color-primary-muted)',
            color: 'var(--color-primary)',
          }}
        >
          {planModeLabel}
        </span>
      </div>

      <div className="mb-4">
        <div className="mb-2 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="text-xs font-medium" style={{ color: 'var(--color-muted)' }}>
              成员
            </div>
            <span
              className="rounded-md px-2 py-0.5 text-[11px] font-medium"
              style={{
                background: 'var(--color-primary-muted)',
                color: 'var(--color-primary)',
              }}
            >
              {detail.permission === 'own' ? '仅编辑自己' : '可编辑全部'}
            </span>
          </div>
          {detail.canManage && (
            <PlanInvitePanel
              inviteLink={inviteLink}
              inviteExpiresAt={inviteExpiresAt}
              isRegenerating={isRegeneratingInvite}
              isRevoking={isRevokingInvite}
              onRegenerateInvite={() => submitIntent('regenerate-invite')}
              onRevokeInvite={() => submitIntent('revoke-invite')}
            />
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {detail.members.map(member => (
            <div
              key={member.userId}
              className="flex items-center gap-2 rounded-full px-2.5 py-1"
              style={{ background: 'var(--color-surface-soft)' }}
              title={member.note || undefined}
            >
              <PublicAvatar
                emoji={member.avatarEmoji}
                nickname={member.displayName}
                size="sm"
                backgroundColor={memberToneMap.get(member.userId)?.backgroundColor}
                textColor={memberToneMap.get(member.userId)?.textColor}
              />
              <span className="text-sm" style={{ color: 'var(--color-body)' }}>
                {member.note.trim() || member.displayName}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="mb-6">
        <div className="mb-2 text-xs font-medium" style={{ color: 'var(--color-muted)' }}>
          默认项目
        </div>
        <div className="flex flex-wrap gap-1.5">
          {detail.defaultItems.map(item => (
            <span
              key={item.id}
              className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium"
              style={{
                background: item.itemType === 'income' ? 'var(--color-success)' : 'var(--color-error)',
                color: '#fff',
                opacity: 0.85,
              }}
            >
              {item.name}
            </span>
          ))}
          {detail.defaultItems.length === 0 && (
            <span className="text-xs" style={{ color: 'var(--color-muted)' }}>
              暂无默认项目
            </span>
          )}
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3">
        <div
          className="rounded-xl border p-4"
          style={{
            background: 'var(--color-surface-card)',
            borderColor: 'var(--color-hairline)',
          }}
        >
          <div className="mb-1 text-xs" style={{ color: 'var(--color-muted)' }}>
            最近净收入
          </div>
          <div
            className="font-[family-name:var(--font-mono)] text-xl font-semibold"
            style={{ color: (detail.records[0]?.netIncome ?? 0) > 0 ? 'var(--color-success)' : 'var(--color-error)' }}
          >
            {(detail.records[0]?.netIncome ?? 0).toLocaleString()}
          </div>
        </div>
        <div
          className="rounded-xl border p-4"
          style={{
            background: 'var(--color-surface-card)',
            borderColor: 'var(--color-hairline)',
          }}
        >
          <div className="mb-1 text-xs" style={{ color: 'var(--color-muted)' }}>
            当前总额
          </div>
          <div
            className="font-[family-name:var(--font-mono)] text-xl font-semibold"
            style={{ color: 'var(--color-ink)' }}
          >
            {(detail.records[0]?.totalValue ?? detail.startingValue).toLocaleString()}
          </div>
        </div>
      </div>

      <div
        className="mb-6 rounded-xl border px-4 pb-4 pt-2"
        style={{
          background: 'var(--color-surface-card)',
          borderColor: 'var(--color-hairline)',
        }}
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="text-xs font-medium" style={{ color: 'var(--color-muted)' }}>
            {trendMetric === 'annual' ? '年度净收入（近6年）' : '净值趋势（最近12个月）'}
          </div>
          <div
            className="inline-flex items-center rounded-md border p-0.5"
            style={{ borderColor: 'var(--color-hairline)' }}
          >
            <Button
              type="button"
              size="sm"
              variant={trendMetric === 'netValue' ? 'default' : 'ghost'}
              className="h-6 px-2 text-xs"
              onClick={() => setTrendMetric('netValue')}
            >
              净值
            </Button>
            <Button
              type="button"
              size="sm"
              variant={trendMetric === 'netIncome' ? 'default' : 'ghost'}
              className="h-6 px-2 text-xs"
              onClick={() => setTrendMetric('netIncome')}
            >
              净收入
            </Button>
            <Button
              type="button"
              size="sm"
              variant={trendMetric === 'annual' ? 'default' : 'ghost'}
              className="h-6 px-2 text-xs"
              onClick={() => setTrendMetric('annual')}
            >
              年度
            </Button>
          </div>
        </div>
        {trendMetric === 'annual'
          ? (
              <ChartContainer config={trendChartConfig} className="aspect-video h-[180px] w-full">
                <AreaChart data={annualData} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="fillAnnual" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0.01} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="yearShort" tickLine={false} axisLine={false} tickMargin={8} fontSize={11} />
                  <YAxis tickLine={false} axisLine={false} tickMargin={8} fontSize={11} width={52} tickFormatter={value => formatTrendYAxis(Number(value))} />
                  <ChartTooltip
                    content={(
                      <ChartTooltipContent
                        formatter={(value) => {
                          const num = typeof value === 'number' ? value : Number(value)
                          return `${num.toLocaleString()} 元`
                        }}
                      />
                    )}
                  />
                  <Area
                    dataKey="annualNetIncome"
                    type="monotone"
                    fill="url(#fillAnnual)"
                    stroke="var(--color-primary)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ChartContainer>
            )
          : (
              <ChartContainer config={trendChartConfig} className="aspect-video h-[180px] w-full">
                <AreaChart data={trendData} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="fillPlanAmount" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={`var(--color-${trendDataKey})`} stopOpacity={0.15} />
                      <stop offset="95%" stopColor={`var(--color-${trendDataKey})`} stopOpacity={0.01} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="monthNumber" tickLine={false} axisLine={false} tickMargin={8} fontSize={11} />
                  <YAxis tickLine={false} axisLine={false} tickMargin={8} fontSize={11} width={52} tickFormatter={value => formatTrendYAxis(Number(value))} />
                  <ChartTooltip
                    content={(
                      <ChartTooltipContent
                        formatter={(value) => {
                          const num = typeof value === 'number' ? value : Number(value)
                          return `${num.toLocaleString()} 元`
                        }}
                      />
                    )}
                  />
                  <Area
                    dataKey={trendDataKey}
                    type="monotone"
                    fill="url(#fillPlanAmount)"
                    stroke={`var(--color-${trendDataKey})`}
                    strokeWidth={2}
                  />
                </AreaChart>
              </ChartContainer>
            )}
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-medium" style={{ color: 'var(--color-ink)' }}>
              月度记录
            </h2>
            {availableYears.length > 0 && (
              <Select value={selectedYear} onValueChange={v => setSelectedYear(v ?? 'all')}>
                <SelectTrigger className="w-auto text-xs" style={{ height: 26, padding: '0px 8px' }}>
                  <SelectValue placeholder="全部">{value => value === 'all' ? '全部' : `${value}年`}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="all">全部</SelectItem>
                    {availableYears.map(year => (
                      <SelectItem key={year} value={String(year)}>
                        {year}
                        年
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            )}
          </div>
          <Link
            to={`/plans/${detail.id}/records/${currentMonth}/edit?blank=1`}
            className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors"
            style={{
              background: 'var(--color-primary-muted)',
              color: 'var(--color-primary)',
            }}
          >
            <IconPlus size={14} />
            添加记录
          </Link>
        </div>

        <div className="flex flex-col gap-2.5">
          {annualNetIncome !== null && (
            <div
              className="flex items-center justify-between rounded-lg px-3 py-2 text-xs"
              style={{ background: 'var(--color-surface-soft)' }}
            >
              <span style={{ color: 'var(--color-muted)' }}>
                {selectedYear}
                年收入
              </span>
              <span
                className="font-semibold"
                style={{ color: annualNetIncome >= 0 ? 'var(--color-success)' : 'var(--color-error)' }}
              >
                {annualNetIncome >= 0 ? '+' : ''}
                {annualNetIncome.toLocaleString()}
              </span>
            </div>
          )}
          {filteredRecords.map((record) => {
            const monthStr = `${record.year}-${String(record.month).padStart(2, '0')}`
            const netIncome = record.netIncome
            const isUp = netIncome > 0
            const isDown = netIncome < 0
            const mergedNote = record.memberNotes
              .map((note) => {
                const noteText = note.note.trim()
                if (!noteText)
                  return null
                const memberName = memberNameMap.get(note.memberId)?.trim()
                return memberName ? `${memberName}：${noteText}` : noteText
              })
              .filter((note): note is string => Boolean(note))
              .join('；')
            return (
              <div
                key={record.id}
                className="flex overflow-hidden rounded-xl border"
                style={{
                  background: 'var(--color-surface-card)',
                  borderColor: 'var(--color-hairline)',
                }}
              >
                <Link
                  to={`/plans/${detail.id}/records/${monthStr}`}
                  className="block min-w-0 flex-1 p-4 transition-shadow hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-sm font-medium" style={{ color: 'var(--color-ink)' }}>
                      {record.year}
                      年
                      {record.month}
                      月
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      {isUp && <IconTrendingUp size={16} style={{ color: 'var(--color-success)' }} />}
                      {isDown && <IconTrendingDown size={16} style={{ color: 'var(--color-error)' }} />}
                      {isUp
                        ? (
                            <span className="font-semibold" style={{ color: 'var(--color-success)' }}>
                              +
                              {netIncome.toLocaleString()}
                            </span>
                          )
                        : isDown
                          ? (
                              <span className="font-semibold" style={{ color: 'var(--color-error)' }}>
                                {netIncome.toLocaleString()}
                              </span>
                            )
                          : (
                              <span className="font-semibold" style={{ color: 'var(--color-muted)' }}>
                                —
                                {' '}
                                0
                              </span>
                            )}
                    </span>
                  </div>
                  <div
                    className="mb-2 font-[family-name:var(--font-mono)] text-lg font-semibold"
                    style={{ color: 'var(--color-ink)' }}
                  >
                    {record.totalValue.toLocaleString()}
                  </div>
                  <div className="flex min-w-0 items-end justify-between gap-4">
                    <div className="flex gap-4 text-xs">
                      <span style={{ color: 'var(--color-success)' }}>
                        收入
                        {' '}
                        {record.totalIncome.toLocaleString()}
                      </span>
                      <span style={{ color: 'var(--color-error)' }}>
                        支出
                        {' '}
                        {record.totalExpense.toLocaleString()}
                      </span>
                    </div>

                    <span
                      className="min-w-0 truncate text-right text-xs"
                      style={{ color: 'var(--color-muted)' }}
                      title={mergedNote || undefined}
                    >
                      {mergedNote}
                    </span>
                  </div>
                </Link>
                <Link
                  to={`/plans/${detail.id}/records/${monthStr}/edit`}
                  className="flex w-12 shrink-0 items-center justify-center border-l transition-colors hover:bg-[var(--color-surface-soft)]"
                  style={{ color: 'var(--color-primary)', borderColor: 'var(--color-hairline)' }}
                  aria-label="编辑月记录"
                  title="编辑月记录"
                >
                  <IconPencil size={18} />
                </Link>
              </div>
            )
          })}
          {filteredRecords.length === 0 && (
            <div className="rounded-xl border p-6 text-center text-sm" style={{ borderColor: 'var(--color-hairline)', color: 'var(--color-muted)' }}>
              暂无记录，点击"添加本月记录"开始。
            </div>
          )}
        </div>
        {detail.records.length > 0 && (
          <div className="mt-2 text-center text-xs" style={{ color: 'var(--color-muted)' }}>
            共
            {' '}
            {filteredRecords.length}
            {' '}
            条
          </div>
        )}
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除计划</AlertDialogTitle>
            <AlertDialogDescription>
              删除后不可恢复，计划下所有月度记录将一并隐藏。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel variant="secondary" className="h-10">
              取消
            </AlertDialogCancel>
            <Form method="post" className="w-full sm:w-auto">
              <input type="hidden" name="intent" value="delete-plan" />
              <AlertDialogAction type="submit" variant="destructive" className="h-10 w-full" disabled={isSubmittingDelete}>
                {isSubmittingDelete ? '删除中...' : '确认删除'}
              </AlertDialogAction>
            </Form>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
