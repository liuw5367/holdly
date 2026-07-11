import type { Route } from './+types/plans.$id.records.$month'
import {
  IconPencil,
  IconTrash,
} from '@tabler/icons-react'
import { useMemo, useState } from 'react'
import { Form, data as loaderDataFn, redirect, useActionData, useLoaderData, useNavigation } from 'react-router'
import { SubPageHeader } from '~/components/page-header'
import { PublicAvatar } from '~/components/public-avatar'
import { Button } from '~/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import { Input } from '~/components/ui/input'
import {
  getPlanRecordDetail,
  softDeletePlanRecord,
} from '~/db/queries/plans'
import { buildPlanAvatarToneMap } from '~/lib/plan-avatar'
import { buildPlanMemberGroups } from '~/lib/plan-member-groups'
import { createSupabaseServerClient } from '~/lib/supabase.server'

export async function loader({ request, params }: Route.LoaderArgs) {
  const { supabase, headers } = createSupabaseServerClient(request)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user)
    throw redirect('/login', { headers })

  const [yearStr, monthStr] = (params.month ?? '').split('-')
  const year = Number(yearStr)
  const month = Number(monthStr)

  if (!Number.isFinite(year) || !Number.isFinite(month))
    throw new Response('Not Found', { status: 404 })

  const recordData = await getPlanRecordDetail(params.id, user.id, year, month)
  if (!recordData)
    throw new Response('Not Found', { status: 404 })

  return loaderDataFn({ ...recordData, currentUserId: user.id }, { headers })
}

export async function action({ request, params }: Route.ActionArgs) {
  const { supabase, headers } = createSupabaseServerClient(request)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user)
    throw redirect('/login', { headers })

  const formData = await request.formData()
  const intent = formData.get('intent')

  if (intent !== 'delete-record')
    return loaderDataFn(null, { headers })

  const confirmMonth = String(formData.get('confirmMonth') || '').trim()
  const expectedMonth = String(params.month || '')
  if (confirmMonth !== expectedMonth)
    return loaderDataFn({ error: `请输入正确的归属月份 ${expectedMonth}` }, { headers })

  const [yearStr, monthStr] = expectedMonth.split('-')
  const year = Number(yearStr)
  const month = Number(monthStr)

  await softDeletePlanRecord(params.id, user.id, year, month)
  return redirect(`/plans/${params.id}`, { headers })
}

