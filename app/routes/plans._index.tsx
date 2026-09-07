import type { Route } from './+types/plans._index'
import { data, Link, redirect, useLoaderData } from 'react-router'
import { EmptyState } from '~/components/empty-state'
import { MainPageHeader } from '~/components/page-header'
import { PublicAvatar } from '~/components/public-avatar'
import { getPlanSummariesByUserId } from '~/db/queries/plans'
import { getPlanAvatarToneByIndex } from '~/lib/plan-avatar'
import { createSupabaseServerClient } from '~/lib/supabase.server'

export async function loader({ request }: Route.LoaderArgs) {
  const { supabase, headers } = createSupabaseServerClient(request)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user)
    throw redirect('/login', { headers })

  const plans = await getPlanSummariesByUserId(user.id)
  return data({ plans }, { headers })
}

export default function PlansIndex() {
  const { plans } = useLoaderData<typeof loader>()

  return (
    <div className="pt-6 pb-8">
      <MainPageHeader title="财务计划" action={{ label: '+ 计划', to: '/plans/new' }} />

      <div className="flex flex-col gap-3">
        {plans.length === 0
          ? (
              <EmptyState
                emoji="💰"
                title="还没有计划"
                description="创建一个财务计划来追踪你的收支"
                actions={[
                  { label: '+ 创建计划', to: '/plans/new' },
                ]}
              />
            )
          : plans.map(plan => (
              <Link
                key={plan.id}
                to={`/plans/${plan.id}`}
                className="relative rounded-xl border p-4 transition-shadow hover:shadow-md"
                style={{
                  background: 'var(--color-surface-card)',
                  borderColor: 'var(--color-hairline)',
                }}
              >
                <div className="mb-3 flex min-w-0 items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="text-2xl">{plan.emoji}</span>
                    <span
                      className="min-w-0 truncate text-[15px] font-medium"
                      style={{ color: 'var(--color-ink)' }}
                    >
                      {plan.name}
                    </span>
                  </div>
                  <span
                    className="shrink-0 rounded-md px-2 py-0.5 text-[11px] font-medium"
                    style={{
                      background: 'var(--color-primary-muted)',
                      color: 'var(--color-primary)',
                    }}
                  >
                    {plan.planMode === 'snapshot' ? '总额记录' : '收支累加'}
                  </span>
                </div>

                <div className="mb-3 flex items-center gap-1.5">
                  {plan.members.slice(0, 4).map((member, index) => {
                    const tone = getPlanAvatarToneByIndex(index)
                    return (
                      <PublicAvatar
                        key={member.userId}
                        emoji={member.avatarEmoji}
                        nickname={member.displayName}
                        size="sm"
                        backgroundColor={tone.backgroundColor}
                        textColor={tone.textColor}
                        title={member.displayName}
                      />
                    )
                  })}
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs" style={{ color: 'var(--color-muted)' }}>
                      净收入
                    </div>
                    <div
                      className="font-[family-name:var(--font-mono)] text-lg font-semibold"
                      style={{ color: plan.latestNetIncome >= 0 ? 'var(--color-success)' : 'var(--color-error)' }}
                    >
                      {plan.latestNetIncome.toLocaleString()}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs" style={{ color: 'var(--color-muted)' }}>
                      最新月份
                    </div>
                    <div
                      className="text-sm"
                      style={{ color: 'var(--color-body)' }}
                    >
                      {plan.latestMonth}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
      </div>
    </div>
  )
}
