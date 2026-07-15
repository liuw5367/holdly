import type { Route } from './+types/payment-accounts'
import {
  IconCheck,
  IconCreditCard,
  IconLoader2,
  IconPencil,
  IconPlus,
  IconTrash,
  IconX,
} from '@tabler/icons-react'
import { useMemo, useState } from 'react'
import { data, Form, Link, redirect, useLoaderData, useNavigation } from 'react-router'
import { SubPageHeader } from '~/components/page-header'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import {
  createSettingsPaymentAccount,
  getSettingsPaymentAccountsByUserId,
  getSettingsPaymentTypesByUserId,
  softDeleteSettingsPaymentAccount,
  updateSettingsPaymentAccount,
} from '~/db/queries/settings'
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

  if (intent === 'create') {
    const name = String(formData.get('name') || '').trim()
    const paymentTypeId = String(formData.get('paymentTypeId') || '').trim()
    if (!name || !paymentTypeId)
      return data({ ok: false, intent, error: '参数不完整' }, { headers })

    await createSettingsPaymentAccount(user.id, { name, paymentTypeId })
    return data({ ok: true, intent }, { headers })
  }

  if (intent === 'update') {
    const id = String(formData.get('id') || '').trim()
    const name = String(formData.get('name') || '').trim()
    if (!id || !name)
      return data({ ok: false, intent, error: '参数不完整' }, { headers })

    await updateSettingsPaymentAccount(user.id, id, { name })
    return data({ ok: true, intent }, { headers })
  }

  if (intent === 'delete') {
    const id = String(formData.get('id') || '')
    if (!id)
      return data({ ok: false, intent, error: '参数不完整' }, { headers })

    await softDeleteSettingsPaymentAccount(user.id, id)
    return data({ ok: true, intent }, { headers })
  }

  return data({ ok: false, intent, error: '不支持的操作' }, { headers })
}

export default function PaymentAccountsPage() {
  const { paymentTypes, paymentAccounts } = useLoaderData<typeof loader>()
  const navigation = useNavigation()

  const [newTypeId, setNewTypeId] = useState(paymentTypes[0]?.id ?? '')
  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')

  const pendingIntent = String(navigation.formData?.get('intent') || '')
  const pendingId = String(navigation.formData?.get('id') || '')
  const isCreating = navigation.state !== 'idle' && pendingIntent === 'create'
  const isUpdatingCurrent = (id: string) => navigation.state !== 'idle' && pendingIntent === 'update' && pendingId === id
  const isDeletingCurrent = (id: string) => navigation.state !== 'idle' && pendingIntent === 'delete' && pendingId === id

  const typeNameMap = useMemo(() => {
    return new Map(paymentTypes.map(item => [item.id, item.name]))
  }, [paymentTypes])

  const canSubmitCreate = useMemo(() => newName.trim().length > 0 && !!newTypeId && !isCreating, [isCreating, newName, newTypeId])

  return (
    <div className="pb-8">
      <SubPageHeader backTo="/settings" backLabel="设置" title="支付账户管理" />

      <Button className="mb-4 w-full" variant="secondary" render={<Link to="/settings/payment-accounts/card" />}>
        <IconCreditCard data-icon="inline-start" />
        添加信用卡资料
      </Button>

      <Form
        method="post"
        className="mb-6 rounded-2xl p-4"
        style={{ backgroundColor: 'var(--color-surface-card)' }}
        onSubmit={() => setNewName('')}
      >
        <input type="hidden" name="intent" value="create" />
        <input type="hidden" name="paymentTypeId" value={newTypeId} />

        <div className="flex flex-col gap-3">
          <Input
            name="name"
            placeholder="账户名称"
            value={newName}
            onChange={e => setNewName(e.target.value)}
          />

          <div className="flex items-center justify-between gap-3">
            <Select value={newTypeId} onValueChange={value => setNewTypeId(value || '')}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="支付类型">
                  {value => value ? (typeNameMap.get(String(value)) || '支付类型') : '支付类型'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {paymentTypes.map(type => (
                  <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button type="submit" disabled={!canSubmitCreate}>
              {isCreating ? <IconLoader2 className="animate-spin" /> : <IconPlus />}
              新增
            </Button>
          </div>
        </div>
      </Form>

      <div
        className="overflow-hidden rounded-2xl"
        style={{ backgroundColor: 'var(--color-surface-card)' }}
      >
        {paymentAccounts.map((item, i) => (
          <div
            key={item.id}
            className="flex items-center gap-3 px-4 py-3"
            style={{
              borderBottom:
                i < paymentAccounts.length - 1
                  ? '1px solid var(--color-hairline)'
                  : undefined,
            }}
          >
            {editingId === item.id
              ? (
                  <>
                    <Input
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      className="h-9"
                      autoFocus
                    />
                    <Form
                      method="post"
                      className="flex items-center"
                      onSubmit={() => {
                        setEditingId(null)
                        setEditName('')
                      }}
                    >
                      <input type="hidden" name="intent" value="update" />
                      <input type="hidden" name="id" value={item.id} />
                      <input type="hidden" name="name" value={editName} />
                      <Button
                        type="submit"
                        size="icon-sm"
                        variant="ghost"
                        disabled={!editName.trim() || isUpdatingCurrent(item.id)}
                        style={{ color: 'var(--color-primary)' }}
                      >
                        {isUpdatingCurrent(item.id) ? <IconLoader2 className="animate-spin" /> : <IconCheck />}
                      </Button>
                    </Form>
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      style={{ color: 'var(--color-primary)' }}
                      onClick={() => setEditingId(null)}
                    >
                      <IconX />
                    </Button>
                  </>
                )
              : (
                  <>
                    {item.accountKind === 'credit_card'
                      ? (
                          <Link to={`/settings/payment-accounts/${item.id}`} className="min-w-0 flex-1 truncate text-sm" style={{ color: 'var(--color-ink)' }}>
                            {item.bankName ? `${item.bankName} · ` : ''}
                            {item.name}
                            {item.lastFour ? ` · ${item.lastFour}` : ''}
                          </Link>
                        )
                      : <span className="min-w-0 flex-1 truncate text-sm" style={{ color: 'var(--color-ink)' }}>{item.name}</span>}
                    <span
                      className="rounded-md px-2 py-0.5 text-xs font-medium"
                      style={{
                        backgroundColor: 'var(--color-primary-muted)',
                        color: 'var(--color-primary)',
                      }}
                    >
                      {typeNameMap.get(item.paymentTypeId) || '未分类'}
                    </span>
                    <div className="ml-auto flex items-center gap-1">
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        style={{ color: 'var(--color-primary)' }}
                        onClick={() => {
                          setEditingId(item.id)
                          setEditName(item.name)
                        }}
                      >
                        <IconPencil />
                      </Button>
                      <Form method="post" className="flex items-center">
                        <input type="hidden" name="intent" value="delete" />
                        <input type="hidden" name="id" value={item.id} />
                        <Button
                          type="submit"
                          size="icon-sm"
                          variant="ghost"
                          disabled={isDeletingCurrent(item.id)}
                          style={{ color: 'var(--color-error)' }}
                        >
                          {isDeletingCurrent(item.id) ? <IconLoader2 className="animate-spin" /> : <IconTrash />}
                        </Button>
                      </Form>
                    </div>
                  </>
                )}
          </div>
        ))}
      </div>
    </div>
  )
}
