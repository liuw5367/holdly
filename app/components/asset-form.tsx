import type { AssetFormValues } from '~/lib/asset.schema'
import { IconLoader2 } from '@tabler/icons-react'
import { addMonths, addYears, format, isAfter } from 'date-fns'
import EmojiPicker from 'emoji-picker-react'
import { useMemo, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate, useNavigation } from 'react-router'
import { toast } from 'sonner'
import { Button } from '~/components/ui/button'
import { DatePicker } from '~/components/ui/date-picker'
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '~/components/ui/field'
import { Input } from '~/components/ui/input'
import { MultiSelect } from '~/components/ui/multi-select'
import { Popover, PopoverContent, PopoverTrigger } from '~/components/ui/popover'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select'
import { Textarea } from '~/components/ui/textarea'

interface Category {
  id: string
  name: string
  emoji: string
}

interface Tag {
  id: string
  name: string
  color: string
}

interface PaymentType {
  id: string
  name: string
}

interface PaymentAccount {
  id: string
  name: string
  paymentTypeId: string | null
  isActive?: boolean
}

type FormMode = 'asset' | 'subscription'

interface AssetFormProps {
  categories: Category[]
  tags: Tag[]
  paymentTypes: PaymentType[]
  paymentAccounts: PaymentAccount[]
  mode: FormMode
  defaultValues?: Partial<AssetFormValues>
  submitLabel?: string
  backLabel?: string
  backTo?: string
  title?: string
  purchasePriceLabel?: string
  hideOneTimeFields?: boolean
  hideHeader?: boolean
  errors?: Record<string, string[]>
  onSubmit: (fd: FormData) => void
  topContent?: React.ReactNode
  children?: React.ReactNode
  submitRef?: React.Ref<HTMLButtonElement>
}

function RequiredMark() {
  return <span className="ml-1 text-destructive">*</span>
}

