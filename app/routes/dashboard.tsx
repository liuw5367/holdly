import type { Route } from './+types/dashboard'
import type { ChartConfig } from '~/components/ui/chart'
import { IconBell, IconBellOff, IconX } from '@tabler/icons-react'
import { useEffect, useState } from 'react'
import { data as loaderDataFn, redirect, useLoaderData, useNavigate, useSearchParams } from 'react-router'
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { toast } from 'sonner'
import { MainPageHeader } from '~/components/page-header'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '~/components/ui/chart'
import { ToggleGroup, ToggleGroupItem } from '~/components/ui/toggle-group'
import { getDashboardData } from '~/db/queries/dashboard'
import { formatCurrencyGroups, getStatsModel } from '~/lib/dashboard-view'
import { createSupabaseServerClient } from '~/lib/supabase.server'

export async function loader({ request }: Route.LoaderArgs) {
  const { supabase, headers } = createSupabaseServerClient(request)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user)
    throw redirect('/login', { headers })

  const result = await getDashboardData(user.id)
  return loaderDataFn(result, { headers })
}

const trendChartConfig = {
  amount: {
    label: '持有成本',
    color: 'var(--color-primary)',
  },
} satisfies ChartConfig

export default function Dashboard() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const data = useLoaderData<typeof loader>()
  const [showWarning, setShowWarning] = useState(true)

  const statsModel = getStatsModel(searchParams)
  const { kpiByType, statsByType, expiring } = data
  const categorySpending = statsByType[statsModel].categorySpending
  const monthlyTrend = statsByType[statsModel].monthlyTrend

  useEffect(() => {
    if (searchParams.get('registered') !== '1')
      return

    toast.success('注册成功，欢迎来到 Holdly')
    const nextParams = new URLSearchParams(searchParams)
    nextParams.delete('registered')
    setSearchParams(nextParams, { replace: true })
  }, [searchParams, setSearchParams])

  const oneTimeKpi = kpiByType.one_time
  const subscriptionKpi = kpiByType.subscription
  const kpis: Array<{ label: string, value: string, subtitle: string }> = statsModel === 'one_time'
    ? [
        { label: '持有中买断', value: String(oneTimeKpi.activeCount), subtitle: '当前仍在持有的买断资产' },
        { label: '今日持有成本', value: `¥${oneTimeKpi.dailyCostTotal.toFixed(2)}`, subtitle: '按当前持有天数折算' },
        { label: '持有资产原值', value: `¥${oneTimeKpi.purchaseTotal.toLocaleString()}`, subtitle: '持有中买断资产购入价' },
        { label: '近一年持有成本', value: `¥${oneTimeKpi.yearlyCostTotal.toLocaleString()}`, subtitle: '过去 365 天累计成本' },
      ]
    : [
        { label: '活动订阅', value: String(subscriptionKpi.activeCount), subtitle: '当前仍在生效的订阅' },
        { label: '月度预计', value: formatCurrencyGroups(subscriptionKpi.monthlyCostByCurrency), subtitle: '按订阅周期折算' },
        { label: '年度预计', value: formatCurrencyGroups(subscriptionKpi.yearlyCostByCurrency), subtitle: '按订阅周期折算' },
        {
          label: '需关注',
          value: String(subscriptionKpi.attentionCount),
          subtitle: `${subscriptionKpi.attentionDetail.overdue} 逾期 · ${subscriptionKpi.attentionDetail.sevenDays} 七天内 · ${subscriptionKpi.attentionDetail.thirtyDays} 三十天内`,
        },
      ]

  const statsToggle = (
    <ToggleGroup
      value={[statsModel]}
      onValueChange={(values) => {
        const nextModel = values[0]
        if (nextModel !== 'one_time' && nextModel !== 'subscription')
          return
        const nextParams = new URLSearchParams(searchParams)
        if (nextModel === 'subscription')
          nextParams.set('model', 'subscription')
        else
          nextParams.delete('model')
        setSearchParams(nextParams, { replace: true })
      }}
      className="rounded-md border border-[var(--color-hairline)] p-0.5"
      variant="default"
      size="sm"
      spacing={0}
      aria-label="统计类型"
    >
      <ToggleGroupItem
        value="one_time"
        aria-label="查看买断统计"
        className="h-6 min-w-0 px-2 text-xs"
        style={{ borderRadius: 'var(--radius-md)' }}
      >
        买断
      </ToggleGroupItem>
      <ToggleGroupItem
        value="subscription"
        aria-label="查看订阅统计"
        className="h-6 min-w-0 px-2 text-xs"
        style={{ borderRadius: 'var(--radius-md)' }}
      >
        订阅
      </ToggleGroupItem>
    </ToggleGroup>
  )

  return (
    <div className="pt-6 pb-8">
      {/* Warning Banner */}
      {showWarning && expiring.length > 0 && (
        <div
          className="mb-6 flex items-center gap-3 rounded-lg px-4 py-3 text-[13px]"
          style={{
            background: 'rgba(212,160,23,0.1)',
            borderLeft: '3px solid var(--color-warning)',
            color: 'var(--color-body)',
          }}
        >
          <span className="flex-1">
            <span style={{ color: 'var(--color-warning)' }}>⚠️</span>
            {' '}
            {expiring[0].name}
            {' '}
            {expiring[0].detail}
          </span>
          <button
            onClick={() => setShowWarning(false)}
            className="shrink-0 rounded p-0.5 transition-opacity hover:opacity-70"
            style={{ color: 'var(--color-muted)' }}
          >
            <IconX size={16} />
          </button>
        </div>
      )}

      {/* Page Header */}
      <MainPageHeader title="统计总览" trailing={statsToggle} />

      {/* KPI Grid */}
      <div className="mb-8 grid grid-cols-2 gap-3">
        {kpis.map(kpi => (
          <div
            key={kpi.label}
            className="rounded-xl px-4 py-3.5"
            style={{ background: 'var(--color-surface-card)' }}
          >
            <div className="text-[12px]" style={{ color: 'var(--color-muted)' }}>
              {kpi.label}
            </div>
            <div
              className="mt-1 font-[family-name:var(--font-display)] text-[26px] font-semibold leading-tight"
              style={{ color: 'var(--color-ink)' }}
            >
              {kpi.value}
            </div>
            <div className="mt-0.5 text-[11px]" style={{ color: 'var(--color-muted-soft)' }}>
              {kpi.subtitle}
            </div>
          </div>
        ))}
      </div>

      {/* Category Spending */}
      <section className="mb-8">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2
            className="text-[15px] font-medium"
            style={{ color: 'var(--color-ink)' }}
          >
            近一年成本分布
          </h2>
        </div>
        <div
          className="rounded-xl px-4 py-4"
          style={{ background: 'var(--color-surface-card)' }}
        >
          {categorySpending.length > 0
            ? (
                <div className="flex flex-col gap-3">
                  {categorySpending.map(cat => (
                    <div key={cat.name} className="flex items-center gap-3">
                      <span className="w-[96px] shrink-0 whitespace-nowrap text-[13px]" style={{ color: 'var(--color-body)' }}>
                        {cat.emoji}
                        {' '}
                        {cat.name}
                      </span>
                      <div className="flex-1">
                        <div
                          className="h-[10px] w-full overflow-hidden rounded-full"
                          style={{ background: 'var(--color-surface-strong)' }}
                        >
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${cat.percent}%`, background: cat.color }}
                          />
                        </div>
                      </div>
                      <span className="w-[56px] shrink-0 text-right text-[13px]" style={{ color: 'var(--color-body)' }}>
                        ¥
                        {cat.amount.toLocaleString()}
                      </span>
                      <span className="w-[36px] shrink-0 text-right text-[12px]" style={{ color: 'var(--color-muted-soft)' }}>
                        {cat.percent}
                        %
                      </span>
                    </div>
                  ))}
                </div>
              )
            : (
                <div className="py-2 text-center text-[13px]" style={{ color: 'var(--color-muted-soft)' }}>
                  暂无可统计数据
                </div>
              )}
        </div>
      </section>

      {/* Monthly Trend */}
      <section className="mb-8">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2
            className="text-[15px] font-medium"
            style={{ color: 'var(--color-ink)' }}
          >
            近六个月成本趋势
          </h2>
        </div>
        <div
          className="rounded-xl px-4 py-4"
          style={{ background: 'var(--color-surface-card)' }}
        >
          <ChartContainer config={trendChartConfig} className="aspect-video h-[200px] w-full">
            <AreaChart data={monthlyTrend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="fillAmount" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-amount)" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="var(--color-amount)" stopOpacity={0.01} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                fontSize={11}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                fontSize={11}
                width={50}
              />
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
                dataKey="amount"
                type="monotone"
                fill="url(#fillAmount)"
                stroke="var(--color-amount)"
                strokeWidth={2}
              />
            </AreaChart>
          </ChartContainer>
        </div>
      </section>

      {/* Expiring Soon */}
      {expiring.length > 0 && (
        <section>
          <h2
            className="mb-3 text-[15px] font-medium"
            style={{ color: 'var(--color-ink)' }}
          >
            即将到期
          </h2>
          <div
            className="overflow-hidden rounded-xl"
            style={{ background: 'var(--color-surface-card)' }}
          >
            {expiring.map((item, i) => (
              <button
                key={item.id}
                onClick={() => navigate(`/assets/${item.id}`)}
                className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:opacity-80 ${
                  i < expiring.length - 1 ? 'border-b' : ''
                }`}
                style={{
                  borderColor: 'var(--color-hairline)',
                }}
              >
                <span className="text-[18px]">{item.emoji}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-[14px] font-medium" style={{ color: 'var(--color-ink)' }}>
                    {item.name}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[12px]" style={{ color: 'var(--color-muted-soft)' }}>
                      {item.detail}
                    </span>
                    {item.reminderEnabled
                      ? <IconBell size={12} className="shrink-0 text-primary" />
                      : <IconBellOff size={12} className="shrink-0" style={{ color: 'var(--color-muted-soft)' }} />}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
