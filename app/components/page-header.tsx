import type { TablerIcon } from '@tabler/icons-react'
import type { ReactNode } from 'react'
import { IconArrowLeft, IconDots } from '@tabler/icons-react'
import { Link } from 'react-router'
import { Button } from '~/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu'

// ========== 子页面标题栏 ==========

interface SubPageAction {
  label: string
  icon?: TablerIcon
  onClick?: () => void
  to?: string
}

interface MoreMenuItem {
  label: string
  icon?: TablerIcon
  variant?: 'default' | 'destructive'
  onClick: () => void
}

interface SubPageHeaderProps {
  backTo: string
  backLabel?: string
  title: string
  primaryAction?: SubPageAction
  moreItems?: MoreMenuItem[]
}

export function SubPageHeader({
  backTo,
  backLabel = '返回',
  title,
  primaryAction,
  moreItems,
}: SubPageHeaderProps) {
  return (
    <div className="relative flex items-center justify-between py-3" style={{ minHeight: 48 }}>
      <Link
        to={backTo}
        className="flex items-center gap-1 text-[14px] font-medium transition-colors"
        style={{ color: 'var(--color-primary)' }}
      >
        <IconArrowLeft size={16} />
        {backLabel}
      </Link>
      <h1 className="absolute left-1/2 -translate-x-1/2 text-[14px] font-medium whitespace-nowrap" style={{ color: 'var(--color-ink)' }}>
        {title}
      </h1>
      <div className="flex items-center gap-3">
        {primaryAction && (
          primaryAction.to
            ? (
                <Link
                  to={primaryAction.to}
                  className="flex items-center gap-1 text-[14px] font-medium"
                  style={{ color: 'var(--color-primary)' }}
                >
                  {primaryAction.icon && <primaryAction.icon size={14} />}
                  {primaryAction.label}
                </Link>
              )
            : (
                <button
                  type="button"
                  onClick={primaryAction.onClick}
                  className="flex items-center gap-1 text-[14px] font-medium"
                  style={{ color: 'var(--color-primary)' }}
                >
                  {primaryAction.icon && <primaryAction.icon size={14} />}
                  {primaryAction.label}
                </button>
              )
        )}
        {moreItems && moreItems.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" className="text-[16px] tracking-wider" />}>
              <IconDots size={18} />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[140px]">
              {moreItems.map(item => (
                <DropdownMenuItem
                  key={item.label}
                  variant={item.variant || 'default'}
                  onClick={item.onClick}
                >
                  {item.icon && <item.icon size={14} />}
                  {item.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  )
}

// ========== 主页面标题栏 ==========

interface MainPageAction {
  label: string
  to: string
}

interface MainPageHeaderProps {
  title: string
  action?: MainPageAction
  actions?: MainPageAction[]
  trailing?: ReactNode
}

export function MainPageHeader({ title, action, actions, trailing }: MainPageHeaderProps) {
  const list = (action ? [action] : actions) || []
  return (
    <div className="mb-5 flex items-center justify-between">
      <h1
        className="font-[family-name:var(--font-display)] text-[28px] font-semibold"
        style={{ color: 'var(--color-ink)' }}
      >
        {title}
      </h1>

      {(trailing || list.length > 0) && (
        <div className="flex gap-2">
          {trailing}
          {list.map(action => (
            <Link
              key={action.label}
              to={action.to}
              className="rounded-lg px-3.5 py-2 text-[13px] font-medium transition-opacity hover:opacity-80"
              style={{ background: 'var(--color-primary)', color: '#fff' }}
            >
              {action.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
