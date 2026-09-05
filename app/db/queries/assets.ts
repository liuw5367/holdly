import { format } from 'date-fns'
import { and, desc, eq, isNull } from 'drizzle-orm'
import { db } from '~/db'
import {
  assets,
  assetTags,
  assetValueRecords,
  categories,
  paymentAccounts,
  paymentTypes,
  repairRecords,
  subscriptionRenewals,
  tags,
  warranties,
} from '~/db/schema'
import { belongsToAsset } from '~/lib/asset-resource'
import { sortPaymentTypes } from '~/lib/payment-type'
import { advanceRenewalDate } from '~/lib/subscription-renewal'
import { validateTradeIn } from '~/lib/trade-in'

// ========== 资产列表 ==========

export async function getAssetsByUserId(userId: string) {
  return db
    .select()
    .from(assets)
    .where(and(eq(assets.userId, userId), isNull(assets.deletedAt)))
    .orderBy(assets.createdAt)
}

// ========== 资产详情 ==========

export async function getAssetById(id: string, userId: string) {
  const rows = await db
    .select()
    .from(assets)
    .where(
      and(
        eq(assets.id, id),
        eq(assets.userId, userId),
        isNull(assets.deletedAt),
      ),
    )
    .limit(1)

  return rows[0] ?? null
}

export async function getAssetWithTags(assetId: string) {
  const rows = await db
    .select({ tagId: assetTags.tagId })
    .from(assetTags)
    .where(eq(assetTags.assetId, assetId))

  return rows.map(r => r.tagId)
}

export async function getAssetWarranty(assetId: string) {
  const rows = await db
    .select()
    .from(warranties)
    .where(eq(warranties.assetId, assetId))
    .limit(1)

  return rows[0] ?? null
}

export async function getAssetRepairRecords(assetId: string) {
  return db
    .select()
    .from(repairRecords)
    .where(eq(repairRecords.assetId, assetId))
    .orderBy(repairRecords.repairDate)
}

export async function getAssetValueRecords(assetId: string, userId: string) {
  return db
    .select()
    .from(assetValueRecords)
    .where(and(
      eq(assetValueRecords.assetId, assetId),
      eq(assetValueRecords.userId, userId),
      isNull(assetValueRecords.deletedAt),
    ))
    .orderBy(desc(assetValueRecords.valuedOn), desc(assetValueRecords.createdAt))
}

export interface AssetValueRecordInput {
  value: string
  valuedOn: string
  source: 'manual' | 'market' | 'professional' | 'baseline'
  notes?: string
}

export async function createAssetValueRecord(assetId: string, userId: string, input: AssetValueRecordInput) {
  return db.transaction(async (tx) => {
    const [asset] = await tx.select({ id: assets.id })
      .from(assets)
      .where(and(eq(assets.id, assetId), eq(assets.userId, userId), eq(assets.assetType, 'one_time'), isNull(assets.deletedAt)))
      .for('update')
    if (!asset)
      return null

    const [record] = await tx.insert(assetValueRecords).values({ userId, assetId, ...input }).returning()
    const [latest] = await tx.select({ value: assetValueRecords.value })
      .from(assetValueRecords)
      .where(and(
        eq(assetValueRecords.assetId, assetId),
        eq(assetValueRecords.userId, userId),
        isNull(assetValueRecords.deletedAt),
      ))
      .orderBy(desc(assetValueRecords.valuedOn), desc(assetValueRecords.createdAt))
      .limit(1)
    await tx.update(assets)
      .set({ currentValue: latest?.value ?? null, updatedAt: new Date() })
      .where(and(eq(assets.id, assetId), eq(assets.userId, userId)))
    return record
  })
}

