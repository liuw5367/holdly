import { and, asc, desc, eq, isNull } from 'drizzle-orm'
import { db } from '~/db'
import {
  assets,
  assetTags,
  categories,
  paymentAccounts,
  paymentTypes,
  profiles,
  tags,
} from '~/db/schema'

export async function getSettingsProfileByUserId(userId: string) {
  const rows = await db
    .select({
      id: profiles.id,
      displayName: profiles.displayName,
      email: profiles.email,
      avatarEmoji: profiles.avatarEmoji,
      reminderEnabled: profiles.reminderEnabled,
      reminderSubscriptionDays: profiles.reminderSubscriptionDays,
      reminderWarrantyDays: profiles.reminderWarrantyDays,
      backupEnabled: profiles.backupEnabled,
      backupDayOfMonth: profiles.backupDayOfMonth,
      backupFrequency: profiles.backupFrequency,
    })
    .from(profiles)
    .where(eq(profiles.id, userId))
    .limit(1)

  return rows[0] ?? null
}

export async function updateSettingsProfile(userId: string, input: { displayName: string, avatarEmoji: string }) {
  const [row] = await db
    .update(profiles)
    .set({
      displayName: input.displayName,
      avatarEmoji: input.avatarEmoji,
      updatedAt: new Date(),
    })
    .where(eq(profiles.id, userId))
    .returning({ id: profiles.id })

  return row ?? null
}

export async function updateSettingsReminderConfig(
  userId: string,
  input: { reminderEnabled: boolean, reminderSubscriptionDays: number, reminderWarrantyDays: number },
) {
  const [row] = await db
    .update(profiles)
    .set({
      reminderEnabled: input.reminderEnabled,
      reminderSubscriptionDays: input.reminderSubscriptionDays,
      reminderWarrantyDays: input.reminderWarrantyDays,
      updatedAt: new Date(),
    })
    .returning({ id: profiles.id })

  return row ?? null
}

export async function getSettingsCategoriesByUserId(userId: string) {
  return db
    .select({
      id: categories.id,
      name: categories.name,
      emoji: categories.emoji,
      isPreset: categories.isPreset,
      sortOrder: categories.sortOrder,
    })
    .from(categories)
    .where(and(eq(categories.userId, userId), isNull(categories.deletedAt)))
    .orderBy(asc(categories.sortOrder), asc(categories.createdAt))
}

export async function createSettingsCategory(userId: string, input: { name: string, emoji: string }) {
  const current = await db
    .select({
      sortOrder: categories.sortOrder,
    })
    .from(categories)
    .where(and(eq(categories.userId, userId), isNull(categories.deletedAt)))
    .orderBy(desc(categories.sortOrder))
    .limit(1)

  const [row] = await db
    .insert(categories)
    .values({
      userId,
      name: input.name,
      emoji: input.emoji || '📦',
      isPreset: false,
      sortOrder: (current[0]?.sortOrder ?? 0) + 1,
    })
    .returning({ id: categories.id })

  return row.id
}

export async function updateSettingsCategory(userId: string, id: string, input: { name: string, emoji?: string }) {
  await db
    .update(categories)
    .set({
      name: input.name,
      ...(input.emoji ? { emoji: input.emoji } : {}),
    })
    .where(and(eq(categories.id, id), eq(categories.userId, userId), isNull(categories.deletedAt)))
}

export async function softDeleteSettingsCategory(userId: string, id: string) {
  await db
    .update(categories)
    .set({ deletedAt: new Date() })
    .where(and(eq(categories.id, id), eq(categories.userId, userId), isNull(categories.deletedAt)))

  await db
    .update(assets)
    .set({ categoryId: null, updatedAt: new Date() })
    .where(and(eq(assets.userId, userId), eq(assets.categoryId, id), isNull(assets.deletedAt)))
}

export async function getSettingsTagsByUserId(userId: string) {
  const tagRows = await db
    .select({
      id: tags.id,
      name: tags.name,
      color: tags.color,
    })
    .from(tags)
    .where(and(eq(tags.userId, userId), isNull(tags.deletedAt)))
    .orderBy(asc(tags.createdAt))

  const tagAssetRows = await db
    .select({
      assetId: assetTags.assetId,
      tagId: assetTags.tagId,
    })
    .from(assetTags)
    .innerJoin(assets, eq(assetTags.assetId, assets.id))
    .innerJoin(tags, eq(assetTags.tagId, tags.id))
    .where(and(eq(assets.userId, userId), isNull(assets.deletedAt), isNull(tags.deletedAt)))

  const counts = new Map<string, number>()
  for (const row of tagAssetRows) {
    counts.set(row.tagId, (counts.get(row.tagId) ?? 0) + 1)
  }

  return tagRows.map(tag => ({
    ...tag,
    assetCount: counts.get(tag.id) ?? 0,
  }))
}

