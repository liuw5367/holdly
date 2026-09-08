import type { PlanDetailView, PlanMemberView, PlanMode, PlanRecordItemView, PlanRecordMemberNoteView, PlanRecordView, PlanSummaryView } from './plans.types'
import { and, asc, desc, eq, inArray, isNull } from 'drizzle-orm'
import { db } from '~/db'
import { planDefaultItems, planMembers, planRecordItems, planRecordMemberNotes, planRecords, plans, profiles } from '~/db/schema'
import { calculatePlanRecordAmounts } from '~/lib/plan-record-amounts'
import { buildMemberDisplayName, formatMonthKey, formatMonthLabel, toAmount } from './plans.types'

export interface ActivePlanAccess {
  plan: typeof plans.$inferSelect
  isOwner: boolean
  canManage: boolean
  canEditAllItems: boolean
}

export async function getActivePlanForUser(planId: string, userId: string): Promise<ActivePlanAccess | null> {
  const planRows = await db
    .select()
    .from(plans)
    .where(and(eq(plans.id, planId), isNull(plans.deletedAt)))
    .limit(1)

  const plan = planRows[0]
  if (!plan)
    return null

  const memberRows = await db
    .select({ role: planMembers.role })
    .from(planMembers)
    .where(and(
      eq(planMembers.planId, planId),
      eq(planMembers.userId, userId),
      isNull(planMembers.deletedAt),
    ))
    .limit(1)

  if (!memberRows[0])
    return null

  const isOwner = plan.ownerId === userId
  return {
    plan,
    isOwner,
    canManage: isOwner,
    canEditAllItems: isOwner || plan.permission === 'all',
  }
}

export async function getMembersByPlanIds(planIds: string[]) {
  if (!planIds.length)
    return new Map<string, PlanMemberView[]>()

  const rows = await db
    .select({
      planId: planMembers.planId,
      userId: planMembers.userId,
      role: planMembers.role,
      note: planMembers.note,
      displayName: profiles.displayName,
      email: profiles.email,
      avatarEmoji: profiles.avatarEmoji,
    })
    .from(planMembers)
    .leftJoin(profiles, eq(planMembers.userId, profiles.id))
    .where(and(inArray(planMembers.planId, planIds), isNull(planMembers.deletedAt)))
    .orderBy(asc(planMembers.createdAt))

  const map = new Map<string, PlanMemberView[]>()
  for (const row of rows) {
    const list = map.get(row.planId) || []
    list.push({
      userId: row.userId,
      role: row.role,
      note: row.note || '',
      displayName: buildMemberDisplayName(row.displayName, row.email),
      avatarEmoji: row.avatarEmoji || '',
    })
    map.set(row.planId, list)
  }

  return map
}

export async function getRecordRowsByPlanIds(planIds: string[]) {
  if (!planIds.length)
    return [] as Array<typeof planRecords.$inferSelect>

  return db
    .select()
    .from(planRecords)
    .where(and(inArray(planRecords.planId, planIds), isNull(planRecords.deletedAt)))
    .orderBy(desc(planRecords.year), desc(planRecords.month), desc(planRecords.updatedAt))
}

export async function getRecordItemsByRecordIds(recordIds: string[]) {
  if (!recordIds.length)
    return [] as Array<typeof planRecordItems.$inferSelect>

  return db
    .select()
    .from(planRecordItems)
    .where(and(inArray(planRecordItems.recordId, recordIds), isNull(planRecordItems.deletedAt)))
}

export async function getRecordMemberNotesByRecordIds(recordIds: string[]) {
  if (!recordIds.length)
    return [] as Array<typeof planRecordMemberNotes.$inferSelect>

  return db
    .select()
    .from(planRecordMemberNotes)
    .where(and(inArray(planRecordMemberNotes.recordId, recordIds), isNull(planRecordMemberNotes.deletedAt)))
}

