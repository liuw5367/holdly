import { IconCheck, IconChevronDown, IconX } from '@tabler/icons-react'
import { useState } from 'react'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '~/components/ui/popover'

interface MultiSelectItem {
  value: string
  label: string
  color?: string
}

interface MultiSelectProps {
  items: MultiSelectItem[]
  selected: string[]
  onToggle: (value: string) => void
  placeholder?: string
  id?: string
}

export function MultiSelect({
  items,
  selected,
  onToggle,
  placeholder = '请选择',
  id,
}: MultiSelectProps) {
  const [open, setOpen] = useState(false)

  const selectedItems = items.filter(item => selected.includes(item.value))

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div className="flex min-h-11 w-full items-center gap-2 rounded-[10px] border border-[var(--color-hairline)] bg-[var(--color-canvas)] px-3 py-2 text-[15px] transition-colors focus-within:ring-2 focus-within:ring-[var(--color-primary-muted)]">
        <div className="flex min-w-0 flex-1 flex-wrap gap-1">
          {selectedItems.length === 0
            ? (
                <span className="text-[var(--color-muted)]">{placeholder}</span>
              )
            : (
                selectedItems.map(item => (
                  <Badge
                    key={item.value}
                    className="rounded-full px-2 py-0.5 text-[12px] font-medium"
                    style={{
                      background: item.color ? `${item.color}22` : 'var(--color-surface-strong)',
                      color: item.color || 'var(--color-body)',
                    }}
                  >
                    {item.label}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      aria-label={`移除${item.label}`}
                      className="ml-1 inline-flex size-4 items-center justify-center rounded-full transition-colors hover:bg-black/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
                      onClick={(e) => {
                        e.stopPropagation()
                        onToggle(item.value)
                      }}
                      style={{ color: item.color || 'var(--color-muted)' }}
                    >
                      <IconX className="size-3" />
                    </Button>
                  </Badge>
                ))
              )}
        </div>
        <PopoverTrigger
          id={id}
          aria-label="选择标签"
          render={<Button type="button" variant="ghost" size="icon-sm" className="size-7 shrink-0 text-[var(--color-muted)]" />}
        >
          <IconChevronDown className="size-3.5" />
        </PopoverTrigger>
      </div>
      <PopoverContent className="w-72 p-1" align="start">
        <div className="max-h-[240px] overflow-y-auto">
          {items.map((item) => {
            const isSelected = selected.includes(item.value)
            return (
              <button
                key={item.value}
                type="button"
                onClick={() => onToggle(item.value)}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[14px] transition-colors hover:opacity-80"
                style={{
                  background: isSelected ? 'var(--color-primary-muted)' : 'transparent',
                  color: isSelected ? 'var(--color-primary)' : 'var(--color-ink)',
                }}
              >
                <span
                  className="flex h-4 w-4 items-center justify-center rounded border"
                  style={{
                    borderColor: isSelected ? 'var(--color-primary)' : 'var(--color-hairline)',
                    background: isSelected ? 'var(--color-primary)' : 'transparent',
                  }}
                >
                  {isSelected && <IconCheck size={12} style={{ color: '#fff' }} />}
                </span>
                {item.color && (
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ background: item.color }}
                  />
                )}
                <span className="flex-1">{item.label}</span>
              </button>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}