export async function softDeleteAssetValueRecord(recordId: string, assetId: string, userId: string) {
  return db.transaction(async (tx) => {
    const [asset] = await tx.select({ id: assets.id })
      .from(assets)
      .where(and(eq(assets.id, assetId), eq(assets.userId, userId), eq(assets.assetType, 'one_time'), isNull(assets.deletedAt)))
      .for('update')
    if (!asset)
      return false

    const [record] = await tx.select()
      .from(assetValueRecords)
      .where(and(
        eq(assetValueRecords.id, recordId),
        eq(assetValueRecords.assetId, assetId),
        eq(assetValueRecords.userId, userId),
        isNull(assetValueRecords.deletedAt),
      ))
      .limit(1)
    if (!record)
      return false

    const [latest] = await tx.select({ id: assetValueRecords.id })
      .from(assetValueRecords)
      .where(and(eq(assetValueRecords.assetId, assetId), eq(assetValueRecords.userId, userId), isNull(assetValueRecords.deletedAt)))
      .orderBy(desc(assetValueRecords.valuedOn), desc(assetValueRecords.createdAt))
      .limit(1)

    await tx.update(assetValueRecords)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(assetValueRecords.id, recordId))

    if (latest?.id === recordId) {
      const [previous] = await tx.select({ value: assetValueRecords.value })
        .from(assetValueRecords)
        .where(and(
          eq(assetValueRecords.assetId, assetId),
          eq(assetValueRecords.userId, userId),
          isNull(assetValueRecords.deletedAt),
        ))
        .orderBy(desc(assetValueRecords.valuedOn), desc(assetValueRecords.createdAt))
        .limit(1)
      await tx.update(assets)
        .set({ currentValue: previous?.value ?? null, updatedAt: new Date() })
        .where(and(eq(assets.id, assetId), eq(assets.userId, userId)))
    }
    return true
  })
}

// ========== 创建资产 ==========

export interface CreateAssetInput {
  userId: string
  name: string
  emoji: string
  categoryId: string
  assetType: 'one_time' | 'subscription'
  purchasePrice?: string
  currentValue?: string
  purchaseDate?: string
  purchaseReceipt?: string
  subscriptionPrice?: string
  billingCycle?: 'monthly' | 'quarterly' | 'yearly'
  nextRenewalDate?: string
  subscriptionStartDate?: string
  paymentTypeId?: string
  paymentAccountId?: string
  notes?: string
  tagIds?: string[]
}

export async function createAsset(input: CreateAssetInput) {
  const { tagIds, ...data } = input
  return db.transaction(async (tx) => {
    if (data.paymentAccountId) {
      const [account] = await tx.select({
        id: paymentAccounts.id,
        paymentTypeId: paymentAccounts.paymentTypeId,
      })
        .from(paymentAccounts)
        .where(and(
          eq(paymentAccounts.id, data.paymentAccountId),
          eq(paymentAccounts.userId, data.userId),
          eq(paymentAccounts.isActive, true),
          isNull(paymentAccounts.deletedAt),
        ))
        .for('update')
      if (!account || (data.paymentTypeId && account.paymentTypeId !== data.paymentTypeId))
        return null
    }

    const [asset] = await tx.insert(assets).values({
      userId: data.userId,
      name: data.name,
      emoji: data.emoji,
      categoryId: data.categoryId,
      assetType: data.assetType,
      purchasePrice: data.purchasePrice ?? null,
      currentValue: data.currentValue ?? null,
      purchaseDate: data.purchaseDate ?? null,
      purchaseReceipt: data.purchaseReceipt ?? null,
      subscriptionPrice: data.subscriptionPrice ?? null,
      billingCycle: data.billingCycle ?? null,
      nextRenewalDate: data.nextRenewalDate ?? null,
      subscriptionStartDate: data.subscriptionStartDate ?? null,
      paymentTypeId: data.paymentTypeId ?? null,
      paymentAccountId: data.paymentAccountId ?? null,
      notes: data.notes ?? null,
    }).returning({ id: assets.id })

    if (tagIds && tagIds.length > 0)
      await tx.insert(assetTags).values(tagIds.map(tagId => ({ assetId: asset.id, tagId })))

    if (data.assetType === 'one_time' && data.currentValue !== undefined) {
      await tx.insert(assetValueRecords).values({
        userId: data.userId,
        assetId: asset.id,
        value: data.currentValue,
        valuedOn: data.purchaseDate || format(new Date(), 'yyyy-MM-dd'),
        source: 'baseline',
        notes: '创建资产时填写的初始估值',
      })
    }
    return asset.id
  })
}

