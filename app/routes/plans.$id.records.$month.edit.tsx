import type { Route } from './+types/plans.$id.records.$month.edit'
import {
  IconCheck,
  IconPlus,
  IconTrash,
} from '@tabler/icons-react'
import { useMemo, useState } from 'react'
import { data as loaderDataFn, redirect, useActionData, useLoaderData, useNavigation, useSubmit } from 'react-router'
import { SubPageHeader } from '~/components/page-header'
import { PublicAvatar } from '~/components/public-avatar'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import {
  getPlanDetailById,
  getPlanRecordDetail,
  savePlanRecordPatch,
} from '~/db/queries/plans'
import { buildPlanAvatarToneMap } from '~/lib/plan-avatar'
import { buildPlanMemberGroups } from '~/lib/plan-member-groups'
import { planRecordPatchSchema } from '~/lib/plan.schema'
import { createSupabaseServerClient } from '~/lib/supabase.server'

interface EditableItem {
  id: string
  itemType: 'income' | 'expense'
  memberId: string
  name: string
  amount: string
  expectedUpdatedAt?: string
}

interface EditableMemberNote {
  memberId: string
  note: string
  expectedUpdatedAt?: string
  displayName: string
  avatarEmoji: string
}

const CURRENT_YEAR = new Date().getFullYear()

export async function loader({ request, params }: Route.LoaderArgs) {
  const { supabase, headers } = createSupabaseServerClient(request)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user)
    throw redirect('/login', { headers })

  const [yearStr, monthStr] = (params.month ?? '').split('-')
  const year = Number(yearStr)
  const month = Number(monthStr)
  const blankMode = new URL(request.url).searchParams.get('blank') === '1'

  if (!Number.isFinite(year) || !Number.isFinite(month))
    throw new Response('Not Found', { status: 404 })

  const [recordData, planDetail] = await Promise.all([
    getPlanRecordDetail(params.id, user.id, year, month),
    getPlanDetailById(params.id, user.id),
  ])

  if (!planDetail)
    throw new Response('Not Found', { status: 404 })

  if (recordData && !blankMode) {
    const existingNoteMap = new Map(recordData.record.memberNotes.map(note => [note.memberId, note]))
    const normalizedNotes = planDetail.members.map((member) => {
      const existing = existingNoteMap.get(member.userId)
      return {
        memberId: member.userId,
        note: existing?.note || '',
        expectedUpdatedAt: existing?.updatedAt ? existing.updatedAt.toISOString() : undefined,
        displayName: member.displayName,
        avatarEmoji: member.avatarEmoji,
      }
    })

    const existingItems = recordData.record.items.map(item => ({
      id: item.id,
      itemType: item.itemType,
      memberId: item.memberId,
      name: item.name,
      amount: Number(item.amount) === 0 ? '' : String(item.amount),
      expectedUpdatedAt: item.updatedAt?.toISOString(),
    }))
    const existingDefaultKeys = new Set(existingItems.map(item => `${item.memberId}::${item.itemType}::${item.name}`))
    const missingDefaultItems = planDetail.members.flatMap((member, memberIndex) =>
      planDetail.defaultItems
        .filter(item => !existingDefaultKeys.has(`${member.userId}::${item.itemType}::${item.name}`))
        .map((item, itemIndex) => ({
          id: `new-default-${memberIndex}-${itemIndex}`,
          itemType: item.itemType,
          memberId: member.userId,
          name: item.name,
          amount: '',
        })))

    return loaderDataFn({
      mode: 'edit' as const,
      blankMode: false,
      planId: params.id,
      month,
      year,
      planMode: recordData.planMode,
      currentUserId: user.id,
      canEditAllItems: recordData.canEditAllItems,
      members: planDetail.members,
      recordUpdatedAt: recordData.record.updatedAt?.toISOString(),
      memberNotes: normalizedNotes,
      items: [...existingItems, ...missingDefaultItems],
    }, { headers })
  }

  const defaultItems = planDetail.members.flatMap((member, memberIndex) =>
    planDetail.defaultItems.map((item, itemIndex) => ({
      id: `new-default-${memberIndex}-${itemIndex}`,
      itemType: item.itemType,
      memberId: member.userId,
      name: item.name,
      amount: '',
    })))

  return loaderDataFn({
    mode: 'create' as const,
    blankMode,
    planId: params.id,
    month,
    year,
    planMode: planDetail.planMode,
    currentUserId: user.id,
    canEditAllItems: planDetail.canEditAllItems,
    members: planDetail.members,
    recordUpdatedAt: undefined,
    memberNotes: planDetail.members.map(member => ({
      memberId: member.userId,
      note: '',
      expectedUpdatedAt: undefined,
      displayName: member.displayName,
      avatarEmoji: member.avatarEmoji,
    })),
    items: defaultItems,
  }, { headers })
}

