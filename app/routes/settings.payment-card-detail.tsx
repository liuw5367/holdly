import type { Route } from './+types/settings.payment-card-detail'
import { IconCreditCard, IconPencil, IconPlayerPlay, IconPlayerStop } from '@tabler/icons-react'
import currency from 'currency.js'
import { data, Link, redirect, useLoaderData, useNavigation, useSubmit } from 'react-router'
import { SubPageHeader } from '~/components/page-header'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card'
import { getSettingsPaymentAccountById, getSubscriptionsByPaymentAccount, setPaymentAccountActive } from '~/db/queries/settings'
import { formatInteger, getBillingCycleLabel } from '~/lib/asset-meta'
import { getNextCardDates } from '~/lib/payment-account.schema'
import { createSupabaseServerClient } from '~/lib/supabase.server'

export async function loader({ request, params }: Route.LoaderArgs) {
  const { supabase, headers } = createSupabaseServerClient(request)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user)
    throw redirect('/login', { headers })
  const [account, subscriptions] = await Promise.all([
    getSettingsPaymentAccountById(user.id, params.id),
    getSubscriptionsByPaymentAccount(user.id, params.id),
  ])
  if (!account || account.accountKind !== 'credit_card')
    throw new Response('Not Found', { status: 404 })
  const dates = account.statementDay && account.repaymentRule
    ? getNextCardDates({
        today: new Date(),
        statementDay: account.statementDay,
        repaymentRule: account.repaymentRule,
        repaymentDay: account.repaymentDay,
        repaymentDaysAfterStatement: account.repaymentDaysAfterStatement,
      })
    : null
  return data({ account, subscriptions, dates, today: new Date().toISOString().slice(0, 10) }, { headers })
}

export async function action({ request, params }: Route.ActionArgs) {
  const { supabase, headers } = createSupabaseServerClient(request)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user)
    throw redirect('/login', { headers })
  const formData = await request.formData()
  const isActive = formData.get('isActive') === 'true'
  const updated = await setPaymentAccountActive(user.id, params.id, isActive)
  if (!updated)
    throw new Response('Not Found', { status: 404, headers })
  return data({ ok: true }, { headers })
}

export default function PaymentCardDetail() {
  const { account, subscriptions, dates, today } = useLoaderData<typeof loader>()
  const submit = useSubmit()
  const navigation = useNavigation()
  const activeSubscriptions = subscriptions.filter(item => item.subscriptionStatus === 'active' && !item.subscriptionStoppedAt)
  const next30 = new Date(`${today}T00:00:00`).getTime() + 30 * 86400000
  const expected = activeSubscriptions.reduce((total, item) => {
    if (!item.nextRenewalDate || !item.subscriptionPrice)
      return total
    const due = new Date(`${item.nextRenewalDate}T00:00:00`).getTime()
    return due <= next30 ? currency(total).add(item.subscriptionPrice).value : total
  }, 0)

  function toggleActive() {
    const formData = new FormData()
    formData.set('isActive', String(!account.isActive))
    submit(formData, { method: 'post' })
  }

  return (
    <div className="pb-8">
      <SubPageHeader backTo="/settings/payment-accounts" title="信用卡资料" primaryAction={{ label: '编辑', icon: IconPencil, to: `/settings/payment-accounts/card/${account.id}` }} />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IconCreditCard />
            {account.bankName}
            {' '}
            ·
            {account.name}
          </CardTitle>
          <CardDescription>
            {account.lastFour ? `尾号 ${account.lastFour}` : '未填写尾号'}
            {' '}
            ·
            {' '}
            {account.currencyCode}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <Info label="状态" value={<Badge variant={account.isActive ? 'secondary' : 'outline'}>{account.isActive ? '使用中' : '已停用'}</Badge>} />
          <Info label="额度" value={account.creditLimit ? `${account.currencyCode} ${formatInteger(account.creditLimit)}` : '未填写'} />
          <Info label="下次出账" value={dates?.statementDate || '未设置'} />
          <Info label="下次还款" value={dates?.repaymentDate || '未设置'} />
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>关联订阅</CardTitle>
          <CardDescription>
            {activeSubscriptions.length}
            {' '}
            个活动订阅 · 未来 30 天预计
            {' '}
            {account.currencyCode}
            {' '}
            {formatInteger(expected)}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {subscriptions.map(item => (
            <Link key={item.id} to={`/subscriptions/${item.id}`} className="flex items-center justify-between gap-3 rounded-lg bg-muted/50 p-3">
              <span className="min-w-0 truncate">
                {item.emoji}
                {' '}
                {item.name}
              </span>
              <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
                {item.subscriptionPrice ? formatInteger(item.subscriptionPrice) : '—'}
                {item.billingCycle ? ` / ${getBillingCycleLabel(item.billingCycle)}` : ''}
              </span>
            </Link>
          ))}
          {subscriptions.length === 0 && <p className="text-sm text-muted-foreground">还没有订阅使用这张信用卡。</p>}
        </CardContent>
      </Card>

      {account.notes && (
        <Card className="mt-4">
          <CardHeader><CardTitle>备注</CardTitle></CardHeader>
          <CardContent className="whitespace-pre-wrap text-sm text-muted-foreground">{account.notes}</CardContent>
        </Card>
      )}

      {!account.isActive && <p className="mt-4 text-sm text-muted-foreground">停用后不会出现在新建订阅的可选账户中，已有订阅关联仍保留。</p>}
      {account.isActive && activeSubscriptions.length > 0 && (
        <p className="mt-4 text-sm text-muted-foreground">
          停用前请确认
          {activeSubscriptions.length}
          {' '}
          个活动订阅已更换支付账户。
        </p>
      )}
      <Button className="mt-3 w-full" variant={account.isActive ? 'destructive' : 'secondary'} onClick={toggleActive} disabled={navigation.state !== 'idle'}>
        {account.isActive ? <IconPlayerStop data-icon="inline-start" /> : <IconPlayerPlay data-icon="inline-start" />}
        {account.isActive ? '停用信用卡' : '恢复使用'}
      </Button>
    </div>
  )
}

function Info({ label, value }: { label: string, value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 font-medium tabular-nums">{value}</div>
    </div>
  )
}
