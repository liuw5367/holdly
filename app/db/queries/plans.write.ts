import type { PlanMemberRole, PlanRecordPatchInput, SavePlanInput, SavePlanRecordResult } from './plans.types'
import { and, eq, isNull, sql } from 'drizzle-orm'
import { db } from '~/db'
import { planDefaultItems, planMembers, planRecordItems, planRecordMemberNotes, planRecords, plans } from '~/db/schema'
import { getActivePlanForUser } from './plans.read'
import { formatMonthKey, normalizeName } from './plans.types'

function assertMemberEditable(canEditAllItems: boolean, itemMemberId: string, userId: string) {
  if (canEditAllItems)
    return

  if (itemMemberId !== userId)
    throw new Error('权限不足：不能编辑其他成员记录')
}

export async function savePlan(input: SavePlanInput) {
  const normalizedName = normalizeName(input.name)
  if (!normalizedName)
    throw new Error('计划名称不能为空')

  const uniqueMembers = new Map<string, { userId: string, role: PlanMemberRole, note?: string }>()
  for (const member of input.members) {
    uniqueMembers.set(member.userId, member)
  }
  if (!uniqueMembers.has(input.userId)) {
    uniqueMembers.set(input.userId, { userId: input.userId, role: 'owner' as const, note: '' })
  }
  if (!input.planId && [...uniqueMembers.keys()].some(userId => userId !== input.userId))
    throw new Error('计划成员无效，请通过邀请链接添加成员')

  if (input.planId) {
    const access = await getActivePlanForUser(input.planId, input.userId)
    if (!access?.canManage)
      throw new Error('无权限编辑该计划')
  }

  return db.transaction(async (tx) => {
    let planId = input.planId
    let allowedMemberIds = new Set([input.userId])

    if (planId) {
      const lockedPlan = await tx
        .select({ id: plans.id })
        .from(plans)
        .where(and(eq(plans.id, planId), isNull(plans.deletedAt)))
        .limit(1)
        .for('update')
      if (!lockedPlan[0])
        throw new Error('计划不存在或已删除')

      const activeMembers = await tx
        .select({ userId: planMembers.userId })
        .from(planMembers)
        .where(and(eq(planMembers.planId, planId), isNull(planMembers.deletedAt)))
      allowedMemberIds = new Set(activeMembers.map(member => member.userId))

      await tx
        .update(plans)
        .set({
          name: normalizedName,
          emoji: input.emoji || '💰',
          mode: input.planMode,
          permission: input.permission,
          startingValue: input.startingValue,
          updatedAt: new Date(),
        })
        .where(and(eq(plans.id, planId), isNull(plans.deletedAt)))
    }
    else {
      const inserted = await tx
        .insert(plans)
        .values({
          ownerId: input.userId,
          name: normalizedName,
          emoji: input.emoji || '💰',
          mode: input.planMode,
          permission: input.permission,
          startingValue: input.startingValue,
        })
        .returning({ id: plans.id })

      planId = inserted[0].id
    }

    const members = [...uniqueMembers.values()]
    if (members.some(member => !allowedMemberIds.has(member.userId)))
      throw new Error('计划成员无效，请通过邀请链接添加成员')

    await tx
      .update(planMembers)
      .set({ deletedAt: sql`clock_timestamp()`, updatedAt: sql`clock_timestamp()` })
      .where(and(eq(planMembers.planId, planId), isNull(planMembers.deletedAt)))

    for (const member of members) {
      await tx
        .insert(planMembers)
        .values({
          planId,
          userId: member.userId,
          role: member.userId === input.userId ? 'owner' : 'editor',
          note: member.note?.trim() || null,
        })
    }

    await tx
      .update(planDefaultItems)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(planDefaultItems.planId, planId), isNull(planDefaultItems.deletedAt)))

    if (input.defaultItems.length) {
      await tx
        .insert(planDefaultItems)
        .values(input.defaultItems
          .filter(item => item.name.trim())
          .map(item => ({
            planId,
            itemType: item.itemType,
            name: item.name.trim(),
            sortOrder: item.sortOrder,
          })))
    }

    return planId
  })
}

