import { formatInteger } from '~/lib/asset-meta'

export type DashboardStatsModel = 'one_time' | 'subscription'

export function getStatsModel(searchParams: URLSearchParams): DashboardStatsModel {
  return searchParams.get('model') === 'subscription' ? 'subscription' : 'one_time'
}

export function formatCurrencyGroups(values: Record<string, number>): string {
  const groups = Object.entries(values)
  return groups.length > 0
    ? groups.map(([code, value]) => code === 'CNY' ? `¥${formatInteger(value)}` : `${code} ${formatInteger(value)}`).join(' · ')
    : '—'
}
