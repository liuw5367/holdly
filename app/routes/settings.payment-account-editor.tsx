import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router'
import { IconCheck, IconLoader2 } from '@tabler/icons-react'
import { useState } from 'react'
import { data, Form, redirect, useActionData, useLoaderData, useNavigation } from 'react-router'
import { SubPageHeader } from '~/components/page-header'
import { Button } from '~/components/ui/button'
import { Field, FieldError, FieldGroup, FieldLabel } from '~/components/ui/field'
import { Input } from '~/components/ui/input'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select'
import { Textarea } from '~/components/ui/textarea'
import {
  createSettingsCreditCard,
  createSettingsPaymentAccount,
  getSettingsPaymentAccountById,
  getSettingsPaymentTypesByUserId,
  updateSettingsCreditCard,
  updateSettingsPaymentAccount,
} from '~/db/queries/settings'
import { creditCardSchema, genericPaymentAccountSchema } from '~/lib/payment-account.schema'
import { isCreditCardPaymentType } from '~/lib/payment-type'
import { createSupabaseServerClient } from '~/lib/supabase.server'

const repaymentRuleItems = [
  { label: '每月固定日', value: 'fixed_day' },
  { label: '出账后若干天', value: 'days_after_statement' },
]

export async function loader({ request, params }: LoaderFunctionArgs) {
  const { supabase, headers } = createSupabaseServerClient(request)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user)
    throw redirect('/login', { headers })

  const [paymentTypes, account] = await Promise.all([
    getSettingsPaymentTypesByUserId(user.id),
    params.id ? getSettingsPaymentAccountById(user.id, params.id) : Promise.resolve(null),
  ])
  if (params.id && !account)
    throw new Response('Not Found', { status: 404 })

  const url = new URL(request.url)
  const requestedTypeId = url.searchParams.get('paymentTypeId')
  const defaultPaymentTypeId = paymentTypes.some(type => type.id === requestedTypeId)
    ? requestedTypeId
    : paymentTypes[0]?.id || ''

  return data({
    paymentTypes,
    account,
    defaultPaymentTypeId,
    returnType: url.searchParams.get('returnType'),
  }, { headers })
}

export async function action({ request, params }: ActionFunctionArgs) {
  const { supabase, headers } = createSupabaseServerClient(request)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user)
    throw redirect('/login', { headers })

  const [paymentTypes, account] = await Promise.all([
    getSettingsPaymentTypesByUserId(user.id),
    params.id ? getSettingsPaymentAccountById(user.id, params.id) : Promise.resolve(null),
  ])
  if (params.id && !account)
    throw new Response('Not Found', { status: 404 })

  const formData = await request.formData()
  const paymentTypeId = account?.paymentTypeId || String(formData.get('paymentTypeId') || '')
  const selectedType = paymentTypes.find(type => type.id === paymentTypeId)
  if (!selectedType)
    return data({ ok: false, errors: { paymentTypeId: ['请选择有效的支付类型'] } }, { status: 400, headers })

  const isCreditCard = account
    ? account.accountKind === 'credit_card'
    : isCreditCardPaymentType(selectedType)

  if (!isCreditCard) {
    const parsed = genericPaymentAccountSchema.safeParse({
      paymentTypeId,
      name: formData.get('name'),
    })
    if (!parsed.success)
      return data({ ok: false, errors: parsed.error.flatten().fieldErrors }, { status: 400, headers })

    if (account)
      await updateSettingsPaymentAccount(user.id, account.id, { name: parsed.data.name })
    else
      await createSettingsPaymentAccount(user.id, parsed.data)

    const returnType = String(formData.get('returnType') || '')
    return redirect(returnType ? `/settings/payment-accounts?type=${encodeURIComponent(returnType)}` : '/settings/payment-accounts', { headers })
  }

  const repaymentRule = String(formData.get('repaymentRule') || '')
  const parsed = creditCardSchema.safeParse({
    paymentTypeId,
    name: formData.get('name'),
    bankName: formData.get('bankName'),
    lastFour: formData.get('lastFour'),
    notes: formData.get('notes'),
    statementDay: formData.get('statementDay'),
    repaymentRule,
    repaymentDay: repaymentRule === 'fixed_day' ? formData.get('repaymentDay') : undefined,
    repaymentDaysAfterStatement: repaymentRule === 'days_after_statement' ? formData.get('repaymentDaysAfterStatement') : undefined,
    creditLimit: formData.get('creditLimit'),
    currencyCode: formData.get('currencyCode'),
  })
  if (!parsed.success)
    return data({ ok: false, errors: parsed.error.flatten().fieldErrors }, { status: 400, headers })

  const id = account
    ? (await updateSettingsCreditCard(user.id, account.id, parsed.data))?.id
    : await createSettingsCreditCard(user.id, parsed.data)
  if (!id)
    throw new Response('Not Found', { status: 404, headers })

  const returnType = String(formData.get('returnType') || '')
  const suffix = returnType ? `?returnType=${encodeURIComponent(returnType)}` : ''
  return redirect(`/settings/payment-accounts/${id}${suffix}`, { headers })
}

