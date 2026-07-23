import type { Route } from './+types/subscriptions._index'
import { IconCalendar, IconLoader2, IconPencil, IconRepeat } from '@tabler/icons-react'
import currency from 'currency.js'
import { useMemo, useState } from 'react'
import { data, Form, Link, redirect, useLoaderData, useNavigation } from 'react-router'
import { EmptyState } from '~/components/empty-state'
import { MainPageHeader } from '~/components/page-header'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select'
import { getAssetById, getCategoriesByUserId, getPaymentAccountsByUserId, getSubscriptionsByUserId, resumeSubscription } from '~/db/queries/assets'
import { formatInteger, getBillingCycleLabel } from '~/lib/asset-meta'
import { getRenewalWindow, toMonthlySubscriptionCost, toYearlySubscriptionCost } from '~/lib/subscription-renewal'
import { createSupabaseServerClient } from '~/lib/supabase.server'

export async function loader({ request }: Route.LoaderArgs) {
  const { supabase, headers } = createSupabaseServerClient(request)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user)
    throw redirect('/login', { headers })
  const [subscriptions, categories, paymentAccounts] = await Promise.all([
    getSubscriptionsByUserId(user.id),
    getCategoriesByUserId(user.id),
    getPaymentAccountsByUserId(user.id),
  ])
  return data({ subscriptions, categories, paymentAccounts, today: new Date().toISOString().slice(0, 10) }, { headers })
}

export async function action({ request }: Route.ActionArgs) {
  const { supabase, headers } = createSupabaseServerClient(request)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user)
    throw redirect('/login', { headers })
  const formData = await request.formData()
  const id = String(formData.get('id') || '')
  if (!id)
    return data({ ok: false }, { status: 400, headers })
  const subscription = await getAssetById(id, user.id)
  if (!subscription || subscription.assetType !== 'subscription' || subscription.subscriptionStatus !== 'cancelled')
    throw new Response('Not Found', { status: 404, headers })
  await resumeSubscription(id, user.id)
  return data({ ok: true }, { headers })
}

type StatusFilter = 'all' | 'active' | 'cancelled' | 'expired'
type WindowFilter = 'all' | 'overdue' | 'seven_days' | 'thirty_days' | 'later'

