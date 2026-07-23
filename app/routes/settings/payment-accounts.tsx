import type { Route } from './+types/payment-accounts'
import {
  IconCreditCard,
  IconDots,
  IconLoader2,
  IconPencil,
  IconPlus,
  IconTrash,
  IconWallet,
} from '@tabler/icons-react'
import { useMemo, useState } from 'react'
import { data, Link, redirect, useFetcher, useLoaderData, useNavigate, useSearchParams } from 'react-router'
import { SubPageHeader } from '~/components/page-header'
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '~/components/ui/alert-dialog'
import { Badge } from '~/components/ui/badge'
import { Button, buttonVariants } from '~/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '~/components/ui/dropdown-menu'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select'
import {
  getSettingsPaymentAccountsByUserId,
  getSettingsPaymentTypesByUserId,
  softDeleteSettingsPaymentAccount,
} from '~/db/queries/settings'
import { formatInteger } from '~/lib/asset-meta'
import { getNextCardDates } from '~/lib/payment-account.schema'
import { createSupabaseServerClient } from '~/lib/supabase.server'

export async function loader({ request }: Route.LoaderArgs) {
  const { supabase, headers } = createSupabaseServerClient(request)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user)
    throw redirect('/login', { headers })

  const [paymentTypes, paymentAccounts] = await Promise.all([
    getSettingsPaymentTypesByUserId(user.id),
    getSettingsPaymentAccountsByUserId(user.id),
  ])

  return data({ paymentTypes, paymentAccounts }, { headers })
}

export async function action({ request }: Route.ActionArgs) {
  const { supabase, headers } = createSupabaseServerClient(request)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user)
    throw redirect('/login', { headers })

  const formData = await request.formData()
  const intent = String(formData.get('intent') || '')
  const id = String(formData.get('id') || '')
  if (intent !== 'delete' || !id)
    return data({ ok: false, error: '不支持的操作' }, { status: 400, headers })

  await softDeleteSettingsPaymentAccount(user.id, id)
  return data({ ok: true, id }, { headers })
}