export function buildRecordViews(
  recordRows: Array<typeof planRecords.$inferSelect>,
  itemRows: Array<typeof planRecordItems.$inferSelect>,
  noteRows: Array<typeof planRecordMemberNotes.$inferSelect>,
  planMode: PlanMode,
  startingValue: number,
) {
  const itemMap = new Map<string, PlanRecordItemView[]>()
  const noteMap = new Map<string, PlanRecordMemberNoteView[]>()

  for (const item of itemRows) {
    const list = itemMap.get(item.recordId) || []
    list.push({
      id: item.id,
      memberId: item.memberId,
      itemType: item.itemType,
      name: item.name,
      amount: toAmount(item.amount),
      updatedAt: item.updatedAt,
    })
    itemMap.set(item.recordId, list)
  }

  for (const note of noteRows) {
    const list = noteMap.get(note.recordId) || []
    list.push({
      id: note.id,
      memberId: note.memberId,
      note: note.note,
      updatedAt: note.updatedAt,
    })
    noteMap.set(note.recordId, list)
  }

  const ascendingRecords = [...recordRows].sort((a, b) => {
    if (a.year !== b.year)
      return a.year - b.year
    if (a.month !== b.month)
      return a.month - b.month
    return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime()
  })

  let previousTotal = startingValue
  const ascendingViews = ascendingRecords.map((record) => {
    const items = itemMap.get(record.id) || []
    const memberNotes = noteMap.get(record.id) || []
    const {
      monthIncome: totalIncome,
      monthExpense: totalExpense,
      netIncome,
      totalValue,
    } = calculatePlanRecordAmounts(previousTotal, planMode, items)
    const recordedTotalValue: number | null = null

    previousTotal = totalValue

    return {
      id: record.id,
      year: record.year,
      month: record.month,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      recordedTotalValue,
      totalIncome,
      totalExpense,
      netIncome,
      totalValue,
      items,
      memberNotes,
    } satisfies PlanRecordView
  })

  return ascendingViews.sort((a, b) => {
    if (a.year !== b.year)
      return b.year - a.year
    if (a.month !== b.month)
      return b.month - a.month
    return new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime()
  })
}

function buildTrend(records: PlanRecordView[], startingValue: number) {
  const now = new Date()
  const monthMap = new Map<string, number>()
  for (const record of records) {
    monthMap.set(formatMonthKey(record.year, record.month), record.totalValue)
  }

  const trend: Array<{ month: string, label: string, amount: number }> = []
  let lastAmount = startingValue
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const year = d.getFullYear()
    const month = d.getMonth() + 1
    const key = formatMonthKey(year, month)
    const amount = monthMap.get(key) ?? lastAmount
    lastAmount = amount
    trend.push({ month: key, label: `${month}月`, amount })
  }

  return trend
}

export async function getPlanSummariesByUserId(userId: string) {
  const joinedRows = await db
    .select({
      id: plans.id,
      name: plans.name,
      emoji: plans.emoji,
      planMode: plans.mode,
      permission: plans.permission,
      startingValue: plans.startingValue,
      createdAt: plans.createdAt,
    })
    .from(planMembers)
    .innerJoin(plans, eq(planMembers.planId, plans.id))
    .where(and(
      eq(planMembers.userId, userId),
      isNull(planMembers.deletedAt),
      isNull(plans.deletedAt),
    ))
    .orderBy(desc(plans.createdAt))

  const planIds = joinedRows.map(row => row.id)
  const membersMap = await getMembersByPlanIds(planIds)
  const recordRows = await getRecordRowsByPlanIds(planIds)
  const recordIds = recordRows.map(row => row.id)
  const itemRows = await getRecordItemsByRecordIds(recordIds)
  const noteRows = await getRecordMemberNotesByRecordIds(recordIds)

  const recordIdsByPlan = new Map<string, Set<string>>()
  for (const record of recordRows) {
    const set = recordIdsByPlan.get(record.planId) || new Set<string>()
    set.add(record.id)
    recordIdsByPlan.set(record.planId, set)
  }

  const recordsByPlan = new Map<string, PlanRecordView[]>()
  for (const row of joinedRows) {
    const rows = recordRows.filter(record => record.planId === row.id)
    const ids = recordIdsByPlan.get(row.id) || new Set<string>()
    recordsByPlan.set(
      row.id,
      buildRecordViews(
        rows,
        itemRows.filter(item => ids.has(item.recordId)),
        noteRows.filter(note => ids.has(note.recordId)),
        row.planMode,
        toAmount(row.startingValue),
      ),
    )
  }

  return joinedRows.map((row) => {
    const records = recordsByPlan.get(row.id) || []
    const latest = records[0]

    return {
      id: row.id,
      name: row.name,
      emoji: row.emoji,
      planMode: row.planMode,
      permission: row.permission,
      members: membersMap.get(row.id) || [],
      latestNetIncome: latest?.netIncome ?? 0,
      latestMonth: latest ? formatMonthLabel(latest.year, latest.month) : '暂无记录',
    } satisfies PlanSummaryView
  })
}