// ========== 更新资产 ==========

export interface UpdateAssetInput {
  name: string
  emoji: string
  categoryId: string
  assetType: 'one_time' | 'subscription'
  purchasePrice?: string
  currentValue?: string
  purchaseDate?: string
  purchaseReceipt?: string
  subscriptionPrice?: string
  billingCycle?: 'monthly' | 'quarterly' | 'yearly'
  nextRenewalDate?: string
  subscriptionStartDate?: string
  paymentTypeId?: string
  paymentAccountId?: string
  notes?: string
  tagIds?: string[]
}

export async function updateAsset(id: string, userId: string, input: UpdateAssetInput) {
  const { tagIds, ...data } = input
  return db.transaction(async (tx) => {
    const [existing] = await tx.select().from(assets).where(and(eq(assets.id, id), eq(assets.userId, userId), isNull(assets.deletedAt))).for('update')
    if (!existing)
      return false

    if (data.paymentAccountId) {
      const [account] = await tx.select({
        id: paymentAccounts.id,
        paymentTypeId: paymentAccounts.paymentTypeId,
        isActive: paymentAccounts.isActive,
      })
        .from(paymentAccounts)
        .where(and(
          eq(paymentAccounts.id, data.paymentAccountId),
          eq(paymentAccounts.userId, userId),
          isNull(paymentAccounts.deletedAt),
        ))
        .for('update')
      const keepsExistingInactiveAccount = account?.id === existing.paymentAccountId
      if (
        !account
        || (!account.isActive && !keepsExistingInactiveAccount)
        || (data.paymentTypeId && account.paymentTypeId !== data.paymentTypeId)
      ) {
        return false
      }
    }

    await tx.update(assets).set({
      name: data.name,
      emoji: data.emoji,
      categoryId: data.categoryId,
      assetType: data.assetType,
      purchasePrice: data.purchasePrice ?? null,
      currentValue: data.currentValue ?? existing.currentValue,
      purchaseDate: data.purchaseDate ?? null,
      purchaseReceipt: data.purchaseReceipt ?? null,
      subscriptionPrice: data.subscriptionPrice ?? null,
      billingCycle: data.billingCycle ?? null,
      nextRenewalDate: data.assetType === 'subscription'
        ? data.nextRenewalDate ?? existing.nextRenewalDate
        : null,
      subscriptionStartDate: data.subscriptionStartDate ?? null,
      paymentTypeId: data.paymentTypeId ?? null,
      paymentAccountId: data.paymentAccountId ?? null,
      notes: data.notes ?? null,
      updatedAt: new Date(),
    }).where(and(eq(assets.id, id), eq(assets.userId, userId)))

    await tx.delete(assetTags).where(eq(assetTags.assetId, id))
    if (tagIds && tagIds.length > 0)
      await tx.insert(assetTags).values(tagIds.map(tagId => ({ assetId: id, tagId })))

    if (data.assetType === 'one_time' && data.currentValue !== undefined && data.currentValue !== existing.currentValue) {
      await tx.insert(assetValueRecords).values({
        userId,
        assetId: id,
        value: data.currentValue,
        valuedOn: format(new Date(), 'yyyy-MM-dd'),
        source: 'manual',
        notes: '编辑资产时更新估值',
      })
    }
    return true
  })
}

// ========== 软删除资产 ==========

export async function softDeleteAsset(id: string, userId: string) {
  await db
    .update(assets)
    .set({ deletedAt: new Date() })
    .where(and(eq(assets.id, id), eq(assets.userId, userId)))
}

// ========== 停止订阅 ==========

export async function stopSubscription(id: string, userId: string, stoppedAt: string) {
  await db
    .update(assets)
    .set({
      subscriptionStatus: 'cancelled',
      subscriptionStoppedAt: stoppedAt,
      updatedAt: new Date(),
    })
    .where(and(eq(assets.id, id), eq(assets.userId, userId)))
}

