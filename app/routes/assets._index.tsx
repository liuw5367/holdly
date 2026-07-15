import type { Route } from './+types/assets._index'
import { IconChevronDown, IconSearch, IconX } from '@tabler/icons-react'
import { differenceInDays } from 'date-fns'
import { useMemo, useState } from 'react'
import { data, redirect, useLoaderData, useNavigate } from 'react-router'
import { EmptyState } from '~/components/empty-state'
import { MainPageHeader } from '~/components/page-header'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '~/components/ui/sheet'
import {
  getAssetsWithCategoryName,
  getAssetTagsByUserId,
  getCategoriesByUserId,
  getTagsByUserId,
} from '~/db/queries/assets'
import { calculateAssetDurationDays, getAssetDetailPath } from '~/lib/asset-meta'
import { calcOneTimeDailyCost, calcSoldOneTimeDailyCost, calcSubscriptionDailyCost } from '~/lib/cost'
import { isSubscriptionActive } from '~/lib/subscription-status'
import { createSupabaseServerClient } from '~/lib/supabase.server'

export async function loader({ request }: Route.LoaderArgs) {
  const { supabase, headers } = createSupabaseServerClient(request)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user)
    throw redirect('/login', { headers })

  const userId = user.id
  const [rawAssets, categories, tags, assetTagRows] = await Promise.all([
    getAssetsWithCategoryName(userId),
    getCategoriesByUserId(userId),
    getTagsByUserId(userId),
    getAssetTagsByUserId(userId),
  ])

  const assetsWithCost = rawAssets.map((a) => {
    let dailyCost = 0
    if (a.tradedInAt && a.purchasePrice && a.purchaseDate) {
      const holdingDays = Math.max(1, differenceInDays(new Date(a.tradedInAt), new Date(a.purchaseDate)))
      dailyCost = calcSoldOneTimeDailyCost(Number(a.purchasePrice), Number(a.tradeInPrice || 0), holdingDays)
    }
    else if (a.assetType === 'one_time' && a.purchasePrice && a.purchaseDate) {
      dailyCost = calcOneTimeDailyCost(Number(a.purchasePrice), a.purchaseDate)
    }
    else if (a.assetType === 'subscription' && a.subscriptionPrice && a.billingCycle) {
      dailyCost = calcSubscriptionDailyCost(Number(a.subscriptionPrice), a.billingCycle)
    }
    return {
      ...a,
      dailyCost,
      subscriptionActive: a.assetType === 'subscription'
        ? isSubscriptionActive(a, new Date().toISOString().slice(0, 10))
        : false,
    }
  })

  const assetTagMap: Record<string, Array<{ id: string, name: string, color: string }>> = {}
  for (const row of assetTagRows) {
    if (!assetTagMap[row.assetId])
      assetTagMap[row.assetId] = []
    assetTagMap[row.assetId].push({ id: row.tagId, name: row.tagName, color: row.tagColor })
  }

  return data({ assets: assetsWithCost, categories, tags, assetTagMap }, { headers })
}

type SortOption = 'default' | 'price_asc' | 'price_desc' | 'cost_asc' | 'cost_desc' | 'date_desc' | 'date_asc'
type TypeFilter = 'one_time' | 'subscription' | 'ended' | null

const sortLabels: Record<SortOption, string> = {
  default: '近期新增',
  price_asc: '价格升序',
  price_desc: '价格降序',
  cost_asc: '每日成本升序',
  cost_desc: '每日成本降序',
  date_desc: '日期降序',
  date_asc: '日期升序',
}