export default function PlansRecordsMonth() {
  const data = useLoaderData<typeof loader>()
  const actionData = useActionData<typeof action>()
  const navigation = useNavigation()

  const [deleteOpen, setDeleteOpen] = useState(false)
  const [confirmMonth, setConfirmMonth] = useState('')

  const isDeleting = navigation.state !== 'idle'
    && navigation.formData?.get('intent') === 'delete-record'

  const monthKey = `${data.record.year}-${String(data.record.month).padStart(2, '0')}`
  const memberGroups = useMemo(
    () => buildPlanMemberGroups(data.members, data.record.items, data.currentUserId, false),
    [data.currentUserId, data.members, data.record.items],
  )
  const memberNoteMap = useMemo(
    () => new Map(data.record.memberNotes.map(note => [note.memberId, note.note])),
    [data.record.memberNotes],
  )
  const memberToneMap = useMemo(
    () => buildPlanAvatarToneMap(data.members.map(member => member.userId)),
    [data.members],
  )

  return (
    <div className="pb-8">
      <SubPageHeader
        backTo={`/plans/${data.planId}`}
        backLabel="返回"
        title={`${data.record.year}年${data.record.month}月`}
        primaryAction={{
          label: '编辑',
          icon: IconPencil,
          to: `/plans/${data.planId}/records/${monthKey}/edit`,
        }}
        moreItems={data.canManage
          ? [{
              label: '删除记录',
              icon: IconTrash,
              variant: 'destructive',
              onClick: () => setDeleteOpen(true),
            }]
          : undefined}
      />

      <div className="mb-5 text-xs" style={{ color: 'var(--color-muted)' }}>
        创建于
        {' '}
        {data.record.createdAt ? new Date(data.record.createdAt).toLocaleDateString('zh-CN') : '--'}
      </div>

      <div className="mb-6 flex gap-3">
        <div className="flex-[1_1_auto] rounded-xl border p-3" style={{ background: 'var(--color-surface-card)', borderColor: 'var(--color-hairline)' }}>
          <div className="mb-1 text-xs" style={{ color: 'var(--color-muted)' }}>收入</div>
          <div className="font-[family-name:var(--font-mono)] text-lg font-semibold" style={{ color: 'var(--color-success)' }}>
            {data.record.totalIncome.toLocaleString()}
          </div>
        </div>
        <div className="flex-[1_1_auto] rounded-xl border p-3" style={{ background: 'var(--color-surface-card)', borderColor: 'var(--color-hairline)' }}>
          <div className="mb-1 text-xs" style={{ color: 'var(--color-muted)' }}>支出</div>
          <div className="font-[family-name:var(--font-mono)] text-lg font-semibold" style={{ color: 'var(--color-error)' }}>
            {data.record.totalExpense.toLocaleString()}
          </div>
        </div>
        <div className="flex-[1_1_auto] rounded-xl border p-3" style={{ background: 'var(--color-surface-card)', borderColor: 'var(--color-hairline)' }}>
          <div className="mb-1 text-xs" style={{ color: 'var(--color-muted)' }}>净收入</div>
          <div className="font-[family-name:var(--font-mono)] text-lg font-semibold" style={{ color: data.record.netIncome >= 0 ? 'var(--color-success)' : 'var(--color-error)' }}>
            {data.record.netIncome.toLocaleString()}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {memberGroups.length === 0
          ? <div className="rounded-xl border px-4 py-8 text-center text-sm" style={{ color: 'var(--color-muted)', borderColor: 'var(--color-hairline)' }}>暂无收支记录</div>
          : memberGroups.map((group) => {
              const note = memberNoteMap.get(group.member.userId)?.trim()
              return (
                <section key={group.member.userId} className="overflow-hidden rounded-xl border" style={{ background: 'var(--color-surface-card)', borderColor: 'var(--color-hairline)' }}>
                  <div className="flex flex-col gap-2 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: 'var(--color-hairline)' }}>
                    <div className="flex min-w-0 items-center gap-2.5">
                      <PublicAvatar
                        emoji={group.member.avatarEmoji}
                        nickname={group.member.displayName}
                        size="sm"
                        backgroundColor={memberToneMap.get(group.member.userId)?.backgroundColor}
                        textColor={memberToneMap.get(group.member.userId)?.textColor}
                      />
                      <span className="truncate text-sm font-medium" style={{ color: 'var(--color-ink)' }}>{group.member.displayName}</span>
                    </div>
                    <div className="whitespace-nowrap font-[family-name:var(--font-mono)] text-xs tabular-nums" style={{ color: 'var(--color-muted)' }}>
                      收入
                      {' '}
                      {group.totalIncome.toLocaleString()}
                      {' · 支出 '}
                      {group.totalExpense.toLocaleString()}
                      {' · '}
                      <span style={{ color: group.netIncome > 0 ? 'var(--color-success)' : group.netIncome < 0 ? 'var(--color-error)' : 'var(--color-muted)' }}>
                        净额
                        {' '}
                        {group.netIncome > 0 ? '+' : ''}
                        {group.netIncome.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {group.incomeItems.map(item => (
                    <div key={item.id} className="flex items-center gap-3 border-b px-4 py-3 last:border-b-0" style={{ borderColor: 'var(--color-hairline)' }}>
                      <span className="w-8 shrink-0 text-xs" style={{ color: 'var(--color-success)' }}>收入</span>
                      <span className="min-w-0 flex-1 truncate text-sm" style={{ color: 'var(--color-ink)' }}>{item.name}</span>
                      <span className="font-[family-name:var(--font-mono)] text-sm font-medium tabular-nums" style={{ color: 'var(--color-success)' }}>
                        +
                        {item.amount.toLocaleString()}
                      </span>
                    </div>
                  ))}
                  {group.expenseItems.map(item => (
                    <div key={item.id} className="flex items-center gap-3 border-b px-4 py-3 last:border-b-0" style={{ borderColor: 'var(--color-hairline)' }}>
                      <span className="w-8 shrink-0 text-xs" style={{ color: 'var(--color-error)' }}>支出</span>
                      <span className="min-w-0 flex-1 truncate text-sm" style={{ color: 'var(--color-ink)' }}>{item.name}</span>
                      <span className="font-[family-name:var(--font-mono)] text-sm font-medium tabular-nums" style={{ color: 'var(--color-error)' }}>
                        -
                        {item.amount.toLocaleString()}
                      </span>
                    </div>
                  ))}
                  {note && (
                    <p className="border-t px-4 py-3 text-sm leading-6 whitespace-pre-wrap" style={{ color: 'var(--color-muted)', borderColor: 'var(--color-hairline)' }}>
                      备注：
                      {note}
                    </p>
                  )}
                </section>
              )
            })}
      </div>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>删除记录</DialogTitle>
            <DialogDescription>
              请输入归属月份
              {' '}
              <strong>{monthKey}</strong>
              {' '}
              以确认删除。
            </DialogDescription>
          </DialogHeader>

          <Form method="post" className="space-y-3">
            <input type="hidden" name="intent" value="delete-record" />
            <Input
              name="confirmMonth"
              value={confirmMonth}
              onChange={e => setConfirmMonth(e.target.value)}
              placeholder={monthKey}
              autoFocus
            />
            {actionData?.error && (
              <div className="text-xs" style={{ color: 'var(--color-error)' }}>{actionData.error}</div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDeleteOpen(false)}>
                取消
              </Button>
              <Button type="submit" variant="destructive" disabled={isDeleting || confirmMonth !== monthKey}>
                {isDeleting ? '删除中...' : '确认删除'}
              </Button>
            </DialogFooter>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