export async function resumeSubscription(id: string, userId: string) {
  await db
    .update(assets)
    .set({
      subscriptionStatus: 'active',
      subscriptionStoppedAt: null,
      updatedAt: new Date(),
    })
    .where(and(eq(assets.id, id), eq(assets.userId, userId)))
}

// ========== 以旧换新 ==========

export async function markAssetAsTradedIn(id: string, userId: string, tradeInPrice: string, tradedInAt: string) {
  await db
    .update(assets)
    .set({
      tradedInAt,
      tradeInPrice,
      updatedAt: new Date(),
    })
    .where(and(eq(assets.id, id), eq(assets.userId, userId)))
}

export async function linkTradedFromAsset(newAssetId: string, oldAssetId: string) {
  await db
    .update(assets)
    .set({
      tradedFromAssetId: oldAssetId,
      updatedAt: new Date(),
    })
    .where(eq(assets.id, newAssetId))
}

export async function getOrCreateTradeInTag(userId: string) {
  const tagName = '以旧换新购买'
  const existing = await db
    .select()
    .from(tags)
    .where(and(eq(tags.userId, userId), eq(tags.name, tagName)))
    .limit(1)

  if (existing[0])
    return existing[0]

  const [tag] = await db
    .insert(tags)
    .values({ userId, name: tagName, color: '#7c6dea' })
    .returning()

  return tag
}

export interface TradeInAssetInput {
  oldAssetId: string
  userId: string
  name: string
  emoji: string
  categoryId: string
  listPrice: string
  tradeInPrice: string
  tradeInDate: string
  paymentTypeId?: string
  paymentAccountId?: string
  notes?: string
  tagIds: string[]
}

export async function tradeInAsset(input: TradeInAssetInput) {
  return db.transaction(async (tx) => {
    const oldAsset = await tx
      .select()
      .from(assets)
      .where(and(
        eq(assets.id, input.oldAssetId),
        eq(assets.userId, input.userId),
        eq(assets.assetType, 'one_time'),
        isNull(assets.deletedAt),
        isNull(assets.tradedInAt),
      ))
      .limit(1)
      .then(rows => rows[0])

    if (!oldAsset?.purchaseDate)
      throw new Error('旧资产不存在或已完成换新')

    const validation = validateTradeIn({
      purchaseDate: oldAsset.purchaseDate,
      tradeInDate: input.tradeInDate,
      listPrice: input.listPrice,
      tradeInPrice: input.tradeInPrice,
      today: format(new Date(), 'yyyy-MM-dd'),
    })
    if (!validation.ok)
      throw new Error(validation.error)

    const category = await tx
      .select({ id: categories.id })
      .from(categories)
      .where(and(eq(categories.id, input.categoryId), eq(categories.userId, input.userId), isNull(categories.deletedAt)))
      .limit(1)
      .then(rows => rows[0])
    if (!category)
      throw new Error('分类不存在')

    if (input.paymentAccountId) {
      const [account] = await tx.select({
        id: paymentAccounts.id,
        paymentTypeId: paymentAccounts.paymentTypeId,
      })
        .from(paymentAccounts)
        .where(and(
          eq(paymentAccounts.id, input.paymentAccountId),
          eq(paymentAccounts.userId, input.userId),
          eq(paymentAccounts.isActive, true),
          isNull(paymentAccounts.deletedAt),
        ))
        .for('update')
      if (!account || (input.paymentTypeId && account.paymentTypeId !== input.paymentTypeId))
        throw new Error('支付账户不可用，请重新选择')
    }

    const tagName = '以旧换新购买'
    let tradeInTag = await tx
      .select()
      .from(tags)
      .where(and(eq(tags.userId, input.userId), eq(tags.name, tagName), isNull(tags.deletedAt)))
      .limit(1)
      .then(rows => rows[0])
    if (!tradeInTag) {
      [tradeInTag] = await tx
        .insert(tags)
        .values({ userId: input.userId, name: tagName, color: '#7c6dea' })
        .returning()
    }

    const [newAsset] = await tx
      .insert(assets)
      .values({
        userId: input.userId,
        name: input.name,
        emoji: input.emoji,
        categoryId: input.categoryId,
        assetType: 'one_time',
        purchasePrice: validation.actualCost,
        listPrice: input.listPrice,
        purchaseDate: input.tradeInDate,
        paymentTypeId: input.paymentTypeId ?? null,
        paymentAccountId: input.paymentAccountId ?? null,
        notes: input.notes ?? null,
        tradedFromAssetId: oldAsset.id,
      })
      .returning({ id: assets.id })

    const tagIds = [...new Set([...input.tagIds, tradeInTag.id])]
    if (tagIds.length)
      await tx.insert(assetTags).values(tagIds.map(tagId => ({ assetId: newAsset.id, tagId })))

    await tx
      .update(assets)
      .set({ tradedInAt: input.tradeInDate, tradeInPrice: input.tradeInPrice, updatedAt: new Date() })
      .where(and(eq(assets.id, oldAsset.id), eq(assets.userId, input.userId), isNull(assets.tradedInAt)))

    return newAsset.id
  })
}

