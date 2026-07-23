import type { Route } from './+types/payment-types'
import {
  IconCheck,
  IconLoader2,
  IconPencil,
  IconPlus,
  IconTrash,
  IconX,
} from '@tabler/icons-react'
import { useMemo, useState } from 'react'
import { data, Form, redirect, useActionData, useLoaderData, useNavigation } from 'react-router'
import { SubPageHeader } from '~/components/page-header'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import {
  createSettingsPaymentType,
  getSettingsPaymentTypesByUserId,
  softDeleteSettingsPaymentType,
  updateSettingsPaymentType,
} from '~/db/queries/settings'
import { normalizePaymentTypeName } from '~/lib/payment-type'
import { createSupabaseServerClient } from '~/lib/supabase.server'

export async function loader({ request }: Route.LoaderArgs) {
  const { supabase, headers } = createSupabaseServerClient(request)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user)
    throw redirect('/login', { headers })

  const paymentTypes = await getSettingsPaymentTypesByUserId(user.id)
  return data({ paymentTypes }, { headers })
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
    if (!name)
      return data({ ok: false, intent, error: '支付类型名称不能为空' }, { headers })

    const id = await createSettingsPaymentType(user.id, { name })
    if (!id)
      return data({ ok: false, intent, error: '支付类型名称已存在' }, { status: 400, headers })
    return redirect('/settings/payment-types', { headers })
  }

  if (intent === 'update') {
    const id = String(formData.get('id') || '')
    const name = String(formData.get('name') || '').trim()
    if (!id || !name)
      return data({ ok: false, intent, error: '参数不完整' }, { headers })

    const result = await updateSettingsPaymentType(user.id, id, { name })
    if (result === 'forbidden')
      return data({ ok: false, intent, error: '预置支付类型不能修改' }, { status: 400, headers })
    if (result === 'duplicate')
      return data({ ok: false, intent, error: '支付类型名称已存在' }, { status: 400, headers })
    if (result === 'not_found')
      return data({ ok: false, intent, error: '支付类型不存在' }, { status: 404, headers })
    return redirect('/settings/payment-types', { headers })
  }

  if (intent === 'delete') {
    const id = String(formData.get('id') || '')
    if (!id)
      return data({ ok: false, intent, error: '参数不完整' }, { headers })

    const result = await softDeleteSettingsPaymentType(user.id, id)
    if (result === 'forbidden')
      return data({ ok: false, intent, error: '预置支付类型不能删除' }, { status: 400, headers })
    if (result === 'not_found')
      return data({ ok: false, intent, error: '支付类型不存在' }, { status: 404, headers })
    return redirect('/settings/payment-types', { headers })
  }

  return data({ ok: false, intent, error: '不支持的操作' }, { headers })
}

export default function PaymentTypesPage() {
  const { paymentTypes } = useLoaderData<typeof loader>()
  const actionData = useActionData<typeof action>()
  const navigation = useNavigation()

  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')

  const pendingIntent = String(navigation.formData?.get('intent') || '')
  const pendingId = String(navigation.formData?.get('id') || '')
  const isCreating = navigation.state !== 'idle' && pendingIntent === 'create'
  const isUpdatingCurrent = (id: string) => navigation.state !== 'idle' && pendingIntent === 'update' && pendingId === id
  const isDeletingCurrent = (id: string) => navigation.state !== 'idle' && pendingIntent === 'delete' && pendingId === id
  const actionError = actionData && 'error' in actionData && typeof actionData.error === 'string'
    ? actionData.error
    : null
  const normalizedNewName = normalizePaymentTypeName(newName)
  const newNameDuplicate = Boolean(normalizedNewName) && paymentTypes.some(
    type => normalizePaymentTypeName(type.name) === normalizedNewName,
  )
  const normalizedEditName = normalizePaymentTypeName(editName)
  const editNameDuplicate = Boolean(normalizedEditName) && paymentTypes.some(
    type => type.id !== editingId && normalizePaymentTypeName(type.name) === normalizedEditName,
  )

  const canSubmitCreate = useMemo(
    () => newName.trim().length > 0 && !newNameDuplicate && !isCreating,
    [isCreating, newName, newNameDuplicate],
  )

  return (
    <div className="pb-8">
      <SubPageHeader backTo="/settings" backLabel="设置" title="支付类型管理" />

      <Form
        method="post"
        className="mb-6 rounded-2xl p-4"
        style={{ backgroundColor: 'var(--color-surface-card)' }}
      >
        <input type="hidden" name="intent" value="create" />
        <div className="flex items-center gap-3">
          <Input
            name="name"
            placeholder="支付类型名称"
            value={newName}
            onChange={e => setNewName(e.target.value)}
          />
          <Button type="submit" disabled={!canSubmitCreate}>
            {isCreating ? <IconLoader2 className="animate-spin" /> : <IconPlus />}
            新增
          </Button>
        </div>
        {newNameDuplicate && <p className="mt-2 text-sm text-destructive">支付类型名称已存在</p>}
      </Form>
      {actionError && (
        <p className="-mt-4 mb-5 text-sm" style={{ color: 'var(--color-error)' }}>
          {actionError}
        </p>
      )}

      <div
        className="overflow-hidden rounded-2xl"
        style={{ backgroundColor: 'var(--color-surface-card)' }}
      >
        {paymentTypes.map((item, i) => (
          <div
            key={item.id}
            className="flex items-center gap-3 px-4 py-3"
            style={{
              borderBottom:
                i < paymentTypes.length - 1
                  ? '1px solid var(--color-hairline)'
                  : undefined,
            }}
          >
            {editingId === item.id
              ? (
                  <>
                    <div className="min-w-0 flex-1">
                      <Input
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        className="h-9"
                        autoFocus
                      />
                      {editNameDuplicate && <p className="mt-1 text-xs text-destructive">支付类型名称已存在</p>}
                    </div>
                    <Form
                      method="post"
                      className="flex items-center"
                    >
                      <input type="hidden" name="intent" value="update" />
                      <input type="hidden" name="id" value={item.id} />
                      <input type="hidden" name="name" value={editName} />
                      <Button
                        type="submit"
                        size="icon-sm"
                        variant="ghost"
                        disabled={!editName.trim() || editNameDuplicate || isUpdatingCurrent(item.id)}
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
                    <span
                      className="min-w-0 flex-1 truncate text-sm"
                      style={{ color: 'var(--color-ink)' }}
                    >
                      {item.name}
                    </span>
                    {item.isPreset && <Badge variant="secondary">预置</Badge>}
                    {!item.isPreset && (
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
                    )}
                  </>
                )}
          </div>
        ))}
      </div>
    </div>
  )
}
