import type { Route } from './+types/dashboard'
import type { ChartConfig } from '~/components/ui/chart'
import { IconBell, IconBellOff, IconX } from '@tabler/icons-react'
import { useEffect, useState } from 'react'
import { data as loaderDataFn, redirect, useLoaderData, useNavigate, useSearchParams } from 'react-router'
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { toast } from 'sonner'
import { MainPageHeader } from '~/components/page-header'
import { Button } from '~/components/ui/button'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '~/components/ui/chart'
import { getDashboardData } from '~/db/queries/dashboard'
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
  const [statsModel, setStatsModel] = useState<'one_time' | 'subscription'>('one_time')

  const { kpi, statsByType, expiring } = data
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

  const kpis = [
    { label: '今日持有成本', value: `¥${kpi.dailyCostTotal.toFixed(2)}`, subtitle: '按当前持有状态折算' },
    {
      label: '每月订阅支出',
      value: `¥${kpi.subscriptionMonthlyTotal.toFixed(2)}`,
      subtitle: '活跃订阅月度折算',
    },
    { label: '当前持有数量', value: String(kpi.activeAssetCount), subtitle: '仍在持有的资产与订阅' },
    { label: '持有资产原值', value: `¥${kpi.activeAssetPurchaseTotal.toLocaleString()}`, subtitle: '买断资产购入价总和' },
  ]

  const renderStatsToggle = () => (
    <div
      className="inline-flex items-center rounded-md border p-0.5"
      style={{ borderColor: 'var(--color-hairline)' }}
    >
      <Button
        size="sm"
        variant={statsModel === 'one_time' ? 'default' : 'ghost'}
        className="h-6 px-2 text-xs"
        onClick={() => setStatsModel('one_time')}
      >
        买断
      </Button>
      <Button
        size="sm"
        variant={statsModel === 'subscription' ? 'default' : 'ghost'}
        className="h-6 px-2 text-xs"
        onClick={() => setStatsModel('subscription')}
      >
        订阅
      </Button>
    </div>
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
      <MainPageHeader title="统计总览" />

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
          {renderStatsToggle()}
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
          {renderStatsToggle()}
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