export async function getTradedFromAsset(assetId: string) {
  const rows = await db
    .select()
    .from(assets)
    .where(and(eq(assets.id, assetId), isNull(assets.deletedAt)))
    .limit(1)

  return rows[0] ?? null
}

export async function getTradeToAsset(oldAssetId: string, userId: string) {
  const rows = await db
    .select({
      id: assets.id,
      name: assets.name,
      assetType: assets.assetType,
      purchasePrice: assets.purchasePrice,
    })
    .from(assets)
    .where(and(
      eq(assets.userId, userId),
      eq(assets.tradedFromAssetId, oldAssetId),
      isNull(assets.deletedAt),
    ))
    .limit(1)

  return rows[0] ?? null
}

// ========== 分类 ==========

export async function getCategoriesByUserId(userId: string) {
  return db
    .select()
    .from(categories)
    .where(and(eq(categories.userId, userId), isNull(categories.deletedAt)))
    .orderBy(categories.sortOrder)
}

// ========== 标签 ==========

export async function getTagsByUserId(userId: string) {
  return db
    .select()
    .from(tags)
    .where(and(eq(tags.userId, userId), isNull(tags.deletedAt)))
}

// ========== 支付类型 ==========

export async function getPaymentTypesByUserId(userId: string) {
  const rows = await db
    .select()
    .from(paymentTypes)
    .where(and(eq(paymentTypes.userId, userId), isNull(paymentTypes.deletedAt)))

  return sortPaymentTypes(rows)
}

// ========== 支付账户 ==========

export async function getPaymentAccountsByUserId(userId: string) {
  return db
    .select()
    .from(paymentAccounts)
    .where(and(eq(paymentAccounts.userId, userId), isNull(paymentAccounts.deletedAt)))
}

// ========== 维修记录 ==========

export interface CreateRepairRecordInput {
  assetId: string
  repairDate: string
  cost?: string
  reason?: string
  vendor?: string
  result?: string
  isDone?: boolean
}

export async function createRepairRecord(input: CreateRepairRecordInput) {
  const [record] = await db
    .insert(repairRecords)
    .values({
      assetId: input.assetId,
      repairDate: input.repairDate,
      cost: input.cost ?? '0',
      reason: input.reason ?? null,
      vendor: input.vendor ?? null,
      result: input.result ?? null,
      isDone: input.isDone ?? true,
    })
    .returning({ id: repairRecords.id })

  return record.id
}

export interface UpdateRepairRecordInput {
  repairDate: string
  cost?: string
  reason?: string
  vendor?: string
  result?: string
  isDone?: boolean
}

export async function updateRepairRecord(assetId: string, id: string, input: UpdateRepairRecordInput) {
  const record = await db
    .select({ assetId: repairRecords.assetId })
    .from(repairRecords)
    .where(eq(repairRecords.id, id))
    .limit(1)
    .then(rows => rows[0])

  if (!belongsToAsset(record, assetId))
    return false

  await db
    .update(repairRecords)
    .set({
      repairDate: input.repairDate,
      cost: input.cost ?? '0',
      reason: input.reason ?? null,
      vendor: input.vendor ?? null,
      result: input.result ?? null,
      isDone: input.isDone ?? true,
    })
    .where(and(eq(repairRecords.id, id), eq(repairRecords.assetId, assetId)))

  return true
}

