import type { Route } from './+types/settings.payment-card-editor'
import { IconCheck, IconLoader2 } from '@tabler/icons-react'
import { data, Form, redirect, useActionData, useLoaderData, useNavigation } from 'react-router'
import { SubPageHeader } from '~/components/page-header'
import { Button } from '~/components/ui/button'
import { Field, FieldError, FieldGroup, FieldLabel } from '~/components/ui/field'
import { Input } from '~/components/ui/input'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select'
import { Textarea } from '~/components/ui/textarea'
import { createSettingsCreditCard, getSettingsPaymentAccountById, getSettingsPaymentTypesByUserId, updateSettingsCreditCard } from '~/db/queries/settings'
import { creditCardSchema } from '~/lib/payment-account.schema'
import { createSupabaseServerClient } from '~/lib/supabase.server'

export async function loader({ request, params }: Route.LoaderArgs) {
  const { supabase, headers } = createSupabaseServerClient(request)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user)
    throw redirect('/login', { headers })
  const [paymentTypes, account] = await Promise.all([
    getSettingsPaymentTypesByUserId(user.id),
    params.id ? getSettingsPaymentAccountById(user.id, params.id) : Promise.resolve(null),
  ])
  if (params.id && (!account || account.accountKind !== 'credit_card'))
    throw new Response('Not Found', { status: 404 })
  return data({ paymentTypes, account }, { headers })
}

export async function action({ request, params }: Route.ActionArgs) {
  const { supabase, headers } = createSupabaseServerClient(request)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user)
    throw redirect('/login', { headers })
  const formData = await request.formData()
  const repaymentRule = String(formData.get('repaymentRule') || '')
  const parsed = creditCardSchema.safeParse({
    paymentTypeId: formData.get('paymentTypeId'),
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
  const id = params.id
    ? (await updateSettingsCreditCard(user.id, params.id, parsed.data))?.id
    : await createSettingsCreditCard(user.id, parsed.data)
  if (!id)
    throw new Response('Not Found', { status: 404, headers })
  return redirect(`/settings/payment-accounts/${id}`, { headers })
}

export default function PaymentCardEditor() {
  const { paymentTypes, account } = useLoaderData<typeof loader>()
  const actionData = useActionData<typeof action>()
  const navigation = useNavigation()
  const isSubmitting = navigation.state === 'submitting'
  const errors = actionData?.errors
  return (
    <div className="pb-8">
      <SubPageHeader backTo={account ? `/settings/payment-accounts/${account.id}` : '/settings/payment-accounts'} title={account ? '编辑信用卡' : '添加信用卡'} />
      <div className="mb-5 rounded-xl bg-primary/8 p-4 text-sm text-muted-foreground">只保存尾号等资料。请勿填写完整卡号、CVV、安全码、密码或验证码。</div>
      <Form method="post">
        <FieldGroup>
          <Field data-invalid={Boolean(errors?.paymentTypeId) || undefined}>
            <FieldLabel>支付类型</FieldLabel>
            <Select name="paymentTypeId" defaultValue={account?.paymentTypeId || paymentTypes[0]?.id}>
              <SelectTrigger className="w-full"><SelectValue placeholder="请选择支付类型" /></SelectTrigger>
              <SelectContent><SelectGroup>{paymentTypes.map(type => <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>)}</SelectGroup></SelectContent>
            </Select>
            <FieldError>{errors?.paymentTypeId?.[0]}</FieldError>
          </Field>
          <Field data-invalid={Boolean(errors?.bankName) || undefined}>
            <FieldLabel>银行</FieldLabel>
            <Input name="bankName" defaultValue={account?.bankName || ''} placeholder="例如：招商银行" />
            <FieldError>{errors?.bankName?.[0]}</FieldError>
          </Field>
          <Field data-invalid={Boolean(errors?.name) || undefined}>
            <FieldLabel>名称</FieldLabel>
            <Input name="name" defaultValue={account?.name || ''} placeholder="例如：Visa 白金卡" />
            <FieldError>{errors?.name?.[0]}</FieldError>
          </Field>
          <Field data-invalid={Boolean(errors?.lastFour) || undefined}>
            <FieldLabel>卡片尾号</FieldLabel>
            <Input name="lastFour" inputMode="numeric" maxLength={4} defaultValue={account?.lastFour || ''} placeholder="可选，仅四位数字" />
            <FieldError>{errors?.lastFour?.[0]}</FieldError>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field data-invalid={Boolean(errors?.statementDay) || undefined}>
              <FieldLabel>出账日</FieldLabel>
              <Input name="statementDay" type="number" min="1" max="31" defaultValue={account?.statementDay || ''} />
              <FieldError>{errors?.statementDay?.[0]}</FieldError>
            </Field>
            <Field>
              <FieldLabel>还款规则</FieldLabel>
              <Select name="repaymentRule" defaultValue={account?.repaymentRule || 'fixed_day'}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="fixed_day">每月固定日</SelectItem>
                    <SelectItem value="days_after_statement">出账后若干天</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field data-invalid={Boolean(errors?.repaymentDay) || undefined}>
              <FieldLabel>固定还款日</FieldLabel>
              <Input name="repaymentDay" type="number" min="1" max="31" defaultValue={account?.repaymentDay || ''} placeholder="固定日规则填写" />
              <FieldError>{errors?.repaymentDay?.[0]}</FieldError>
            </Field>
            <Field data-invalid={Boolean(errors?.repaymentDaysAfterStatement) || undefined}>
              <FieldLabel>出账后天数</FieldLabel>
              <Input name="repaymentDaysAfterStatement" type="number" min="0" max="60" defaultValue={account?.repaymentDaysAfterStatement ?? ''} placeholder="按天规则填写" />
              <FieldError>{errors?.repaymentDaysAfterStatement?.[0]}</FieldError>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
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
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? <IconLoader2 className="animate-spin" data-icon="inline-start" /> : <IconCheck data-icon="inline-start" />}
            {account ? '保存修改' : '添加信用卡'}
          </Button>
        </FieldGroup>
      </Form>
    </div>
  )
}
