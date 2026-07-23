import currency from 'currency.js'
import { addDays, addMonths, addYears, endOfMonth, format, startOfMonth, subDays, subMonths } from 'date-fns'
import { and, eq, gte, isNull, lte } from 'drizzle-orm'
import { db } from '~/db'
import { assets, categories, paymentAccounts, warranties } from '~/db/schema'
import { addAmounts, sumAmounts } from '~/lib/amount'
import {
  calcOneTimeCostRange,
  calcOneTimeDailyCost,
  calcSoldOneTimeCostRange,
  calcSubscriptionCostRange,
} from '~/lib/cost'
import { formatExpiryCountdown } from '~/lib/expiry'
import { getRenewalWindow, toMonthlySubscriptionCost, toYearlySubscriptionCost } from '~/lib/subscription-renewal'
import { isSubscriptionActive } from '~/lib/subscription-status'

const CATEGORY_COLORS: Record<string, string> = {
  '💻': '#cc785c',
  '🔧': '#5db8a6',
  '📚': '#5db872',
  '🔄': '#d4a017',
  '📷': '#8b6cc1',
  '🏠': '#6c6a64',
  '📦': '#9ca3af',
  '🎮': '#e87070',
}

type AssetTypeStatsModel = 'one_time' | 'subscription'

interface CategorySpendingItem {
  name: string
  emoji: string
  amount: number
  percent: number
  color: string
}

interface MonthlyTrendItem {
  month: string
  label: string
  amount: number
}

interface AssetOverview {
  id: string
  name: string
  emoji: string
  categoryId: string | null
  assetType: AssetTypeStatsModel
  purchasePrice: string | null
  purchaseDate: string | null
  subscriptionPrice: string | null
  billingCycle: 'monthly' | 'quarterly' | 'yearly' | null
  nextRenewalDate: string | null
  subscriptionStatus: string | null
  subscriptionStoppedAt: string | null
  subscriptionStartDate: string | null
  tradedInAt: string | null
  tradeInPrice: string | null
  paymentAccountCurrencyCode: string | null
  reminderEnabled: boolean | null
}

interface CategoryMeta {
  id: string
  name: string
  emoji: string
}

export interface DashboardData {
  kpiByType: {
    one_time: {
      activeCount: number
      dailyCostTotal: number
      purchaseTotal: number
      yearlyCostTotal: number
    }
    subscription: {
      activeCount: number
      monthlyCostByCurrency: Record<string, number>
      yearlyCostByCurrency: Record<string, number>
      attentionCount: number
      attentionDetail: {
        overdue: number
        sevenDays: number
        thirtyDays: number
      }
    }
  }
  statsByType: Record<AssetTypeStatsModel, {
    categorySpending: CategorySpendingItem[]
    monthlyTrend: MonthlyTrendItem[]
  }>
  expiring: {
    id: string
    emoji: string
    name: string
    detail: string
    reminderEnabled: boolean
  }[]
}

function calculateAssetCostRange(
  asset: AssetOverview,
  rangeStart: Date,
  rangeEnd: Date,
): number {
  if (asset.assetType === 'subscription' && asset.subscriptionPrice) {
    const startDate = asset.subscriptionStartDate || asset.purchaseDate
    if (!startDate)
      return 0
    return calcSubscriptionCostRange(
      Number(asset.subscriptionPrice),
      startDate,
      asset.subscriptionStoppedAt,
      rangeStart,
      rangeEnd,
    )
  }

  if (asset.assetType !== 'one_time' || !asset.purchasePrice || !asset.purchaseDate)
    return 0

  if (asset.tradedInAt && asset.tradeInPrice) {
    return calcSoldOneTimeCostRange(
      Number(asset.purchasePrice),
      asset.purchaseDate,
      Number(asset.tradeInPrice),
      asset.tradedInAt,
      rangeStart,
      rangeEnd,
    )
  }

  if (asset.tradedInAt)
    return 0

  return calcOneTimeCostRange(
    Number(asset.purchasePrice),
    asset.purchaseDate,
    rangeStart,
    rangeEnd,
  )
}

function buildCategorySpendingByType(
  allAssets: AssetOverview[],
  categoryMap: Record<string, CategoryMeta>,
  assetType: AssetTypeStatsModel,
  rangeStart: Date,
  rangeEnd: Date,
): CategorySpendingItem[] {
  const catSpending: Record<string, number> = {}

  for (const a of allAssets) {
    if (a.assetType !== assetType || !a.categoryId)
      continue

    const cost = calculateAssetCostRange(a, rangeStart, rangeEnd)

    if (cost > 0)
      catSpending[a.categoryId] = currency(catSpending[a.categoryId] || 0).add(cost).value
  }

  const categoryTotal = Object.values(catSpending).reduce(
    (sum, amount) => currency(sum).add(amount).value,
    0,
  )

  return Object.entries(catSpending)
    .map(([catId, amount]) => {
      const cat = categoryMap[catId]
      return {
        name: cat?.name || '未分类',
        emoji: cat?.emoji || '📦',
        amount: Math.round(amount),
        percent: categoryTotal > 0 ? Math.round((amount / categoryTotal) * 100) : 0,
        color: CATEGORY_COLORS[cat?.emoji || '📦'] || '#9ca3af',
      }
    })
    .sort((a, b) => b.amount - a.amount)
}

