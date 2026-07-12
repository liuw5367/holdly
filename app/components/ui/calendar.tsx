'use client'

import { IconChevronDown, IconChevronLeft, IconChevronRight } from '@tabler/icons-react'
import * as React from 'react'
import { DayPicker } from 'react-day-picker'
import { buttonVariants } from '~/components/ui/button'

import { cn } from '~/lib/utils'

function CalendarChevron({
  orientation,
  className,
  ...props
}: {
  orientation?: 'left' | 'right' | 'up' | 'down'
  className?: string
} & React.SVGProps<SVGSVGElement>) {
  if (orientation === 'left')
    return <IconChevronLeft className={cn('h-4 w-4', className)} {...props} />
  if (orientation === 'right')
    return <IconChevronRight className={cn('h-4 w-4', className)} {...props} />
  return <IconChevronDown className={cn('h-4 w-4', className)} {...props} />
}

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: React.ComponentProps<typeof DayPicker>) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn('relative bg-[var(--color-canvas)] p-3', className)}
      classNames={{
        months: 'flex flex-col gap-3 sm:flex-row',
        month: 'space-y-3',
        month_caption: 'relative flex items-center justify-center pt-1',
        dropdowns: 'flex items-center justify-center gap-1.5',
        dropdown_root: 'relative rounded-md border border-[var(--color-hairline)] bg-[var(--color-canvas)]',
        dropdown: 'absolute inset-0 cursor-pointer opacity-0',
        caption_label: 'flex h-7 items-center gap-1 px-2 text-sm font-medium text-[var(--color-ink)]',
        nav: 'pointer-events-none absolute inset-x-3 top-4 z-10 flex items-center justify-between',
        button_previous: cn(
          buttonVariants({ variant: 'ghost', size: 'icon-sm' }),
          'pointer-events-auto h-7 w-7 border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-0 opacity-80 hover:opacity-100',
        ),
        button_next: cn(
          buttonVariants({ variant: 'ghost', size: 'icon-sm' }),
          'pointer-events-auto h-7 w-7 border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-0 opacity-80 hover:opacity-100',
        ),
        month_grid: 'w-full border-collapse',
        weekdays: 'flex',
        weekday: 'w-9 text-xs font-medium text-[var(--color-muted)]',
        weeks: 'mt-1',
        week: 'mt-1 flex w-full',
        day: 'h-9 w-9 p-0 text-center text-sm',
        day_button: cn(
          buttonVariants({ variant: 'ghost', size: 'icon-sm' }),
          'h-9 w-9 rounded-md p-0 font-normal text-[var(--color-ink)] hover:bg-[var(--color-surface-soft)]',
        ),
        selected: 'bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-active)]',
        today: 'bg-[var(--color-primary-muted)] text-[var(--color-primary)]',
        outside: 'text-[var(--color-muted-soft)] opacity-60',
        disabled: 'opacity-35',
        hidden: 'invisible',
        ...classNames,
      }}
      components={{
        Chevron: CalendarChevron,
      }}
      {...props}
    />
  )
}

export { Calendar }