export async function action({ request, params }: Route.ActionArgs) {
  const { supabase, headers } = createSupabaseServerClient(request)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user)
    throw redirect('/login', { headers })

  const formData = await request.formData()
  const payloadText = String(formData.get('payload') || '')

  let payloadRaw: unknown
  try {
    payloadRaw = JSON.parse(payloadText)
  }
  catch {
    return loaderDataFn({ error: '提交数据格式错误' }, { headers })
  }

  const parsed = planRecordPatchSchema.safeParse(payloadRaw)
  if (!parsed.success)
    return loaderDataFn({ error: parsed.error.issues[0].message }, { headers })

  try {
    const result = await savePlanRecordPatch({
      planId: params.id,
      userId: user.id,
      mode: parsed.data.mode,
      year: parsed.data.year,
      month: parsed.data.month,
      expectedRecordUpdatedAt: parsed.data.expectedRecordUpdatedAt,
      addedItems: parsed.data.addedItems,
      updatedItems: parsed.data.updatedItems,
      deletedItems: parsed.data.deletedItems,
      memberNotes: parsed.data.memberNotes,
    })

    return redirect(`/plans/${params.id}/records/${result.monthKey}`, { headers })
  }
  catch (error) {
    return loaderDataFn({ error: error instanceof Error ? error.message : '保存失败' }, { headers })
  }
}

function itemEditable(item: EditableItem, currentUserId: string, canEditAllItems: boolean) {
  if (canEditAllItems)
    return true
  return item.memberId === currentUserId
}

