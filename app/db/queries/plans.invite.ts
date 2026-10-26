import type { AcceptInviteResult } from './plans.types'
import { randomBytes } from 'node:crypto'
import { and, desc, eq, isNull, sql } from 'drizzle-orm'
import { db } from '~/db'
import { planInviteLinks, planMembers, plans } from '~/db/schema'
import { getActivePlanForUser } from './plans.read'

export function createInviteToken() {
  return randomBytes(18).toString('hex')
}

export async function getActiveInviteLink(planId: string, userId: string) {
  const access = await getActivePlanForUser(planId, userId)
  if (!access?.canManage)
    return null

  const rows = await db
    .select()
    .from(planInviteLinks)
    .where(and(
      eq(planInviteLinks.planId, planId),
      isNull(planInviteLinks.revokedAt),
      sql`${planInviteLinks.expiresAt} > clock_timestamp()`,
    ))
    .orderBy(desc(planInviteLinks.createdAt))
    .limit(1)

  return rows[0] || null
}

export async function regenerateInviteLink(planId: string, userId: string, expiresAt: Date) {
  const access = await getActivePlanForUser(planId, userId)
  if (!access?.canManage)
    throw new Error('无权限管理邀请链接')

  const token = createInviteToken()

  await db.transaction(async (tx) => {
    const lockedPlan = await tx
      .select({ id: plans.id })
      .from(plans)
      .where(and(eq(plans.id, planId), isNull(plans.deletedAt)))
      .limit(1)
      .for('update')
    if (!lockedPlan[0])
      throw new Error('计划不存在或已删除')

    await tx
      .update(planInviteLinks)
      .set({ revokedAt: sql`clock_timestamp()`, updatedAt: sql`clock_timestamp()` })
      .where(and(
        eq(planInviteLinks.planId, planId),
        isNull(planInviteLinks.revokedAt),
      ))

    await tx
      .insert(planInviteLinks)
      .values({
        planId,
        token,
        createdByUserId: userId,
        expiresAt,
        createdAt: sql`clock_timestamp()`,
        updatedAt: sql`clock_timestamp()`,
      })
  })

  return { token, expiresAt }
}

export async function revokeInviteLink(planId: string, userId: string) {
  const access = await getActivePlanForUser(planId, userId)
  if (!access?.canManage)
    throw new Error('无权限管理邀请链接')

  await db.transaction(async (tx) => {
    const lockedPlan = await tx
      .select({ id: plans.id })
      .from(plans)
      .where(and(eq(plans.id, planId), isNull(plans.deletedAt)))
      .limit(1)
      .for('update')
    if (!lockedPlan[0])
      throw new Error('计划不存在或已删除')

    await tx
      .update(planInviteLinks)
      .set({ revokedAt: sql`clock_timestamp()`, updatedAt: sql`clock_timestamp()` })
      .where(and(
        eq(planInviteLinks.planId, planId),
        isNull(planInviteLinks.revokedAt),
      ))
  })
}

export async function acceptInviteByToken(token: string, userId: string): Promise<AcceptInviteResult | null> {
  return db.transaction(async (tx) => {
    const lockedPlans = await tx
      .select({ planId: plans.id })
      .from(planInviteLinks)
      .innerJoin(plans, eq(planInviteLinks.planId, plans.id))
      .where(and(
        eq(planInviteLinks.token, token),
        isNull(plans.deletedAt),
      ))
      .limit(1)
      .for('update', { of: plans })

    const lockedPlan = lockedPlans[0]
    if (!lockedPlan)
      return null

    const rows = await tx
      .select({
        planId: planInviteLinks.planId,
        inviteId: planInviteLinks.id,
        inviteCreatedAt: planInviteLinks.createdAt,
      })
      .from(planInviteLinks)
      .where(and(
        eq(planInviteLinks.token, token),
        eq(planInviteLinks.planId, lockedPlan.planId),
        isNull(planInviteLinks.revokedAt),
        sql`${planInviteLinks.expiresAt} > clock_timestamp()`,
      ))
      .limit(1)
      .for('update')

    const invite = rows[0]
    if (!invite)
      return null

    const existingMember = await tx
      .select()
      .from(planMembers)
      .where(and(
        eq(planMembers.planId, invite.planId),
        eq(planMembers.userId, userId),
      ))
      .orderBy(desc(planMembers.createdAt))
      .limit(1)
      .for('update')

    if (existingMember[0] && !existingMember[0].deletedAt)
      return { planId: invite.planId, joined: false }

    if (existingMember[0] && existingMember[0].deletedAt) {
      if (!invite.inviteCreatedAt || invite.inviteCreatedAt <= existingMember[0].deletedAt)
        return null

      await tx
        .update(planMembers)
        .set({ deletedAt: null, role: 'editor', updatedAt: sql`clock_timestamp()` })
        .where(eq(planMembers.id, existingMember[0].id))
    }
    else {
      await tx
        .insert(planMembers)
        .values({
          planId: invite.planId,
          userId,
          role: 'editor',
        })
    }

    return { planId: invite.planId, joined: true }
  })
}