export async function deleteRepairRecord(assetId: string, id: string) {
  const record = await db
    .select({ assetId: repairRecords.assetId })
    .from(repairRecords)
    .where(eq(repairRecords.id, id))
    .limit(1)
    .then(rows => rows[0])

  if (!belongsToAsset(record, assetId))
    return false

  await db
    .delete(repairRecords)
    .where(and(eq(repairRecords.id, id), eq(repairRecords.assetId, assetId)))

  return true
}

// ========== 保修信息 ==========

export interface UpsertWarrantyInput {
  assetId: string
  startDate: string
  endDate: string
  notes?: string
}

export async function upsertWarranty(input: UpsertWarrantyInput) {
  const existing = await db
    .select({ id: warranties.id })
    .from(warranties)
    .where(eq(warranties.assetId, input.assetId))
    .limit(1)

  if (existing[0]) {
    await db
      .update(warranties)
      .set({
        startDate: input.startDate,
        endDate: input.endDate,
        notes: input.notes ?? null,
        updatedAt: new Date(),
      })
      .where(eq(warranties.id, existing[0].id))
    return existing[0].id
  }

  const [warranty] = await db
    .insert(warranties)
    .values({
      assetId: input.assetId,
      startDate: input.startDate,
      endDate: input.endDate,
      notes: input.notes ?? null,
    })
    .returning({ id: warranties.id })

  return warranty.id
}

// ========== 获取带分类名称的资产 ==========

export async function getAssetsWithCategoryName(userId: string) {
  return db
    .select({
      id: assets.id,
      name: assets.name,
      emoji: assets.emoji,
      categoryId: assets.categoryId,
      assetType: assets.assetType,
      purchasePrice: assets.purchasePrice,
      subscriptionPrice: assets.subscriptionPrice,
      billingCycle: assets.billingCycle,
      purchaseDate: assets.purchaseDate,
      subscriptionStartDate: assets.subscriptionStartDate,
      tradedInAt: assets.tradedInAt,
      tradeInPrice: assets.tradeInPrice,
      tradedFromAssetId: assets.tradedFromAssetId,
      subscriptionStatus: assets.subscriptionStatus,
      subscriptionStoppedAt: assets.subscriptionStoppedAt,
      createdAt: assets.createdAt,
      categoryName: categories.name,
    })
    .from(assets)
    .leftJoin(categories, eq(assets.categoryId, categories.id))
    .where(and(eq(assets.userId, userId), isNull(assets.deletedAt)))
    .orderBy(desc(assets.createdAt))
}

// ========== 获取用户所有资产标签关联 ==========

export async function getAssetTagsByUserId(userId: string) {
  return db
    .select({
      assetId: assetTags.assetId,
      tagId: assetTags.tagId,
      tagName: tags.name,
      tagColor: tags.color,
    })
    .from(assetTags)
    .innerJoin(assets, eq(assetTags.assetId, assets.id))
    .innerJoin(tags, eq(assetTags.tagId, tags.id))
    .where(and(eq(assets.userId, userId), isNull(assets.deletedAt)))
}

// ========== 资产提醒设置 ==========

export async function updateAssetReminder(
  id: string,
  userId: string,
  input: { reminderEnabled: boolean, reminderWarrantyDaysOverride: number | null },
) {
  await db
    .update(assets)
    .set({
      reminderEnabled: input.reminderEnabled,
      reminderWarrantyDaysOverride: input.reminderWarrantyDaysOverride,
      updatedAt: new Date(),
    })
    .where(and(eq(assets.id, id), eq(assets.userId, userId)))
}