export default function PlansRecordsMonthEdit() {
  const data = useLoaderData<typeof loader>()
  const actionData = useActionData<typeof action>()
  const submit = useSubmit()
  const navigation = useNavigation()

  const [selectedYear, setSelectedYear] = useState(data.year)
  const [selectedMonth, setSelectedMonth] = useState(data.month)
  const [items, setItems] = useState<EditableItem[]>(data.items)
  const [deletedItems, setDeletedItems] = useState<Array<{ id: string, expectedUpdatedAt?: string }>>([])
  const [memberNotes, setMemberNotes] = useState<EditableMemberNote[]>(data.memberNotes)

  const initialMap = useMemo(() => {
    const map = new Map<string, EditableItem>()
    for (const item of data.items) {
      if (!item.id.startsWith('new-'))
        map.set(item.id, item)
    }
    return map
  }, [data.items])
  const initialNotesMap = useMemo(() => {
    const map = new Map<string, EditableMemberNote>()
    for (const note of data.memberNotes)
      map.set(note.memberId, note)
    return map
  }, [data.memberNotes])

  const isSubmitting = navigation.state !== 'idle'

  const years = Array.from({ length: CURRENT_YEAR + 2 - 2020 + 1 }, (_, i) => 2020 + i)
  const months = Array.from({ length: 12 }, (_, i) => i + 1)

  function addItem(memberId: string, type: 'income' | 'expense') {
    setItems(prev => [...prev, {
      id: `new-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      itemType: type,
      memberId,
      name: '',
      amount: '',
    }])
  }

  function updateItem(id: string, patch: Partial<EditableItem>) {
    setItems(prev => prev.map(item => item.id === id ? { ...item, ...patch } : item))
  }

  function removeItem(id: string) {
    setItems((prev) => {
      const found = prev.find(item => item.id === id)
      if (found && !found.id.startsWith('new-')) {
        setDeletedItems(list => [...list, { id: found.id, expectedUpdatedAt: found.expectedUpdatedAt }])
      }
      return prev.filter(item => item.id !== id)
    })
  }

  function updateMemberNote(memberId: string, note: string) {
    setMemberNotes(prev => prev.map(item => item.memberId === memberId ? { ...item, note } : item))
  }

  function buildPatch() {
    const addedItems: Array<{ memberId: string, itemType: 'income' | 'expense', name: string, amount: string }> = []
    const updatedItems: Array<{ id: string, memberId: string, name: string, amount: string, expectedUpdatedAt?: string }> = []

    for (const item of items) {
      const editable = itemEditable(item, data.currentUserId, data.canEditAllItems)
      const amountText = item.amount.trim() || '0'
      if (item.id.startsWith('new-')) {
        if (!editable)
          continue
        if (item.id.startsWith('new-default-') && item.amount.trim() === '')
          continue
        if (!item.name.trim())
          continue
        addedItems.push({
          memberId: item.memberId,
          itemType: item.itemType,
          name: item.name,
          amount: amountText,
        })
        continue
      }

      const initial = initialMap.get(item.id)
      if (!initial)
        continue
      if (!editable)
        continue

      const changed
        = initial.name !== item.name
          || Number(initial.amount) !== Number(amountText)
          || initial.memberId !== item.memberId

      if (!changed)
        continue

      updatedItems.push({
        id: item.id,
        memberId: item.memberId,
        name: item.name,
        amount: amountText,
        expectedUpdatedAt: item.expectedUpdatedAt,
      })
    }

    const changedNotes = memberNotes
      .filter((note) => {
        const initial = initialNotesMap.get(note.memberId)
        if (!initial)
          return note.note.trim().length > 0
        return initial.note !== note.note
      })
      .map(note => ({
        memberId: note.memberId,
        note: note.note,
        expectedUpdatedAt: note.expectedUpdatedAt,
      }))

    return {
      mode: data.planMode,
      year: selectedYear,
      month: selectedMonth,
      expectedRecordUpdatedAt: data.recordUpdatedAt,
      addedItems,
      updatedItems,
      deletedItems,
      memberNotes: changedNotes,
    }
  }

  function handleSave() {
    const patch = buildPatch()
    const fd = new FormData()
    fd.set('payload', JSON.stringify(patch))
    submit(fd, { method: 'post' })
  }

  const currentMonthKey = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`
  const memberGroups = useMemo(
    () => buildPlanMemberGroups(data.members, items, data.currentUserId, true),
    [data.currentUserId, data.members, items],
  )
  const memberNoteMap = useMemo(
    () => new Map(memberNotes.map(note => [note.memberId, note])),
    [memberNotes],
  )
  const memberToneMap = useMemo(
    () => buildPlanAvatarToneMap(data.members.map(member => member.userId)),
    [data.members],
  )

  return (
    <div className="pb-24">
      <SubPageHeader
        backTo={data.blankMode ? `/plans/${data.planId}` : `/plans/${data.planId}/records/${data.year}-${String(data.month).padStart(2, '0')}`}
        backLabel="返回"
        title={currentMonthKey}
        primaryAction={{
          label: isSubmitting ? '保存中...' : '保存',
          icon: IconCheck,
          onClick: handleSave,
        }}
      />

      <div className="mb-6 grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1.5 block text-xs font-medium" style={{ color: 'var(--color-muted)' }}>
            年份
          </label>
          <Select value={String(selectedYear)} onValueChange={v => setSelectedYear(Number(v))}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="选择年份">{value => `${value}年`}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {years.map(year => (
                  <SelectItem key={year} value={String(year)}>
                    {year}
                    年
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium" style={{ color: 'var(--color-muted)' }}>
            月份
          </label>
          <Select value={String(selectedMonth)} onValueChange={v => setSelectedMonth(Number(v))}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="选择月份">{value => `${value}月`}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {months.map(month => (
                  <SelectItem key={month} value={String(month)}>
                    {month}
                    月
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="mb-6 space-y-4">
        {memberGroups.map((group) => {
          const editable = group.isActiveMember && (data.canEditAllItems || group.member.userId === data.currentUserId)
          const note = memberNoteMap.get(group.member.userId)
          const itemSections = [
            { label: '收入', type: 'income' as const, items: group.incomeItems, color: 'var(--color-success)' },
            { label: '支出', type: 'expense' as const, items: group.expenseItems, color: 'var(--color-error)' },
          ]

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
                  {!editable && <span className="rounded px-1.5 py-0.5 text-[10px]" style={{ color: 'var(--color-muted)', background: 'var(--color-surface-soft)' }}>只读</span>}
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

              <div className="space-y-4 p-3">
                {itemSections.map(section => (
                  <div key={section.type}>
                    <div className="mb-2 text-xs font-medium" style={{ color: section.color }}>{section.label}</div>
                    <div className="space-y-2">
                      {section.items.map(item => (
                        <div key={item.id} className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
                          <Input
                            type="text"
                            value={item.name}
                            onChange={e => updateItem(item.id, { name: e.target.value })}
                            placeholder="项目名称"
                            className="h-9 min-w-[160px] flex-1"
                            disabled={!editable}
                          />
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.amount}
                            onChange={e => updateItem(item.id, { amount: e.target.value })}
                            placeholder="金额"
                            className="h-9 min-w-0 flex-1 font-[family-name:var(--font-mono)] sm:w-32 sm:flex-none"
                            disabled={!editable}
                          />
                          {editable && (
                            <Button type="button" variant="ghost" size="icon-sm" onClick={() => removeItem(item.id)} className="shrink-0">
                              <IconTrash size={14} />
                            </Button>
                          )}
                        </div>
                      ))}
                      {editable && (
                        <Button type="button" variant="outline" size="sm" className="h-9 w-full border-dashed" onClick={() => addItem(group.member.userId, section.type)}>
                          <IconPlus size={14} />
                          添加
                          {section.label}
                          项
                        </Button>
                      )}
                    </div>
                  </div>
                ))}

                {note && (
                  <div>
                    <div className="mb-2 text-xs font-medium" style={{ color: 'var(--color-muted)' }}>备注</div>
                    {note.memberId === data.currentUserId
                      ? (
                          <Input
                            type="text"
                            value={note.note}
                            onChange={e => updateMemberNote(note.memberId, e.target.value)}
                            placeholder="填写备注"
                            className="h-9 text-xs"
                          />
                        )
                      : <div className="rounded-md px-2.5 py-2 text-xs leading-5" style={{ color: 'var(--color-body)', background: 'var(--color-surface-soft)' }}>{note.note || '暂无备注'}</div>}
                  </div>
                )}
              </div>
            </section>
          )
        })}
      </div>

      {actionData?.error && (
        <div className="mb-4 text-sm" style={{ color: 'var(--color-error)' }}>
          {actionData.error}
        </div>
      )}

      <div
        className="py-3 md:hidden"
        style={{
          background: 'var(--color-canvas)',
          borderColor: 'var(--color-hairline)',
        }}
      >
        <Button type="button" className="h-11 w-full" onClick={handleSave} disabled={isSubmitting}>
          <IconCheck size={16} />
          {isSubmitting ? '保存中...' : '保存记录'}
        </Button>
      </div>
    </div>
  )
}