export function AssetForm({
  categories,
  tags,
  paymentTypes,
  paymentAccounts,
  mode,
  defaultValues,
  submitLabel = '保存资产',
  backLabel = '‹ 返回',
  backTo,
  title,
  purchasePriceLabel = '购入价',
  hideOneTimeFields = false,
  hideHeader = false,
  errors: serverErrors,
  onSubmit,
  topContent,
  children,
  submitRef,
}: AssetFormProps) {
  const navigate = useNavigate()
  const navigation = useNavigation()
  const isSubmitting = navigation.state === 'submitting'
  const internalSubmitRef = useRef<HTMLButtonElement>(null)

  const [selectedPaymentTypeId, setSelectedPaymentTypeId] = useState<string | null>(defaultValues?.paymentTypeId || null)
  const [selectedPaymentAccountId, setSelectedPaymentAccountId] = useState<string | null>(defaultValues?.paymentAccountId || null)
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(defaultValues?.categoryId || null)
  const [selectedBillingCycle, setSelectedBillingCycle] = useState<AssetFormValues['billingCycle'] | null>(defaultValues?.billingCycle || null)
  const [today] = useState(() => new Date().toISOString().split('T')[0])
  const [selectedPurchaseDate, setSelectedPurchaseDate] = useState(defaultValues?.purchaseDate || today)
  const [selectedTags, setSelectedTags] = useState<string[]>(defaultValues?.tagIds || [])
  const [selectedEmoji, setSelectedEmoji] = useState(defaultValues?.emoji || '📦')
  const [emojiOpen, setEmojiOpen] = useState(false)

  const isSubscription = mode === 'subscription'

  const availableAccounts = paymentAccounts.filter(account => account.isActive !== false || account.id === selectedPaymentAccountId)
  const filteredAccounts = selectedPaymentTypeId
    ? availableAccounts.filter(a => a.paymentTypeId === selectedPaymentTypeId)
    : availableAccounts
  const categoryLabelById = useMemo(
    () => Object.fromEntries(categories.map(c => [c.id, `${c.emoji} ${c.name}`])),
    [categories],
  )
  const paymentTypeLabelById = useMemo(
    () => Object.fromEntries(paymentTypes.map(p => [p.id, p.name])),
    [paymentTypes],
  )
  const paymentAccountLabelById = useMemo(
    () => Object.fromEntries(paymentAccounts.map(a => [a.id, a.name])),
    [paymentAccounts],
  )

  const {
    register,
    handleSubmit,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<AssetFormValues>({
    mode: 'onChange',
    defaultValues: {
      name: defaultValues?.name || '',
      emoji: defaultValues?.emoji || '📦',
      categoryId: defaultValues?.categoryId || '',
      assetType: isSubscription ? 'subscription' : 'one_time',
      tagIds: defaultValues?.tagIds || [],
      notes: defaultValues?.notes || '',
      paymentTypeId: defaultValues?.paymentTypeId || '',
      paymentAccountId: defaultValues?.paymentAccountId || '',
      purchasePrice: defaultValues?.purchasePrice || '',
      currentValue: defaultValues?.currentValue || '',
      purchaseDate: defaultValues?.purchaseDate || today,
      purchaseReceipt: defaultValues?.purchaseReceipt || '',
      subscriptionPrice: defaultValues?.subscriptionPrice || '',
      billingCycle: defaultValues?.billingCycle || undefined,
      nextRenewalDate: defaultValues?.nextRenewalDate || '',
      subscriptionStartDate: defaultValues?.subscriptionStartDate || '',
    },
  })

  function handleFormSubmit(data: AssetFormValues) {
    const fd = new FormData()
    fd.append('assetType', isSubscription ? 'subscription' : 'one_time')
    fd.append('name', data.name)
    fd.append('emoji', selectedEmoji)
    fd.append('categoryId', data.categoryId)
    if (selectedPaymentTypeId)
      fd.append('paymentTypeId', selectedPaymentTypeId)
    if (selectedPaymentAccountId)
      fd.append('paymentAccountId', selectedPaymentAccountId)
    if (data.notes)
      fd.append('notes', data.notes)
    selectedTags.forEach(id => fd.append('tagIds', id))

    if (isSubscription) {
      fd.append('subscriptionPrice', data.subscriptionPrice || '')
      fd.append('billingCycle', data.billingCycle || '')
      fd.append('purchaseDate', selectedPurchaseDate || '')
      if (data.purchaseReceipt)
        fd.append('purchaseReceipt', data.purchaseReceipt)
      fd.append('subscriptionStartDate', data.subscriptionStartDate || selectedPurchaseDate || '')
    }
    else {
      fd.append('purchasePrice', data.purchasePrice || '')
      if (data.currentValue)
        fd.append('currentValue', data.currentValue)
      fd.append('purchaseDate', selectedPurchaseDate || '')
    }

    onSubmit(fd)
  }

  function toggleTag(id: string) {
    setSelectedTags(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id],
    )
  }

  function fieldError(field: string) {
    const clientErr = errors[field as keyof typeof errors]?.message
    const serverErr = serverErrors?.[field]?.[0]
    return clientErr || serverErr
  }

  function validateBeforeSubmit() {
    const values = getValues()
    const requiredErrors: string[] = []

    if (!values.name?.trim())
      requiredErrors.push('名称')
    if (!selectedCategoryId)
      requiredErrors.push('分类')
    if (!selectedPurchaseDate)
      requiredErrors.push(isSubscription ? '订阅日期' : '购入日期')

    if (isSubscription) {
      if (!values.subscriptionPrice || Number(values.subscriptionPrice) <= 0)
        requiredErrors.push('订阅金额')
      if (!selectedBillingCycle)
        requiredErrors.push('订阅周期')
    }
    else if (!hideOneTimeFields) {
      if (!values.purchasePrice || Number(values.purchasePrice) <= 0)
        requiredErrors.push('购入价')
    }

    return requiredErrors
  }

  const nextRenewalPreview = useMemo(() => {
    if (!isSubscription || !selectedPurchaseDate || !selectedBillingCycle)
      return null
    const start = new Date(`${selectedPurchaseDate}T00:00:00`)
    const now = new Date()
    let next = new Date(start)
    while (!isAfter(next, now)) {
      if (selectedBillingCycle === 'monthly')
        next = addMonths(next, 1)
      else if (selectedBillingCycle === 'quarterly')
        next = addMonths(next, 3)
      else
        next = addYears(next, 1)
    }
    return format(next, 'yyyy-MM-dd')
  }, [isSubscription, selectedPurchaseDate, selectedBillingCycle])

  return (
    <div>
      {!hideHeader && (
        <div
          className="sticky top-0 z-10 flex items-center justify-between py-3"
          style={{ background: 'var(--color-canvas)' }}
        >
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => backTo && navigate(backTo)}
            className="h-9 px-2 text-sm"
            style={{ color: 'var(--color-muted)' }}
          >
            {backLabel}
          </Button>
          {title && (
            <span className="text-base font-semibold" style={{ color: 'var(--color-ink)' }}>
              {title}
            </span>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              const invalid = validateBeforeSubmit()
              if (invalid.length > 0) {
                toast.error(`请先填写必填项：${invalid.join('、')}`)
                return
              }
              handleSubmit(handleFormSubmit)()
            }}
            disabled={isSubmitting}
            className="h-9 gap-1 px-2 text-sm font-medium"
            style={{ color: 'var(--color-primary)' }}
          >
            {isSubmitting && <IconLoader2 size={14} className="animate-spin" />}
            {isSubmitting ? '保存中' : '保存'}
          </Button>
        </div>
      )}

      <form
        onSubmit={handleSubmit(
          handleFormSubmit,
          () => {
            const invalid = validateBeforeSubmit()
            if (invalid.length > 0)
              toast.error(`请先填写必填项：${invalid.join('、')}`)
          },
        )}
      >
        <input type="hidden" {...register('assetType')} value={isSubscription ? 'subscription' : 'one_time'} />
        <button
          ref={(el) => {
            (internalSubmitRef as { current: HTMLButtonElement | null }).current = el
            if (typeof submitRef === 'function')
              submitRef(el)
            else if (submitRef && 'current' in submitRef)
              (submitRef as { current: HTMLButtonElement | null }).current = el
          }}
          type="submit"
          className="hidden"
          aria-hidden="true"
        />

        {topContent && <div className="mb-3">{topContent}</div>}

        <div className="flex flex-col items-center py-4 pb-6">
          <Popover open={emojiOpen} onOpenChange={setEmojiOpen}>
            <PopoverTrigger
              className="flex h-[60px] w-[60px] cursor-pointer items-center justify-center rounded-lg text-[30px] transition-opacity hover:opacity-80"
              style={{ background: 'var(--color-primary-muted)' }}
            >
              {selectedEmoji}
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="center">
              <EmojiPicker
                onEmojiClick={(emojiData) => {
                  setSelectedEmoji(emojiData.emoji)
                  setEmojiOpen(false)
                }}
                width={320}
                height={380}
              />
            </PopoverContent>
          </Popover>
        </div>

        <FieldGroup>
          <Field data-invalid={Boolean(fieldError('name')) || undefined}>
            <FieldLabel>
              名称
              <RequiredMark />
            </FieldLabel>
            <Input
              aria-invalid={Boolean(fieldError('name')) || undefined}
              placeholder={isSubscription ? '例：iCloud+' : '例：MacBook Pro'}
              {...register('name')}
            />
            <FieldError>{fieldError('name')}</FieldError>
          </Field>

          <Field data-invalid={Boolean(fieldError('categoryId')) || undefined}>
            <FieldLabel>
              分类
              <RequiredMark />
            </FieldLabel>
            <Select
              value={selectedCategoryId}
              onValueChange={(v: string | null) => {
                if (v) {
                  setSelectedCategoryId(v)
                  setValue('categoryId', v)
                }
              }}
            >
              <SelectTrigger aria-invalid={Boolean(fieldError('categoryId')) || undefined} className="w-full">
                <SelectValue placeholder="请选择分类">
                  {value => value ? (categoryLabelById[String(value)] || String(value)) : '请选择分类'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {categories.map(c => (
                    <SelectItem key={c.id} value={c.id} label={`${c.emoji} ${c.name}`}>
                      {c.emoji}
                      {' '}
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <FieldError>{fieldError('categoryId')}</FieldError>
          </Field>

          {!isSubscription && !hideOneTimeFields && (
            <>
              <Field data-invalid={Boolean(fieldError('purchasePrice')) || undefined}>
                <FieldLabel>
                  {purchasePriceLabel}
                  <RequiredMark />
                </FieldLabel>
                <Input
                  aria-invalid={Boolean(fieldError('purchasePrice')) || undefined}
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  {...register('purchasePrice')}
                />
                <FieldError>{fieldError('purchasePrice')}</FieldError>
              </Field>

              <Field>
                <FieldLabel>当前估价</FieldLabel>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="可选，留空默认等于购入价"
                  {...register('currentValue')}
                />
              </Field>

              <Field data-invalid={Boolean(fieldError('purchaseReceipt')) || undefined}>
                <FieldLabel>购买凭证</FieldLabel>
                <Textarea
                  aria-invalid={Boolean(fieldError('purchaseReceipt')) || undefined}
                  placeholder="可填写订单号、发票说明或 http(s) 链接"
                  className="resize-y"
                  {...register('purchaseReceipt')}
                />
                <FieldError>{fieldError('purchaseReceipt')}</FieldError>
              </Field>
            </>
          )}

          {isSubscription && (
            <>
              <Field data-invalid={Boolean(fieldError('subscriptionPrice')) || undefined}>
                <FieldLabel>
                  订阅金额
                  <RequiredMark />
                </FieldLabel>
                <Input
                  aria-invalid={Boolean(fieldError('subscriptionPrice')) || undefined}
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  placeholder="0.00"
                  {...register('subscriptionPrice')}
                />
                <FieldError>{fieldError('subscriptionPrice')}</FieldError>
              </Field>

              <Field data-invalid={Boolean(fieldError('billingCycle')) || undefined}>
                <FieldLabel>
                  订阅周期
                  <RequiredMark />
                </FieldLabel>
                <Select
                  value={selectedBillingCycle}
                  onValueChange={(v: string | null) => {
                    if (v) {
                      const cycle = v as 'monthly' | 'quarterly' | 'yearly'
                      setSelectedBillingCycle(cycle)
                      setValue('billingCycle', cycle)
                    }
                  }}
                >
                  <SelectTrigger aria-invalid={Boolean(fieldError('billingCycle')) || undefined} className="w-full">
                    <SelectValue placeholder="请选择周期">
                      {(value) => {
                        if (!value)
                          return '请选择周期'
                        if (value === 'monthly')
                          return '月付'
                        if (value === 'quarterly')
                          return '季付'
                        if (value === 'yearly')
                          return '年付'
                        return String(value)
                      }}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="monthly">月付</SelectItem>
                      <SelectItem value="quarterly">季付</SelectItem>
                      <SelectItem value="yearly">年付</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <FieldError>{fieldError('billingCycle')}</FieldError>
              </Field>
            </>
          )}

          <Field data-invalid={Boolean(fieldError('purchaseDate')) || undefined}>
            <FieldLabel>
              {isSubscription ? '订阅日期' : '购入日期'}
              <RequiredMark />
            </FieldLabel>
            <input type="hidden" {...register('purchaseDate')} value={selectedPurchaseDate} />
            <DatePicker
              value={selectedPurchaseDate}
              onChange={(v) => {
                setSelectedPurchaseDate(v)
                setValue('purchaseDate', v)
                if (isSubscription)
                  setValue('subscriptionStartDate', v)
              }}
            />
            <FieldError>{fieldError('purchaseDate')}</FieldError>
          </Field>

          {isSubscription && (
            <Field>
              <FieldLabel>下次续费日期（自动计算）</FieldLabel>
              <Input readOnly value={nextRenewalPreview || '请先选择订阅日期和周期'} />
            </Field>
          )}

          {children}

          <div className="grid grid-cols-2 gap-2">
            <Field>
              <FieldLabel>支付类型</FieldLabel>
              <Select
                value={selectedPaymentTypeId}
                onValueChange={(v: string | null) => {
                  const val = v || null
                  setSelectedPaymentTypeId(val)
                  setValue('paymentTypeId', val || '')
                  setSelectedPaymentAccountId(null)
                  setValue('paymentAccountId', '')
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="可选">
                    {value => value ? (paymentTypeLabelById[String(value)] || String(value)) : '可选'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {paymentTypes.map(p => (
                      <SelectItem key={p.id} value={p.id} label={p.name}>{p.name}</SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel>支付方式</FieldLabel>
              <Select
                value={selectedPaymentAccountId}
                onValueChange={(v: string | null) => {
                  const val = v || null
                  setSelectedPaymentAccountId(val)
                  setValue('paymentAccountId', val || '')
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="可选">
                    {value => value ? (paymentAccountLabelById[String(value)] || String(value)) : '可选'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {filteredAccounts.map(a => (
                      <SelectItem key={a.id} value={a.id} label={a.name}>{a.name}</SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
          </div>

          <Field>
            <FieldLabel>标签</FieldLabel>
            <MultiSelect
              items={tags.map(tag => ({ value: tag.id, label: tag.name, color: tag.color }))}
              selected={selectedTags}
              onToggle={toggleTag}
              placeholder="可选"
            />
          </Field>

          <Field>
            <FieldLabel>备注</FieldLabel>
            <Textarea
              className="resize-y"
              placeholder="可选备注..."
              {...register('notes')}
            />
          </Field>
        </FieldGroup>

        <Button
          type="submit"
          disabled={isSubmitting}
          className="sticky bottom-4 mt-6 mb-6 flex w-full items-center justify-center gap-2 text-[15px] font-semibold"
          onClick={(e) => {
            const invalid = validateBeforeSubmit()
            if (invalid.length > 0) {
              e.preventDefault()
              toast.error(`请先填写必填项：${invalid.join('、')}`)
            }
          }}
        >
          {isSubmitting && <IconLoader2 size={16} className="animate-spin" />}
          {submitLabel}
        </Button>
      </form>
    </div>
  )
}