export async function createSettingsTag(userId: string, input: { name: string, color: string }) {
  const [row] = await db
    .insert(tags)
    .values({
      userId,
      name: input.name,
      color: input.color || '#cc785c',
    })
    .returning({ id: tags.id })

  return row.id
}

export async function updateSettingsTag(userId: string, id: string, input: { name: string, color?: string }) {
  await db
    .update(tags)
    .set({
      name: input.name,
      ...(input.color ? { color: input.color } : {}),
    })
    .where(and(eq(tags.id, id), eq(tags.userId, userId), isNull(tags.deletedAt)))
}

export async function softDeleteSettingsTag(userId: string, id: string) {
  const tagRows = await db
    .select({ id: tags.id })
    .from(tags)
    .where(and(eq(tags.id, id), eq(tags.userId, userId), isNull(tags.deletedAt)))
    .limit(1)

  if (!tagRows[0])
    return

  await db
    .update(tags)
    .set({ deletedAt: new Date() })
    .where(eq(tags.id, id))

  await db
    .delete(assetTags)
    .where(eq(assetTags.tagId, id))
}

export async function getSettingsPaymentTypesByUserId(userId: string) {
  return db
    .select({
      id: paymentTypes.id,
      name: paymentTypes.name,
      isPreset: paymentTypes.isPreset,
    })
    .from(paymentTypes)
    .where(and(eq(paymentTypes.userId, userId), isNull(paymentTypes.deletedAt)))
    .orderBy(asc(paymentTypes.name))
}

export async function createSettingsPaymentType(userId: string, input: { name: string }) {
  const [row] = await db
    .insert(paymentTypes)
    .values({
      userId,
      name: input.name,
      isPreset: false,
    })
    .returning({ id: paymentTypes.id })

  return row.id
}

export async function updateSettingsPaymentType(userId: string, id: string, input: { name: string }) {
  await db
    .update(paymentTypes)
    .set({ name: input.name })
    .where(and(eq(paymentTypes.id, id), eq(paymentTypes.userId, userId), isNull(paymentTypes.deletedAt)))
}

export async function softDeleteSettingsPaymentType(userId: string, id: string) {
  const rows = await db
    .select({ isPreset: paymentTypes.isPreset })
    .from(paymentTypes)
    .where(and(eq(paymentTypes.id, id), eq(paymentTypes.userId, userId), isNull(paymentTypes.deletedAt)))
    .limit(1)

  if (!rows[0] || rows[0].isPreset)
    return

  await db
    .update(paymentTypes)
    .set({ deletedAt: new Date() })
    .where(and(eq(paymentTypes.id, id), eq(paymentTypes.userId, userId), isNull(paymentTypes.deletedAt)))

  await db
    .update(paymentAccounts)
    .set({ deletedAt: new Date() })
    .where(and(eq(paymentAccounts.userId, userId), eq(paymentAccounts.paymentTypeId, id), isNull(paymentAccounts.deletedAt)))
}

export async function getSettingsPaymentAccountsByUserId(userId: string) {
  return db
    .select({
      id: paymentAccounts.id,
      name: paymentAccounts.name,
      paymentTypeId: paymentAccounts.paymentTypeId,
      accountKind: paymentAccounts.accountKind,
      bankName: paymentAccounts.bankName,
      lastFour: paymentAccounts.lastFour,
      currencyCode: paymentAccounts.currencyCode,
      isActive: paymentAccounts.isActive,
    })
    .from(paymentAccounts)
    .where(and(eq(paymentAccounts.userId, userId), isNull(paymentAccounts.deletedAt)))
    .orderBy(asc(paymentAccounts.name))
}

export async function getSettingsPaymentAccountById(userId: string, id: string) {
  const [account] = await db.select()
    .from(paymentAccounts)
    .where(and(eq(paymentAccounts.id, id), eq(paymentAccounts.userId, userId), isNull(paymentAccounts.deletedAt)))
    .limit(1)
  return account ?? null
}

export async function getSubscriptionsByPaymentAccount(userId: string, paymentAccountId: string) {
  return db.select({
    id: assets.id,
    name: assets.name,
    emoji: assets.emoji,
    subscriptionPrice: assets.subscriptionPrice,
    billingCycle: assets.billingCycle,
    nextRenewalDate: assets.nextRenewalDate,
    subscriptionStatus: assets.subscriptionStatus,
    subscriptionStoppedAt: assets.subscriptionStoppedAt,
  })
    .from(assets)
    .where(and(
      eq(assets.userId, userId),
      eq(assets.assetType, 'subscription'),
      eq(assets.paymentAccountId, paymentAccountId),
      isNull(assets.deletedAt),
    ))
    .orderBy(assets.nextRenewalDate)
}

