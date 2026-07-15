export interface AssetTimelineInput {
  purchaseDate: string | null
  tradedInAt: string | null
  isTradeIn: boolean
  warranty: { startDate: string, endDate: string } | null
  repairs: Array<{ id: string, repairDate: string, reason: string | null }>
}

export interface AssetTimelineEvent {
  id: string
  date: string
  label: string
  detail?: string
}

export function buildAssetTimeline(input: AssetTimelineInput): AssetTimelineEvent[] {
  const events: Array<AssetTimelineEvent & { order: number }> = []
  if (input.purchaseDate)
    events.push({ id: 'purchase', date: input.purchaseDate, label: '购入资产', order: 10 })
  if (input.warranty) {
    events.push({ id: 'warranty-start', date: input.warranty.startDate, label: '保修开始', order: 20 })
    events.push({ id: 'warranty-end', date: input.warranty.endDate, label: '保修结束', order: 40 })
  }
  for (const repair of input.repairs) {
    events.push({
      id: `repair-${repair.id}`,
      date: repair.repairDate,
      label: '维修记录',
      detail: repair.reason || undefined,
      order: 30,
    })
  }
  if (input.tradedInAt) {
    events.push({
      id: 'disposed',
      date: input.tradedInAt,
      label: input.isTradeIn ? '以旧换新' : '卖出资产',
      order: 50,
    })
  }

  return events
    .sort((a, b) => b.date.localeCompare(a.date) || b.order - a.order || a.id.localeCompare(b.id))
    .map(({ order: _order, ...event }) => event)
}