function buildMonthlyTrendByType(
  allAssets: AssetOverview[],
  assetType: AssetTypeStatsModel,
  today: Date,
): MonthlyTrendItem[] {
  const monthlyTrend: MonthlyTrendItem[] = []

  for (let i = 5; i >= 0; i--) {
    const monthStart = startOfMonth(subMonths(today, i))
    const monthEnd = i === 0 ? today : endOfMonth(monthStart)
    const monthStr = format(monthStart, 'yyyy-MM')
    const label = format(monthStart, 'M月')

    let monthCost = 0

    for (const a of allAssets) {
      if (a.assetType !== assetType)
        continue

      const cost = calculateAssetCostRange(a, monthStart, monthEnd)

      if (cost > 0)
        monthCost = currency(monthCost).add(cost).value
    }

    monthlyTrend.push({ month: monthStr, label, amount: Math.round(monthCost) })
  }

  return monthlyTrend
}

export async function getDashboardData(userId: string): Promise<DashboardData> {
  const today = new Date()
  const todayStr = format(today, 'yyyy-MM-dd')

  // 1. 获取所有未删除的资产
  const allAssets: AssetOverview[] = await db
    .select({
      id: assets.id,
      name: assets.name,
      emoji: assets.emoji,
      categoryId: assets.categoryId,
      assetType: assets.assetType,
      purchasePrice: assets.purchasePrice,
      purchaseDate: assets.purchaseDate,
      subscriptionPrice: assets.subscriptionPrice,
      billingCycle: assets.billingCycle,
      nextRenewalDate: assets.nextRenewalDate,
      subscriptionStatus: assets.subscriptionStatus,
      subscriptionStoppedAt: assets.subscriptionStoppedAt,
      subscriptionStartDate: assets.subscriptionStartDate,
      tradedInAt: assets.tradedInAt,
      tradeInPrice: assets.tradeInPrice,
      paymentAccountCurrencyCode: paymentAccounts.currencyCode,
      reminderEnabled: assets.reminderEnabled,
    })
    .from(assets)
    .leftJoin(paymentAccounts, and(
      eq(assets.paymentAccountId, paymentAccounts.id),
      eq(paymentAccounts.userId, userId),
      isNull(paymentAccounts.deletedAt),
    ))
    .where(and(eq(assets.userId, userId), isNull(assets.deletedAt)))

  // 2. 获取所有分类
  const allCategories = await db
    .select({ id: categories.id, name: categories.name, emoji: categories.emoji })
    .from(categories)
    .where(eq(categories.userId, userId))

  const categoryMap = Object.fromEntries(allCategories.map(c => [c.id, c])) as Record<string, CategoryMeta>

  // 3. 筛选活跃资产（未换购、订阅未停止）
  const activeAssets = allAssets.filter((a) => {
    if (a.tradedInAt)
      return false
    if (a.assetType === 'subscription' && !isSubscriptionActive(a, todayStr))
      return false
    return true
  })

  // 4. 计算买断 KPI
  let oneTimeDailyCost = 0
  const activeOneTimeAssets = activeAssets.filter(a => a.assetType === 'one_time')
  for (const a of activeOneTimeAssets) {
    if (a.assetType !== 'one_time' || !a.purchasePrice || !a.purchaseDate || a.tradedInAt)
      continue
    oneTimeDailyCost = addAmounts(oneTimeDailyCost, calcOneTimeDailyCost(Number(a.purchasePrice), a.purchaseDate))
  }

  const catRangeStart = new Date(today.getTime() - 365 * 86400000)
  const oneTimeYearlyCost = allAssets.filter(a => a.assetType === 'one_time').reduce(
    (total, asset) => addAmounts(total, calculateAssetCostRange(asset, catRangeStart, today)),
    0,
  )

  // 5. 计算订阅 KPI，金额按支付账户币种分组，避免跨币种直接相加。
  const activeSubscriptions = allAssets.filter(a =>
    a.assetType === 'subscription'
    && a.subscriptionStatus === 'active'
    && !a.subscriptionStoppedAt
    && !a.tradedInAt,
  )
  const monthlyCostByCurrency: Record<string, number> = {}
  const yearlyCostByCurrency: Record<string, number> = {}
  const attentionDetail = { overdue: 0, sevenDays: 0, thirtyDays: 0 }

  for (const subscription of activeSubscriptions) {
    if (subscription.subscriptionPrice && subscription.billingCycle) {
      const currencyCode = subscription.paymentAccountCurrencyCode || 'CNY'
      monthlyCostByCurrency[currencyCode] = addAmounts(
        monthlyCostByCurrency[currencyCode],
        toMonthlySubscriptionCost(subscription.subscriptionPrice, subscription.billingCycle),
      )
      yearlyCostByCurrency[currencyCode] = addAmounts(
        yearlyCostByCurrency[currencyCode],
        toYearlySubscriptionCost(subscription.subscriptionPrice, subscription.billingCycle),
      )
    }

    const renewalWindow = getRenewalWindow(subscription.nextRenewalDate, todayStr)
    if (renewalWindow === 'overdue')
      attentionDetail.overdue += 1
    else if (renewalWindow === 'seven_days')
      attentionDetail.sevenDays += 1
    else if (renewalWindow === 'thirty_days')
      attentionDetail.thirtyDays += 1
  }

  // 6. 分类花费与月度趋势（按资产模型拆分）
  const statsByType: DashboardData['statsByType'] = {
    one_time: {
      categorySpending: buildCategorySpendingByType(allAssets, categoryMap, 'one_time', catRangeStart, today),
      monthlyTrend: buildMonthlyTrendByType(allAssets, 'one_time', today),
    },
    subscription: {
      categorySpending: buildCategorySpendingByType(allAssets, categoryMap, 'subscription', catRangeStart, today),
      monthlyTrend: buildMonthlyTrendByType(allAssets, 'subscription', today),
    },
  }

  // 7. 即将到期（30 天内）
  const thirtyDaysLater = format(addDays(today, 30), 'yyyy-MM-dd')
  const expiringWithDays: (DashboardData['expiring'][number] & { daysLeft: number })[] = []

  // 订阅到期
  for (const a of activeAssets) {
    if (a.assetType !== 'subscription' || !isSubscriptionActive(a, todayStr))
      continue

    // 获取下次续费日：优先用 DB 存储值，否则从开始日期计算
    let nextRenewalStr: string | null = null
    if (a.nextRenewalDate && a.nextRenewalDate > todayStr) {
      nextRenewalStr = a.nextRenewalDate
    }
    else if (a.billingCycle) {
      const startDate = a.subscriptionStartDate || a.purchaseDate
      if (startDate) {
        const cycleMonths = { monthly: 1, quarterly: 3, yearly: 12 } as const
        const months = cycleMonths[a.billingCycle]
        let next = new Date(`${startDate}T00:00:00`)
        while (format(next, 'yyyy-MM-dd') <= todayStr) {
          next = a.billingCycle === 'yearly' ? addYears(next, 1) : addMonths(next, months)
        }
        nextRenewalStr = format(next, 'yyyy-MM-dd')
      }
    }

    if (!nextRenewalStr)
      continue
    if (nextRenewalStr <= thirtyDaysLater) {
      const expiryDate = subDays(new Date(`${nextRenewalStr}T00:00:00`), 1)
      const expiryStr = format(expiryDate, 'yyyy-MM-dd')
      const daysLeft = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
      expiringWithDays.push({
        id: a.id,
        emoji: a.emoji,
        name: a.name,
        detail: `订阅 · ${expiryStr} 到期（${formatExpiryCountdown(daysLeft)}）`,
        reminderEnabled: a.reminderEnabled ?? false,
        daysLeft,
      })
    }
  }

  // 保修到期
  const allWarranties = await db
    .select({
      assetId: warranties.assetId,
      endDate: warranties.endDate,
    })
    .from(warranties)
    .innerJoin(assets, eq(warranties.assetId, assets.id))
    .where(and(
      eq(assets.userId, userId),
      isNull(assets.deletedAt),
      lte(warranties.endDate, thirtyDaysLater),
      gte(warranties.endDate, todayStr),
    ))

  for (const w of allWarranties) {
    const asset = allAssets.find(a => a.id === w.assetId)
    if (!asset)
      continue
    const daysLeft = Math.ceil((new Date(w.endDate).getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    expiringWithDays.push({
      id: asset.id,
      emoji: asset.emoji,
      name: asset.name,
      detail: `保修 · ${w.endDate} 到期（${formatExpiryCountdown(daysLeft)}）`,
      reminderEnabled: asset.reminderEnabled ?? false,
      daysLeft,
    })
  }

  // 排序使用原始天数，展示文案变化不应影响到期顺序。
  expiringWithDays.sort((a, b) => a.daysLeft - b.daysLeft)
  const expiring = expiringWithDays.map(({ daysLeft: _daysLeft, ...item }) => item)

  return {
    kpiByType: {
      one_time: {
        activeCount: activeOneTimeAssets.length,
        dailyCostTotal: oneTimeDailyCost,
        purchaseTotal: sumAmounts(activeOneTimeAssets.map(item => item.purchasePrice)),
        yearlyCostTotal: oneTimeYearlyCost,
      },
      subscription: {
        activeCount: activeSubscriptions.length,
        monthlyCostByCurrency,
        yearlyCostByCurrency,
        attentionCount: attentionDetail.overdue + attentionDetail.sevenDays + attentionDetail.thirtyDays,
        attentionDetail,
      },
    },
    statsByType,
    expiring,
  }
}