export default function AssetsIndex() {
  const { assets, categories, tags, assetTagMap } = useLoaderData<typeof loader>()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [activeType, setActiveType] = useState<TypeFilter>(null)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [selectedTag, setSelectedTag] = useState<string | null>(null)
  const [sortOption, setSortOption] = useState<SortOption>('default')
  const [sheetType, setSheetType] = useState<'tag' | 'sort' | null>(null)

  const filteredAssets = useMemo(() => {
    let results = assets.filter((a) => {
      const matchesSearch = a.name.toLowerCase().includes(search.toLowerCase())
      const ended = a.assetType === 'subscription'
        ? !a.subscriptionActive
        : Boolean(a.tradedInAt)

      const matchesType = !activeType
        ? true
        : activeType === 'ended'
          ? ended
          : a.assetType === activeType && !ended

      const matchesCategory = !selectedCategory || a.categoryId === selectedCategory
      const matchesTag = !selectedTag || (assetTagMap[a.id] || []).some(t => t.id === selectedTag)
      return matchesSearch && matchesType && matchesCategory && matchesTag
    })

    if (sortOption !== 'default') {
      results = [...results].sort((a, b) => {
        switch (sortOption) {
          case 'price_asc':
            return Number(a.purchasePrice ?? a.subscriptionPrice ?? 0) - Number(b.purchasePrice ?? b.subscriptionPrice ?? 0)
          case 'price_desc':
            return Number(b.purchasePrice ?? b.subscriptionPrice ?? 0) - Number(a.purchasePrice ?? a.subscriptionPrice ?? 0)
          case 'cost_asc':
            return a.dailyCost - b.dailyCost
          case 'cost_desc':
            return b.dailyCost - a.dailyCost
          case 'date_asc':
            return (a.purchaseDate || '').localeCompare(b.purchaseDate || '')
          case 'date_desc':
            return (b.purchaseDate || '').localeCompare(a.purchaseDate || '')
          default:
            return 0
        }
      })
    }

    return results
  }, [activeType, assetTagMap, assets, search, selectedCategory, selectedTag, sortOption])

  const activeTagName = selectedTag ? tags.find(t => t.id === selectedTag)?.name : null

  return (
    <div className="pb-8 pt-6">
      <MainPageHeader title="资产管理" actions={[{ label: '+ 资产', to: '/assets/new' }, { label: '+ 订阅', to: '/subscriptions/new' }]} />

      <div className="mb-4">
        <div className="relative">
          <IconSearch size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2" style={{ color: 'var(--color-muted)' }} />
          <Input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="搜索名称..."
            className="rounded-full bg-[var(--color-surface-card)] pl-9"
          />
        </div>
      </div>

      <div className="mb-3 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex w-max items-center gap-1.5 pr-1">
          {([
            { key: 'one_time', label: '买断' },
            { key: 'subscription', label: '订阅' },
            { key: 'ended', label: '已取消' },
          ] as const).map(item => (
            <Button
              key={item.key}
              type="button"
              size="sm"
              onClick={() => setActiveType(prev => prev === item.key ? null : item.key)}
              className="h-8 rounded-full px-3 text-[13px]"
              variant={activeType === item.key ? 'default' : 'outline'}
            >
              {item.label}
            </Button>
          ))}
          <Button
            type="button"
            size="sm"
            onClick={() => setSheetType('tag')}
            className="h-8 rounded-full px-3 text-[13px]"
            variant={selectedTag ? 'default' : 'outline'}
          >
            {activeTagName || '标签'}
            {selectedTag
              ? (
                  <IconX
                    size={12}
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelectedTag(null)
                    }}
                  />
                )
              : <IconChevronDown size={14} />}
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => setSheetType('sort')}
            className="h-8 rounded-full px-3 text-[13px]"
            variant={sortOption === 'default' ? 'outline' : 'default'}
          >
            {sortLabels[sortOption]}
            <IconChevronDown size={14} />
          </Button>
        </div>
      </div>

      <div className="mb-4 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        <Button
          type="button"
          variant={selectedCategory ? 'outline' : 'default'}
          size="sm"
          onClick={() => setSelectedCategory(null)}
          className="h-8 rounded-full px-3 text-[13px]"
        >
          全部
        </Button>
        {categories.map(cat => (
          <Button
            key={cat.id}
            type="button"
            variant={selectedCategory === cat.id ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedCategory(cat.id)}
            className="h-8 rounded-full px-3 text-[13px]"
          >
            {cat.emoji}
            {' '}
            {cat.name}
          </Button>
        ))}
      </div>

      <div className="space-y-2">
        {filteredAssets.length > 0
          ? filteredAssets.map((asset) => {
              const tagsText = (assetTagMap[asset.id] || []).map(t => t.name).join('、')
              const isEnded = asset.assetType === 'subscription'
                ? asset.subscriptionStatus === 'cancelled' || Boolean(asset.subscriptionStoppedAt)
                : Boolean(asset.tradedInAt)
              const holdingDays = calculateAssetDurationDays({
                assetType: asset.assetType,
                purchaseDate: asset.purchaseDate,
                subscriptionStartDate: asset.subscriptionStartDate,
                tradedInAt: asset.tradedInAt,
                subscriptionStoppedAt: asset.subscriptionStoppedAt,
                ended: isEnded,
              })

              return (
                <button
                  key={asset.id}
                  onClick={() => navigate(getAssetDetailPath(asset))}
                  className="flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors hover:opacity-85"
                  style={{ background: 'var(--color-surface-card)', borderColor: 'var(--color-hairline)' }}
                >
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-[18px]"
                    style={{ background: 'var(--color-surface-strong)' }}
                  >
                    {asset.emoji}
                  </span>

                  <div className="min-w-0 flex-1 ">
                    <div className="flex justify-between">
                      <div className="flex items-center gap-3">
                        <span className="truncate text-[14px] font-medium" style={{ color: 'var(--color-ink)' }}>
                          {asset.name}
                        </span>
                        {isEnded && (
                          <span className="inline-block size-1.5 rounded-full shadow-[0_0_10px_rgba(220,38,38,0.6)] bg-red-500 opacity-85" />
                        )}
                      </div>

                      <div className="shrink-0 text-right text-[14px] font-medium" style={{ color: 'var(--color-ink)' }}>
                        {asset.dailyCost > 0 ? `${asset.dailyCost.toFixed(2)}/天` : '—'}
                      </div>
                    </div>

                    <div className="mt-0.5">
                      <div className="flex justify-between">
                        <div className="truncate text-[12px]" style={{ color: 'var(--color-muted)' }}>
                          {asset.assetType === 'subscription' ? '订阅' : '买断'}
                          {' · '}
                          {asset.categoryName || '未分类'}
                          {tagsText ? ` · ${tagsText}` : ''}
                        </div>

                        <div className="text-[12px]" style={{ color: 'var(--color-muted-soft)' }}>
                          {(asset.purchasePrice || asset.subscriptionPrice)
                            ? `¥${Number(asset.purchasePrice || asset.subscriptionPrice).toLocaleString('zh-CN')}`
                            : '—'}
                          {' · '}
                          {`${(asset.assetType === 'subscription' ? '订阅 ' : '购买 ') + holdingDays} 天`}
                        </div>
                      </div>
                    </div>
                  </div>

                </button>
              )
            })
          : assets.length === 0
            ? (
                <EmptyState
                  emoji="📦"
                  title="还没有资产，开始记录你的第一件物品"
                  actions={[
                    { label: '+ 创建资产', to: '/assets/new' },
                    { label: '+ 创建订阅', to: '/subscriptions/new' },
                  ]}
                />
              )
            : (
                <EmptyState
                  emoji="🔍"
                  title="没有匹配的资产"
                  actions={[
                    {
                      label: '重置筛选',
                      onClick: () => {
                        setSearch('')
                        setActiveType(null)
                        setSelectedCategory(null)
                        setSelectedTag(null)
                        setSortOption('default')
                      },
                    },
                  ]}
                />
              )}
      </div>

      {filteredAssets.length > 0 && (
        <div className="mt-4 text-center text-[12px]" style={{ color: 'var(--color-muted-soft)' }}>
          共
          {' '}
          {filteredAssets.length}
          {' '}
          件
        </div>
      )}

      <Sheet open={sheetType === 'tag'} onOpenChange={open => !open && setSheetType(null)}>
        <SheetContent side="bottom" className="rounded-t-xl">
          <SheetHeader className="pb-1">
            <SheetTitle>选择标签</SheetTitle>
          </SheetHeader>
          <div className="mb-4 space-y-1 px-4 pb-8">
            <Button
              type="button"
              variant="ghost"
              className="h-11 w-full justify-start  bg-primary/5"
              onClick={() => {
                setSelectedTag(null)
                setSheetType(null)
              }}
            >
              全部标签
            </Button>
            {tags.map(tag => (
              <Button
                key={tag.id}
                type="button"
                variant="ghost"
                className="h-11 w-full justify-start  bg-primary/5 "
                onClick={() => {
                  setSelectedTag(tag.id)
                  setSheetType(null)
                }}
              >
                <span className="mr-2 inline-block h-2 w-2 rounded-full" style={{ background: tag.color }} />
                {tag.name}
              </Button>
            ))}
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={sheetType === 'sort'} onOpenChange={open => !open && setSheetType(null)}>
        <SheetContent side="bottom" className="rounded-t-xl">
          <SheetHeader className="pb-1">
            <SheetTitle>排序方式</SheetTitle>
          </SheetHeader>
          <div className="mb-4 space-y-1 px-4 pb-8">
            {(Object.entries(sortLabels) as [SortOption, string][]).map(([value, label]) => (
              <Button
                key={value}
                type="button"
                variant="ghost"
                className="h-11 w-full justify-start bg-primary/5"
                onClick={() => {
                  setSortOption(value)
                  setSheetType(null)
                }}
              >
                {label}
              </Button>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
