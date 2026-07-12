import { addMonths, addYears, format, subDays } from 'date-fns'
import { and, eq, gte, isNull, lte } from 'drizzle-orm'
import { db } from '~/db'
import { assets, profiles, reminderJobs, warranties } from '~/db/schema'
import { renderReminderEmail } from '~/lib/email-template.server'
import { sendEmail } from '~/lib/email.server'
import { isSubscriptionActive } from '~/lib/subscription-status'

export function calcDueDate(asset: typeof assets.$inferSelect, today = new Date()): string | null {
  const todayStr = format(today, 'yyyy-MM-dd')
  if (asset.nextRenewalDate && asset.nextRenewalDate > todayStr) {
    return asset.nextRenewalDate
  }

  const startDate = asset.subscriptionStartDate || asset.purchaseDate
  if (!startDate || !asset.billingCycle)
    return null

  const cycleMonths = { monthly: 1, quarterly: 3, yearly: 12 } as const
  const months = cycleMonths[asset.billingCycle]
  let next = new Date(`${startDate}T00:00:00`)

  while (format(next, 'yyyy-MM-dd') <= todayStr) {
    next = asset.billingCycle === 'yearly' ? addYears(next, 1) : addMonths(next, months)
  }

  return format(next, 'yyyy-MM-dd')
}

export function isReminderProfileEnabled<T extends { reminderEnabled: boolean | null, email: string | null }>(
  profile: T,
): profile is T & { email: string } {
  return profile.reminderEnabled !== false && Boolean(profile.email)
}

export async function processUserReminders(userId: string): Promise<number> {
  const profile = await db
    .select({
      reminderSubscriptionDays: profiles.reminderSubscriptionDays,
      reminderWarrantyDays: profiles.reminderWarrantyDays,
      reminderEnabled: profiles.reminderEnabled,
      email: profiles.email,
    })
    .from(profiles)
    .where(eq(profiles.id, userId))
    .limit(1)
    .then(r => r[0])

  if (!profile || !isReminderProfileEnabled(profile))
    return 0

  const now = new Date()
  const today = format(now, 'yyyy-MM-dd')
  let sentCount = 0

  // ===== 订阅续费提醒 =====
  const activeSubscriptions = await db
    .select()
    .from(assets)
    .where(and(
      eq(assets.userId, userId),
      eq(assets.assetType, 'subscription'),
      isNull(assets.deletedAt),
      eq(assets.reminderEnabled, true),
    ))

  for (const a of activeSubscriptions) {
    if (!isSubscriptionActive(a, today))
      continue
    const reminderDays = a.reminderSubscriptionDaysOverride ?? profile.reminderSubscriptionDays ?? 7
    const dueDate = calcDueDate(a, now)
    if (!dueDate)
      continue

    const reminderDate = subDays(new Date(`${dueDate}T00:00:00`), reminderDays)
    const reminderDateStr = format(reminderDate, 'yyyy-MM-dd')

    if (reminderDateStr > today || dueDate < today)
      continue

    const alreadySent = await db
      .select({ id: reminderJobs.id })
      .from(reminderJobs)
      .where(and(
        eq(reminderJobs.assetId, a.id),
        eq(reminderJobs.reminderType, 'subscription_renewal'),
        gte(reminderJobs.scheduledAt, new Date(`${reminderDateStr}T00:00:00`)),
        lte(reminderJobs.scheduledAt, new Date(`${reminderDateStr}T23:59:59`)),
      ))
      .limit(1)
      .then(r => r[0])

    if (alreadySent)
      continue

    const delivery = await sendEmail({
      to: profile.email,
      subject: `「${a.name}」即将续费`,
      text: `你好，「${a.name}」将于 ${dueDate} 续费（${a.subscriptionPrice || ''}元），请确保账户余额充足。`,
      html: renderReminderEmail({
        title: '订阅续费提醒',
        description: `「${a.name}」即将续费，请提前确认付款信息。`,
        label: '续费日期',
        value: `${dueDate}${a.subscriptionPrice ? ` · ${a.subscriptionPrice} 元` : ''}`,
        note: '请确保支付账户余额充足。如已取消订阅，可以忽略这封邮件。',
      }),
    })

    if (!delivery.ok)
      continue

    await db.insert(reminderJobs).values({
      assetId: a.id,
      userId,
      reminderType: 'subscription_renewal',
      scheduledAt: new Date(`${reminderDateStr}T00:00:00`),
      sentAt: new Date(),
    })

    sentCount++
  }

  // ===== 保修到期提醒 =====
  const activeWarranties = await db
    .select({
      asset: assets,
      warranty: warranties,
    })
    .from(warranties)
    .innerJoin(assets, eq(warranties.assetId, assets.id))
    .where(and(
      eq(assets.userId, userId),
      isNull(assets.deletedAt),
      eq(assets.reminderEnabled, true),
      gte(warranties.endDate, today),
    ))

  for (const { asset: a, warranty: w } of activeWarranties) {
    const reminderDays = a.reminderWarrantyDaysOverride ?? profile.reminderWarrantyDays ?? 14
    const reminderDate = subDays(new Date(`${w.endDate}T00:00:00`), reminderDays)
    const reminderDateStr = format(reminderDate, 'yyyy-MM-dd')

    if (reminderDateStr > today)
      continue

    const alreadySent = await db
      .select({ id: reminderJobs.id })
      .from(reminderJobs)
      .where(and(
        eq(reminderJobs.assetId, a.id),
        eq(reminderJobs.reminderType, 'warranty_expiry'),
        gte(reminderJobs.scheduledAt, new Date(`${reminderDateStr}T00:00:00`)),
        lte(reminderJobs.scheduledAt, new Date(`${reminderDateStr}T23:59:59`)),
      ))
      .limit(1)
      .then(r => r[0])

    if (alreadySent)
      continue

    const delivery = await sendEmail({
      to: profile.email,
      subject: `「${a.name}」保修即将到期`,
      text: `你好，「${a.name}」的保修将于 ${w.endDate} 到期，如需续保请及时处理。`,
      html: renderReminderEmail({
        title: '保修到期提醒',
        description: `「${a.name}」的保修即将到期。`,
        label: '保修到期日',
        value: w.endDate,
        note: '如需续保或申请保修服务，请在到期前及时处理。',
      }),
    })

    if (!delivery.ok)
      continue

    await db.insert(reminderJobs).values({
      assetId: a.id,
      userId,
      reminderType: 'warranty_expiry',
      scheduledAt: new Date(`${reminderDateStr}T00:00:00`),
      sentAt: new Date(),
    })

    sentCount++
  }

  return sentCount
}