export async function savePlanRecordPatch(
  input: PlanRecordPatchInput,
): Promise<SavePlanRecordResult> {
  const now = new Date()

  return db.transaction(async (tx) => {
    const [authorization] = await tx
      .select({
        mode: plans.mode,
        ownerId: plans.ownerId,
        permission: plans.permission,
      })
      .from(plans)
      .innerJoin(planMembers, and(
        eq(planMembers.planId, plans.id),
        eq(planMembers.userId, input.userId),
        isNull(planMembers.deletedAt),
      ))
      .where(and(eq(plans.id, input.planId), isNull(plans.deletedAt)))
      .for('update')
    if (!authorization)
      throw new Error('计划不存在或无访问权限')
    if (authorization.mode !== input.mode)
      throw new Error('计划模式已变更，请刷新后重试')

    const canEditAllItems = authorization.ownerId === input.userId || authorization.permission === 'all'
    const activeMembers = await tx
      .select({ userId: planMembers.userId })
      .from(planMembers)
      .where(and(eq(planMembers.planId, input.planId), isNull(planMembers.deletedAt)))
      .for('update')
    const activeMemberIds = new Set(activeMembers.map(member => member.userId))
    const requestedMemberIds = [
      ...input.addedItems.map(item => item.memberId),
      ...input.updatedItems.map(item => item.memberId),
      ...input.memberNotes.map(note => note.memberId),
    ]
    if (requestedMemberIds.some(memberId => !activeMemberIds.has(memberId)))
      throw new Error('记录成员无效，请刷新后重试')

    let record = await tx
      .select()
      .from(planRecords)
      .where(and(
        eq(planRecords.planId, input.planId),
        eq(planRecords.year, input.year),
        eq(planRecords.month, input.month),
      ))
      .limit(1)
      .then(rows => rows[0])

    if (!record) {
      const inserted = await tx
        .insert(planRecords)
        .values({
          planId: input.planId,
          year: input.year,
          month: input.month,
          deletedAt: null,
          updatedAt: now,
        })
        .returning()
      record = inserted[0]
    }
    else if (record.deletedAt) {
      const revived = await tx
        .update(planRecords)
        .set({ deletedAt: null, updatedAt: now })
        .where(eq(planRecords.id, record.id))
        .returning()
      record = revived[0]
    }

    if (input.expectedRecordUpdatedAt && record.updatedAt) {
      const expected = new Date(input.expectedRecordUpdatedAt).getTime()
      const actual = new Date(record.updatedAt).getTime()
      if (expected !== actual) {
        throw new Error('记录已被其他成员更新，请刷新后重试')
      }
    }

    const existingItems = await tx
      .select()
      .from(planRecordItems)
      .where(and(eq(planRecordItems.recordId, record.id), isNull(planRecordItems.deletedAt)))

    const existingMap = new Map(existingItems.map(item => [item.id, item]))

    for (const item of input.deletedItems) {
      const existing = existingMap.get(item.id)
      if (!existing)
        continue

      assertMemberEditable(canEditAllItems, existing.memberId, input.userId)

      if (item.expectedUpdatedAt && existing.updatedAt) {
        const expected = new Date(item.expectedUpdatedAt).getTime()
        const actual = new Date(existing.updatedAt).getTime()
        if (expected !== actual)
          throw new Error('记录条目已变更，请刷新后重试')
      }

      await tx
        .update(planRecordItems)
        .set({ deletedAt: now, updatedAt: now })
        .where(eq(planRecordItems.id, item.id))
    }

    for (const item of input.updatedItems) {
      const existing = existingMap.get(item.id)
      if (!existing)
        continue

      assertMemberEditable(canEditAllItems, existing.memberId, input.userId)

      if (item.expectedUpdatedAt && existing.updatedAt) {
        const expected = new Date(item.expectedUpdatedAt).getTime()
        const actual = new Date(existing.updatedAt).getTime()
        if (expected !== actual)
          throw new Error('记录条目已变更，请刷新后重试')
      }

      assertMemberEditable(canEditAllItems, item.memberId, input.userId)

      await tx
        .update(planRecordItems)
        .set({
          memberId: item.memberId,
          name: item.name.trim(),
          amount: item.amount,
          updatedAt: now,
        })
        .where(eq(planRecordItems.id, item.id))
    }

    for (const item of input.addedItems) {
      assertMemberEditable(canEditAllItems, item.memberId, input.userId)

      if (!item.name.trim())
        continue

      await tx
        .insert(planRecordItems)
        .values({
          recordId: record.id,
          memberId: item.memberId,
          itemType: item.itemType,
          name: item.name.trim(),
          amount: item.amount,
        })
    }

    if (input.memberNotes.length > 0) {
      const existingNotesAll = await tx
        .select()
        .from(planRecordMemberNotes)
        .where(eq(planRecordMemberNotes.recordId, record.id))

      const existingNotesMap = new Map(existingNotesAll.map(note => [note.memberId, note]))

      for (const noteInput of input.memberNotes) {
        assertMemberEditable(canEditAllItems, noteInput.memberId, input.userId)

        const normalizedNote = noteInput.note.trim()
        const existing = existingNotesMap.get(noteInput.memberId)

        if (existing) {
          if (noteInput.expectedUpdatedAt && existing.updatedAt) {
            const expected = new Date(noteInput.expectedUpdatedAt).getTime()
            const actual = new Date(existing.updatedAt).getTime()
            if (expected !== actual)
              throw new Error('成员备注已变更，请刷新后重试')
          }

          await tx
            .update(planRecordMemberNotes)
            .set({
              note: normalizedNote,
              deletedAt: normalizedNote ? null : now,
              updatedAt: now,
            })
            .where(eq(planRecordMemberNotes.id, existing.id))
          continue
        }

        if (!normalizedNote)
          continue

        await tx
          .insert(planRecordMemberNotes)
          .values({
            recordId: record.id,
            memberId: noteInput.memberId,
            note: normalizedNote,
          })
      }
    }

    await tx
      .update(planRecords)
      .set({
        recordedTotalValue: null,
        updatedAt: now,
      })
      .where(eq(planRecords.id, record.id))

    return {
      recordId: record.id,
      monthKey: formatMonthKey(input.year, input.month),
    }
  })
}

export async function softDeletePlan(planId: string, userId: string) {
  const access = await getActivePlanForUser(planId, userId)
  if (!access?.canManage)
    throw new Error('无权限删除计划')

  await db
    .update(plans)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(plans.id, planId))
}

export async function softDeletePlanRecord(planId: string, userId: string, year: number, month: number) {
  const access = await getActivePlanForUser(planId, userId)
  if (!access?.canManage)
    throw new Error('无权限删除记录')

  const rows = await db
    .select({ id: planRecords.id })
    .from(planRecords)
    .where(and(
      eq(planRecords.planId, planId),
      eq(planRecords.year, year),
      eq(planRecords.month, month),
      isNull(planRecords.deletedAt),
    ))
    .limit(1)

  if (!rows[0])
    return

  await db
    .update(planRecords)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(planRecords.id, rows[0].id))
}