export default function PaymentAccountEditor() {
  const { paymentTypes, account, defaultPaymentTypeId, returnType } = useLoaderData<typeof loader>()
  const actionData = useActionData<typeof action>()
  const navigation = useNavigation()
  const [paymentTypeId, setPaymentTypeId] = useState(account?.paymentTypeId || defaultPaymentTypeId)
  const [repaymentRule, setRepaymentRule] = useState(account?.repaymentRule || 'fixed_day')
  const errors = actionData?.errors as Record<string, string[] | undefined> | undefined
  const isSubmitting = navigation.state === 'submitting'
  const paymentTypeItems = paymentTypes.map(type => ({ label: type.name, value: type.id }))
  const selectedType = paymentTypes.find(type => type.id === paymentTypeId)
  const isCreditCard = account
    ? account.accountKind === 'credit_card'
    : Boolean(selectedType && isCreditCardPaymentType(selectedType))
  const typeName = paymentTypes.find(type => type.id === account?.paymentTypeId)?.name || '未分类'
  const backTo = account?.accountKind === 'credit_card'
    ? `/settings/payment-accounts/${account.id}${returnType ? `?returnType=${encodeURIComponent(returnType)}` : ''}`
    : returnType
      ? `/settings/payment-accounts?type=${encodeURIComponent(returnType)}`
      : '/settings/payment-accounts'

  return (
    <div className="pb-8">
      <SubPageHeader backTo={backTo} title={account ? '编辑账户' : '添加账户'} />
      {isCreditCard && (
        <div className="mb-5 rounded-xl bg-primary/8 p-4 text-sm text-muted-foreground">
          只保存尾号等资料。请勿填写完整卡号、CVV、安全码、密码或验证码。
        </div>
      )}
      <Form method="post">
        <input type="hidden" name="returnType" value={returnType || ''} />
        <FieldGroup>
          <Field data-invalid={Boolean(errors?.paymentTypeId) || undefined}>
            <FieldLabel>支付类型</FieldLabel>
            {account
              ? (
                  <>
                    <Input value={typeName} disabled />
                    <input type="hidden" name="paymentTypeId" value={account.paymentTypeId} />
                  </>
                )
              : (
                  <Select items={paymentTypeItems} name="paymentTypeId" value={paymentTypeId} onValueChange={value => setPaymentTypeId(value || '')}>
                    <SelectTrigger className="w-full"><SelectValue placeholder="请选择支付类型" /></SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {paymentTypeItems.map(item => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                )}
            <FieldError>{errors?.paymentTypeId?.[0]}</FieldError>
          </Field>

          {isCreditCard && (
            <Field data-invalid={Boolean(errors?.bankName) || undefined}>
              <FieldLabel>银行</FieldLabel>
              <Input name="bankName" defaultValue={account?.bankName || ''} placeholder="例如：招商银行" />
              <FieldError>{errors?.bankName?.[0]}</FieldError>
            </Field>
          )}

          <Field data-invalid={Boolean(errors?.name) || undefined}>
            <FieldLabel>{isCreditCard ? '卡片名称' : '账户名称'}</FieldLabel>
            <Input name="name" defaultValue={account?.name || ''} placeholder={isCreditCard ? '例如：Visa 白金卡' : '例如：微信零钱'} />
            <FieldError>{errors?.name?.[0]}</FieldError>
          </Field>

          {isCreditCard && (
            <>
              <Field data-invalid={Boolean(errors?.lastFour) || undefined}>
                <FieldLabel>卡片尾号</FieldLabel>
                <Input name="lastFour" inputMode="numeric" maxLength={4} defaultValue={account?.lastFour || ''} placeholder="可选，仅四位数字" />
                <FieldError>{errors?.lastFour?.[0]}</FieldError>
              </Field>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field data-invalid={Boolean(errors?.statementDay) || undefined}>
                  <FieldLabel>出账日</FieldLabel>
                  <Input name="statementDay" type="number" min="1" max="31" defaultValue={account?.statementDay || ''} />
                  <FieldError>{errors?.statementDay?.[0]}</FieldError>
                </Field>
                <Field>
                  <FieldLabel>还款规则</FieldLabel>
                  <Select items={repaymentRuleItems} name="repaymentRule" value={repaymentRule} onValueChange={value => setRepaymentRule(value || 'fixed_day')}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {repaymentRuleItems.map(item => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              {repaymentRule === 'fixed_day'
                ? (
                    <Field data-invalid={Boolean(errors?.repaymentDay) || undefined}>
                      <FieldLabel>固定还款日</FieldLabel>
                      <Input name="repaymentDay" type="number" min="1" max="31" defaultValue={account?.repaymentDay || ''} />
                      <FieldError>{errors?.repaymentDay?.[0]}</FieldError>
                    </Field>
                  )
                : (
                    <Field data-invalid={Boolean(errors?.repaymentDaysAfterStatement) || undefined}>
                      <FieldLabel>出账后天数</FieldLabel>
                      <Input name="repaymentDaysAfterStatement" type="number" min="0" max="60" defaultValue={account?.repaymentDaysAfterStatement ?? ''} />
                      <FieldError>{errors?.repaymentDaysAfterStatement?.[0]}</FieldError>
                    </Field>
                  )}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field data-invalid={Boolean(errors?.creditLimit) || undefined}>
                  <FieldLabel>额度</FieldLabel>
                  <Input name="creditLimit" type="number" min="0" step="0.01" defaultValue={account?.creditLimit || ''} placeholder="可选" />
                  <FieldError>{errors?.creditLimit?.[0]}</FieldError>
                </Field>
                <Field data-invalid={Boolean(errors?.currencyCode) || undefined}>
                  <FieldLabel>币种</FieldLabel>
                  <Input name="currencyCode" maxLength={3} defaultValue={account?.currencyCode || 'CNY'} />
                  <FieldError>{errors?.currencyCode?.[0]}</FieldError>
                </Field>
              </div>
              <Field data-invalid={Boolean(errors?.notes) || undefined}>
                <FieldLabel>备注</FieldLabel>
                <Textarea name="notes" defaultValue={account?.notes || ''} placeholder="可选；请勿填写敏感凭证" />
                <FieldError>{errors?.notes?.[0]}</FieldError>
              </Field>
            </>
          )}

          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? <IconLoader2 className="animate-spin" data-icon="inline-start" /> : <IconCheck data-icon="inline-start" />}
            {account ? '保存修改' : '添加账户'}
          </Button>
        </FieldGroup>
      </Form>
    </div>
  )
}