export async function getPlanDetailById(planId: string, userId: string) {
  const access = await getActivePlanForUser(planId, userId)
  if (!access)
    return null

  const plan = access.plan
  const membersMap = await getMembersByPlanIds([planId])

  const defaultItemRows = await db
    .select()
    .from(planDefaultItems)
    .where(and(eq(planDefaultItems.planId, planId), isNull(planDefaultItems.deletedAt)))
    .orderBy(asc(planDefaultItems.sortOrder), asc(planDefaultItems.createdAt))

  const recordRows = await db
    .select()
    .from(planRecords)
    .where(and(eq(planRecords.planId, planId), isNull(planRecords.deletedAt)))
    .orderBy(desc(planRecords.year), desc(planRecords.month), desc(planRecords.updatedAt))

  const itemRows = await getRecordItemsByRecordIds(recordRows.map(r => r.id))
  const noteRows = await getRecordMemberNotesByRecordIds(recordRows.map(r => r.id))
  const records = buildRecordViews(recordRows, itemRows, noteRows, plan.mode, toAmount(plan.startingValue))

  const sortedForTrend = [...records].sort((a, b) => a.year * 100 + a.month - (b.year * 100 + b.month))

  return {
    id: plan.id,
    ownerId: plan.ownerId,
    name: plan.name,
    emoji: plan.emoji,
    planMode: plan.mode,
    permission: plan.permission,
    startingValue: toAmount(plan.startingValue),
    members: membersMap.get(plan.id) || [],
    defaultItems: defaultItemRows.map(item => ({
      id: item.id,
      name: item.name,
      itemType: item.itemType,
      sortOrder: item.sortOrder,
    })),
    records,
    trend: buildTrend(sortedForTrend, toAmount(plan.startingValue)),
    canManage: access.canManage,
    canEditAllItems: access.canEditAllItems,
  } satisfies PlanDetailView
}

export async function getPlanRecordDetail(planId: string, userId: string, year: number, month: number) {
  const access = await getActivePlanForUser(planId, userId)
  if (!access)
    return null

  const allRecords = await db
    .select()
    .from(planRecords)
    .where(and(eq(planRecords.planId, planId), isNull(planRecords.deletedAt)))
    .orderBy(desc(planRecords.year), desc(planRecords.month), desc(planRecords.updatedAt))

  const record = allRecords.find(r => r.year === year && r.month === month)
  if (!record)
    return null

  const recordIds = allRecords.map(r => r.id)
  const [items, noteRows] = await Promise.all([
    getRecordItemsByRecordIds(recordIds),
    getRecordMemberNotesByRecordIds(recordIds),
  ])

  const recordViews = buildRecordViews(
    allRecords,
    items,
    noteRows,
    access.plan.mode,
    toAmount(access.plan.startingValue),
  )
  const recordView = recordViews.find(r => r.id === record.id)
  if (!recordView)
    return null

  const membersMap = await getMembersByPlanIds([planId])
  const memberMap = new Map((membersMap.get(planId) || []).map(member => [member.userId, member]))

  return {
    planId,
    planName: access.plan.name,
    permission: access.plan.permission,
    canManage: access.canManage,
    canEditAllItems: access.canEditAllItems,
    planMode: access.plan.mode,
    record: {
      ...recordView,
      items: recordView.items.map(item => ({
        ...item,
        memberName: memberMap.get(item.memberId)?.displayName || '成员',
        memberEmoji: memberMap.get(item.memberId)?.avatarEmoji || '',
      })),
      memberNotes: recordView.memberNotes.map(note => ({
        ...note,
        memberName: memberMap.get(note.memberId)?.displayName || '成员',
        memberEmoji: memberMap.get(note.memberId)?.avatarEmoji || '',
      })),
    },
    members: membersMap.get(planId) || [],
    startingValue: toAmount(access.plan.startingValue),
  }
}