export default function PaymentAccountsPage() {
  const { paymentTypes, paymentAccounts } = useLoaderData<typeof loader>()
  const navigate = useNavigate()
  const deleteFetcher = useFetcher<typeof action>()
  const [searchParams, setSearchParams] = useSearchParams()
  const [deleteTarget, setDeleteTarget] = useState<(typeof paymentAccounts)[number] | null>(null)
  const requestedType = searchParams.get('type') || 'all'
  const selectedType = requestedType === 'all' || paymentTypes.some(type => type.id === requestedType)
    ? requestedType
    : 'all'
  const typeNameMap = useMemo(
    () => new Map(paymentTypes.map(type => [type.id, type.name])),
    [paymentTypes],
  )
  const filterItems = [
    { value: 'all', label: '全部类型' },
    ...paymentTypes.map(type => ({ value: type.id, label: type.name })),
  ]
  const filteredAccounts = selectedType === 'all'
    ? paymentAccounts
    : paymentAccounts.filter(account => account.paymentTypeId === selectedType)
  const returnQuery = selectedType === 'all' ? '' : `?returnType=${encodeURIComponent(selectedType)}`
  const newAccountQuery = selectedType === 'all'
    ? ''
    : `?paymentTypeId=${encodeURIComponent(selectedType)}&returnType=${encodeURIComponent(selectedType)}`
  const pendingId = String(deleteFetcher.formData?.get('id') || '')
  const isDeleting = deleteFetcher.state !== 'idle' && pendingId === deleteTarget?.id
  const deleteCompleted = deleteFetcher.state === 'idle'
    && deleteFetcher.data?.ok === true
    && 'id' in deleteFetcher.data
    && deleteFetcher.data.id === deleteTarget?.id

  return (
    <div className="pb-8">
      <SubPageHeader backTo="/settings" backLabel="设置" title="支付账户管理" />

      <div className="mb-5 flex items-center justify-between gap-3">
        <Select
          items={filterItems}
          value={selectedType}
          onValueChange={(value) => {
            if (!value || value === 'all')
              setSearchParams({})
            else
              setSearchParams({ type: value })
          }}
        >
          <SelectTrigger className="min-w-0 flex-1 sm:max-w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {filterItems.map(item => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
            </SelectGroup>
          </SelectContent>
        </Select>

        <Link
          to={`/settings/payment-accounts/new${newAccountQuery}`}
          className={buttonVariants({ className: 'shrink-0' })}
        >
          <IconPlus data-icon="inline-start" />
          添加账户
        </Link>
      </div>

      {filteredAccounts.length > 0
        ? (
            <div className="flex flex-col gap-3">
              {filteredAccounts.map((account) => {
                const isCreditCard = account.accountKind === 'credit_card'
                const href = isCreditCard
                  ? `/settings/payment-accounts/${account.id}${returnQuery}`
                  : `/settings/payment-accounts/${account.id}/edit${returnQuery}`
                const editHref = `/settings/payment-accounts/${account.id}/edit${returnQuery}`
                const dates = isCreditCard && account.statementDay && account.repaymentRule
                  ? getNextCardDates({
                      today: new Date(),
                      statementDay: account.statementDay,
                      repaymentRule: account.repaymentRule,
                      repaymentDay: account.repaymentDay,
                      repaymentDaysAfterStatement: account.repaymentDaysAfterStatement,
                    })
                  : null

                return (
                  <div
                    key={account.id}
                    className="flex items-start gap-2 rounded-2xl p-4"
                    style={{ backgroundColor: 'var(--color-surface-card)' }}
                  >
                    <Link to={href} className="flex min-w-0 flex-1 items-start gap-3 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-muted)]">
                      <span
                        className="flex size-10 shrink-0 items-center justify-center rounded-xl"
                        style={{ backgroundColor: 'var(--color-primary-muted)', color: 'var(--color-primary)' }}
                      >
                        {isCreditCard ? <IconCreditCard size={21} /> : <IconWallet size={20} />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="truncate text-sm font-medium" style={{ color: 'var(--color-ink)' }}>
                            {isCreditCard && account.bankName ? `${account.bankName} · ` : ''}
                            {account.name}
                          </span>
                          {isCreditCard && (
                            <Badge variant={account.isActive ? 'secondary' : 'outline'}>
                              {account.isActive ? '使用中' : '已停用'}
                            </Badge>
                          )}
                        </span>
                        <span className="mt-1 block text-xs text-muted-foreground">
                          {isCreditCard
                            ? `${account.lastFour ? `尾号 ${account.lastFour}` : '未填写尾号'} · ${account.currencyCode}${account.creditLimit ? ` · 额度 ${formatInteger(account.creditLimit)}` : ''}`
                            : typeNameMap.get(account.paymentTypeId) || '未分类'}
                        </span>
                        {isCreditCard && (
                          <span className="mt-2 block text-xs tabular-nums text-muted-foreground">
                            {dates
                              ? `下次出账 ${dates.statementDate.slice(5)} · 还款 ${dates.repaymentDate.slice(5)}`
                              : '账单日期未设置'}
                          </span>
                        )}
                      </span>
                    </Link>

                    <DropdownMenu>
                      <DropdownMenuTrigger
                        aria-label={`管理${account.name}`}
                        render={<Button type="button" variant="ghost" size="icon-sm" className="shrink-0" />}
                      >
                        <IconDots />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => navigate(editHref)}>
                          <IconPencil />
                          编辑
                        </DropdownMenuItem>
                        <DropdownMenuItem variant="destructive" onClick={() => setDeleteTarget(account)}>
                          <IconTrash />
                          删除
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                )
              })}
            </div>
          )
        : (
            <div className="rounded-2xl px-5 py-10 text-center" style={{ backgroundColor: 'var(--color-surface-card)' }}>
              <IconWallet className="mx-auto text-muted-foreground" size={28} />
              <p className="mt-3 text-sm font-medium" style={{ color: 'var(--color-ink)' }}>
                {paymentAccounts.length === 0 ? '还没有支付账户' : '该类型下还没有账户'}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">添加后可在资产和订阅中选择使用。</p>
            </div>
          )}

      <AlertDialog open={Boolean(deleteTarget) && !deleteCompleted} onOpenChange={open => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除支付账户？</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget ? `“${deleteTarget.name}”将不再出现在支付账户列表中。已有资产和订阅记录不会被删除。` : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel variant="secondary">取消</AlertDialogCancel>
            <deleteFetcher.Form method="post">
              <input type="hidden" name="intent" value="delete" />
              <input type="hidden" name="id" value={deleteTarget?.id || ''} />
              <Button type="submit" variant="destructive" disabled={isDeleting}>
                {isDeleting && <IconLoader2 className="animate-spin" data-icon="inline-start" />}
                {isDeleting ? '删除中' : '确认删除'}
              </Button>
            </deleteFetcher.Form>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