export interface CreditCardAccountInput {
  paymentTypeId: string
  name: string
  bankName: string
  lastFour?: string
  notes?: string
  statementDay: number
  repaymentRule: 'fixed_day' | 'days_after_statement'
  repaymentDay?: number
  repaymentDaysAfterStatement?: number
  creditLimit?: string
  currencyCode: string
}

export async function createSettingsCreditCard(userId: string, input: CreditCardAccountInput) {
  return db.transaction(async (tx) => {
    const [paymentType] = await tx.select({ id: paymentTypes.id })
      .from(paymentTypes)
      .where(and(eq(paymentTypes.id, input.paymentTypeId), eq(paymentTypes.userId, userId), isNull(paymentTypes.deletedAt)))
      .limit(1)
    if (!paymentType)
      return null

    const [row] = await tx.insert(paymentAccounts).values({
      userId,
      accountKind: 'credit_card',
      ...input,
      lastFour: input.lastFour || null,
      notes: input.notes || null,
      repaymentDay: input.repaymentRule === 'fixed_day' ? input.repaymentDay : null,
      repaymentDaysAfterStatement: input.repaymentRule === 'days_after_statement' ? input.repaymentDaysAfterStatement : null,
      creditLimit: input.creditLimit || null,
    }).returning({ id: paymentAccounts.id })
    return row?.id ?? null
  })
}

export async function updateSettingsCreditCard(userId: string, id: string, input: CreditCardAccountInput) {
  return db.transaction(async (tx) => {
    const [paymentType] = await tx.select({ id: paymentTypes.id })
      .from(paymentTypes)
      .where(and(eq(paymentTypes.id, input.paymentTypeId), eq(paymentTypes.userId, userId), isNull(paymentTypes.deletedAt)))
      .limit(1)
    if (!paymentType)
      return null

    const [row] = await tx.update(paymentAccounts).set({
      ...input,
      lastFour: input.lastFour || null,
      notes: input.notes || null,
      repaymentDay: input.repaymentRule === 'fixed_day' ? input.repaymentDay : null,
      repaymentDaysAfterStatement: input.repaymentRule === 'days_after_statement' ? input.repaymentDaysAfterStatement : null,
      creditLimit: input.creditLimit || null,
      updatedAt: new Date(),
    }).where(and(eq(paymentAccounts.id, id), eq(paymentAccounts.userId, userId), eq(paymentAccounts.accountKind, 'credit_card'), isNull(paymentAccounts.deletedAt))).returning({ id: paymentAccounts.id })
    return row ?? null
  })
}

export async function setCreditCardActive(userId: string, id: string, isActive: boolean) {
  const [row] = await db.update(paymentAccounts)
    .set({ isActive, updatedAt: new Date() })
    .where(and(eq(paymentAccounts.id, id), eq(paymentAccounts.userId, userId), eq(paymentAccounts.accountKind, 'credit_card'), isNull(paymentAccounts.deletedAt)))
    .returning({ id: paymentAccounts.id })
  return row ?? null
}

export async function createSettingsPaymentAccount(userId: string, input: { name: string, paymentTypeId: string }) {
  const [row] = await db
    .insert(paymentAccounts)
    .values({
      userId,
      name: input.name,
      paymentTypeId: input.paymentTypeId,
    })
    .returning({ id: paymentAccounts.id })

  return row.id
}

export async function updateSettingsPaymentAccount(userId: string, id: string, input: { name: string, paymentTypeId?: string }) {
  await db
    .update(paymentAccounts)
    .set({
      name: input.name,
      ...(input.paymentTypeId ? { paymentTypeId: input.paymentTypeId } : {}),
    })
    .where(and(eq(paymentAccounts.id, id), eq(paymentAccounts.userId, userId), isNull(paymentAccounts.deletedAt)))
}

export async function updateBackupConfig(
  userId: string,
  input: { backupEnabled: boolean, backupDayOfMonth: number, backupFrequency: string },
) {
  const [row] = await db
    .update(profiles)
    .set({
      backupEnabled: input.backupEnabled,
      backupDayOfMonth: input.backupDayOfMonth,
      backupFrequency: input.backupFrequency,
      updatedAt: new Date(),
    })
    .where(eq(profiles.id, userId))
    .returning({ id: profiles.id })

  return row ?? null
}

export async function softDeleteSettingsPaymentAccount(userId: string, id: string) {
  await db
    .update(paymentAccounts)
    .set({ deletedAt: new Date() })
    .where(and(eq(paymentAccounts.id, id), eq(paymentAccounts.userId, userId), isNull(paymentAccounts.deletedAt)))
}
