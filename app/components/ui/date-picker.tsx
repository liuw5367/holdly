'use client'

import { IconCalendar } from '@tabler/icons-react'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { useMemo, useState } from 'react'
import { Button } from '~/components/ui/button'
import { Calendar } from '~/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '~/components/ui/popover'
import { cn } from '~/lib/utils'

const calendarStartMonth = new Date(1900, 0)
const calendarEndMonth = new Date(new Date().getFullYear() + 100, 11)

interface DatePickerProps {
  value?: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  disabled?: boolean
}

function DatePicker({
  value,
  onChange,
  placeholder = '选择日期',
  className,
  disabled,
}: DatePickerProps) {
  const [open, setOpen] = useState(false)

  const selectedDate = useMemo(() => {
    if (!value)
      return undefined
    const date = new Date(`${value}T00:00:00`)
    return Number.isNaN(date.getTime()) ? undefined : date
  }, [value])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        disabled={disabled}
        className={cn(disabled && 'opacity-50')}
        render={(
          <Button
            type="button"
            variant="outline"
            style={{ border: '1px solid var(--color-hairline)', background: 'var(--color-canvas)' }}
            className={cn(
              'appearance-none h-11 w-full justify-between border border-solid border-[var(--color-hairline)] bg-[var(--color-canvas)] px-3 text-left text-[15px] font-normal hover:bg-[var(--color-surface-soft)]',
              !value && 'text-[var(--color-muted-soft)]',
              className,
            )}
          />
        )}
      >
        {selectedDate ? format(selectedDate, 'yyyy-MM-dd') : placeholder}
        <IconCalendar size={16} />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-auto overflow-hidden rounded-[10px] border border-solid border-[var(--color-hairline)] bg-[var(--color-canvas)] p-0"
      >
        <Calendar
          mode="single"
          captionLayout="dropdown"
          startMonth={calendarStartMonth}
          endMonth={calendarEndMonth}
          selected={selectedDate}
          locale={zhCN}
          onSelect={(date) => {
            if (!date)
              return
            onChange(format(date, 'yyyy-MM-dd'))
            setOpen(false)
          }}
        />
      </PopoverContent>
    </Popover>
  )
}

export { DatePicker }