export default function SubscriptionsIndex() {
  const { subscriptions, categories, paymentAccounts, today } = useLoaderData<typeof loader>()
  const navigation = useNavigation()
  const [status, setStatus] = useState<StatusFilter>('all')
  const [window, setWindow] = useState<WindowFilter>('all')
  const [categoryId, setCategoryId] = useState('all')
  const [paymentAccountId, setPaymentAccountId] = useState('all')

  const active = subscriptions.filter(item => item.subscriptionStatus === 'active' && !item.subscriptionStoppedAt)
  const monthlyCost = active.reduce<Record<string, number>>((totals, item) => {
    if (item.subscriptionPrice && item.billingCycle) {
      const code = item.paymentAccountCurrencyCode || 'CNY'
      totals[code] = currency(totals[code] || 0).add(toMonthlySubscriptionCost(item.subscriptionPrice, item.billingCycle)).value
    }
    return totals
  }, {})
  const yearlyCost = active.reduce<Record<string, number>>((totals, item) => {
    if (item.subscriptionPrice && item.billingCycle) {
      const code = item.paymentAccountCurrencyCode || 'CNY'
      totals[code] = currency(totals[code] || 0).add(toYearlySubscriptionCost(item.subscriptionPrice, item.billingCycle)).value
    }
    return totals
  }, {})
  const counts = active.reduce((result, item) => {
    const key = getRenewalWindow(item.nextRenewalDate, today)
    if (key === 'overdue' || key === 'seven_days' || key === 'thirty_days')
      result[key] += 1
    return result
  }, { overdue: 0, seven_days: 0, thirty_days: 0 })

  const filtered = useMemo(() => subscriptions.filter((item) => {
    const isActive = item.subscriptionStatus === 'active' && !item.subscriptionStoppedAt
    if (status === 'active' && !isActive)
      return false
    if (status === 'cancelled' && isActive)
      return false
    if (status === 'cancelled' && item.subscriptionStatus === 'expired')
      return false
    if (status === 'expired' && item.subscriptionStatus !== 'expired')
      return false
    const itemWindow = getRenewalWindow(item.nextRenewalDate, today)
    if (window !== 'all' && itemWindow !== window)
      return false
    if (categoryId !== 'all' && item.categoryId !== categoryId)
      return false
    return paymentAccountId === 'all' || item.paymentAccountId === paymentAccountId
  }), [categoryId, paymentAccountId, status, subscriptions, today, window])

  function clearFilters() {
    setStatus('all')
    setWindow('all')
    setCategoryId('all')
    setPaymentAccountId('all')
  }

  return (
    <div className="pb-8 pt-5">
      <MainPageHeader title="订阅" action={{ label: '新增订阅', to: '/subscriptions/new' }} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Summary label="活动订阅" value={`${active.length}`} />
        <Summary label="月度预计" value={formatCurrencyGroups(monthlyCost)} />
        <Summary label="年度预计" value={formatCurrencyGroups(yearlyCost)} />
        <Summary label="需关注" value={`${counts.overdue + counts.seven_days + counts.thirty_days}`} detail={`${counts.overdue} 逾期 · ${counts.seven_days} 七天内 · ${counts.thirty_days} 三十天内`} />
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2 md:grid-cols-4">
        <Filter value={status} onChange={value => setStatus(value as StatusFilter)} options={[['all', '全部状态'], ['active', '活动中'], ['cancelled', '已停止'], ['expired', '已过期']]} />
        <Filter value={window} onChange={value => setWindow(value as WindowFilter)} options={[['all', '全部时间'], ['overdue', '已逾期'], ['seven_days', '7 天内'], ['thirty_days', '8–30 天'], ['later', '30 天后']]} />
        <Filter value={categoryId} onChange={setCategoryId} options={[['all', '全部分类'], ...categories.map(item => [item.id, `${item.emoji} ${item.name}`])]} />
        <Filter value={paymentAccountId} onChange={setPaymentAccountId} options={[['all', '全部账户'], ...paymentAccounts.map(item => [item.id, item.name])]} />
      </div>

      <div className="mt-4 flex flex-col gap-2">
        {filtered.map((item) => {
          const isActive = item.subscriptionStatus === 'active' && !item.subscriptionStoppedAt
          const isResuming = navigation.state !== 'idle' && navigation.formData?.get('id') === item.id
          const renewalWindow = getRenewalWindow(item.nextRenewalDate, today)
          return (
            <Card key={item.id} size="sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span>{item.emoji}</span>
                  <Link to={`/subscriptions/${item.id}`} className="truncate">{item.name}</Link>
                </CardTitle>
                <CardDescription>
                  {item.categoryName || '未分类'}
                  {item.paymentAccountName ? ` · ${item.paymentAccountName}` : ''}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex items-end justify-between gap-4">
                <div>
                  <div className="font-medium tabular-nums">
                    {item.subscriptionPrice ? formatInteger(item.subscriptionPrice) : '未填写'}
                    {item.billingCycle ? ` / ${getBillingCycleLabel(item.billingCycle)}` : ''}
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                    <IconCalendar />
                    {item.nextRenewalDate || '未设置续费日'}
                    {renewalWindow === 'overdue' && <Badge variant="destructive">逾期</Badge>}
                  </div>
                </div>
                <div className="flex gap-1">
                  {isActive && (
                    <Button size="sm" render={<Link to={`/subscriptions/${item.id}?renew=1`} />}>
                      <IconRepeat data-icon="inline-start" />
                      确认续费
                    </Button>
                  )}
                  {isActive
                    ? <Button size="sm" variant="secondary" render={<Link to={`/subscriptions/${item.id}?cancel=1`} />}>停止</Button>
                    : item.subscriptionStatus === 'cancelled' && (
                      <Form method="post">
                        <input type="hidden" name="id" value={item.id} />
                        <Button
                          size="sm"
                          variant="secondary"
                          type="submit"
                          disabled={isResuming}
                        >
                          {isResuming && <IconLoader2 className="animate-spin" data-icon="inline-start" />}
                          {isResuming ? '恢复中' : '恢复'}
                        </Button>
                      </Form>
                    )}
                  <Button size="icon-sm" variant="ghost" aria-label="编辑订阅" render={<Link to={`/subscriptions/${item.id}/edit`} />}><IconPencil /></Button>
                </div>
              </CardContent>
            </Card>
          )
        })}
        {subscriptions.length === 0 && <EmptyState emoji="🔁" title="还没有订阅" actions={[{ label: '新增订阅', to: '/subscriptions/new' }]} />}
        {subscriptions.length > 0 && filtered.length === 0 && <EmptyState emoji="🔍" title="没有符合筛选条件的订阅" actions={[{ label: '清除筛选', onClick: clearFilters }]} />}
      </div>
    </div>
  )
}

function Summary({ label, value, detail }: { label: string, value: string, detail?: string }) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-xl tabular-nums">{value}</CardTitle>
      </CardHeader>
      {detail && <CardContent className="text-xs text-muted-foreground">{detail}</CardContent>}
    </Card>
  )
}

function formatCurrencyGroups(values: Record<string, number>) {
  const groups = Object.entries(values)
  return groups.length > 0 ? groups.map(([code, value]) => `${code} ${formatInteger(value)}`).join(' · ') : '—'
}

export function Filter({ value, onChange, options }: { value: string, onChange: (value: string) => void, options: string[][] }) {
  const items = options.map(([optionValue, label]) => ({ label, value: optionValue }))

  return (
    <Select items={items} value={value} onValueChange={next => next && onChange(next)}>
      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
      <SelectContent><SelectGroup>{items.map(item => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectGroup></SelectContent>
    </Select>
  )
}