export async function updateSubscriptionReminder(
  id: string,
  userId: string,
  input: { reminderEnabled: boolean, reminderSubscriptionDaysOverride: number | null },
) {
  await db
    .update(assets)
    .set({
      reminderEnabled: input.reminderEnabled,
      reminderSubscriptionDaysOverride: input.reminderSubscriptionDaysOverride,
      updatedAt: new Date(),
    })
    .where(and(eq(assets.id, id), eq(assets.userId, userId)))
}

// ========== 续费记录 ==========

export async function getLatestRenewal(assetId: string) {
  const rows = await db
    .select()
    .from(subscriptionRenewals)
    .where(and(eq(subscriptionRenewals.assetId, assetId), isNull(subscriptionRenewals.deletedAt)))
    .orderBy(desc(subscriptionRenewals.startDate), desc(subscriptionRenewals.createdAt))
    .limit(1)
  return rows[0] || null
}

export async function getSubscriptionRenewals(assetId: string) {
  return db.select()
    .from(subscriptionRenewals)
    .where(and(eq(subscriptionRenewals.assetId, assetId), isNull(subscriptionRenewals.deletedAt)))
    .orderBy(desc(subscriptionRenewals.startDate), desc(subscriptionRenewals.createdAt))
}

export async function softDeleteSubscriptionRenewal(recordId: string, assetId: string, userId: string) {
  return db.transaction(async (tx) => {
    // 与续费操作使用同一资产行锁，确保归属和有效状态在删除期间保持一致。
    const [asset] = await tx.select({ id: assets.id }).from(assets).where(and(eq(assets.id, assetId), eq(assets.userId, userId), eq(assets.assetType, 'subscription'), isNull(assets.deletedAt))).for('update')
    if (!asset)
      return false

    // 删除历史不撤销已确认的周期，保留确认键避免旧请求再次推进续费日。
    const [record] = await tx.update(subscriptionRenewals)
      .set({ deletedAt: new Date() })
      .where(and(eq(subscriptionRenewals.id, recordId), eq(subscriptionRenewals.assetId, assetId), isNull(subscriptionRenewals.deletedAt)))
      .returning({ id: subscriptionRenewals.id })
    return Boolean(record)
  })
}

export async function createRenewal(
  assetId: string,
  userId: string,
  input: { price: string, expectedStartDate: string, notes?: string, updateExpectedPrice: boolean },
) {
  return db.transaction(async (tx) => {
    const [asset] = await tx.select()
      .from(assets)
      .where(and(eq(assets.id, assetId), eq(assets.userId, userId), eq(assets.assetType, 'subscription'), isNull(assets.deletedAt)))
      .for('update')
    if (!asset || !asset.billingCycle || !asset.nextRenewalDate || asset.subscriptionStatus !== 'active')
      return { status: 'invalid' as const }

    const confirmationKey = `${assetId}:${input.expectedStartDate}`
    if (asset.nextRenewalDate !== input.expectedStartDate) {
      const [duplicate] = await tx.select({ id: subscriptionRenewals.id })
        .from(subscriptionRenewals)
        .where(eq(subscriptionRenewals.confirmationKey, confirmationKey))
        .limit(1)
      return { status: duplicate ? 'duplicate' as const : 'invalid' as const }
    }

    const startDate = asset.nextRenewalDate
    const [inserted] = await tx
      .insert(subscriptionRenewals)
      .values({
        assetId,
        billingCycle: asset.billingCycle,
        price: input.price,
        startDate,
        notes: input.notes ?? null,
        confirmationKey,
      })
      .onConflictDoNothing({ target: subscriptionRenewals.confirmationKey })
      .returning({ id: subscriptionRenewals.id })
    if (!inserted)
      return { status: 'duplicate' as const }

    const nextRenewalDate = advanceRenewalDate(startDate, asset.billingCycle)
    await tx.update(assets)
      .set({
        nextRenewalDate,
        subscriptionPrice: input.updateExpectedPrice ? input.price : asset.subscriptionPrice,
        updatedAt: new Date(),
      })
      .where(and(eq(assets.id, assetId), eq(assets.userId, userId)))
    return { status: 'created' as const, nextRenewalDate }
  })
}
