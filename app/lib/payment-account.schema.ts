import { addDays, format, getDaysInMonth } from 'date-fns'
import { z } from 'zod'

// 所有自由文本字段都不能成为绕过专用字段限制的敏感信息存储入口。
const sensitiveCardTextPattern = /\d(?:[\s.-]*\d){12,18}|cvv|cvc|密码|验证码|安全码|动态码/i

function doesNotContainSensitiveCardData(value: string): boolean {
  return !sensitiveCardTextPattern.test(value)
}

export const genericPaymentAccountSchema = z.object({
  paymentTypeId: z.string().min(1, '请选择支付类型'),
  name: z.string().trim().min(1, '请输入账户名称').max(60, '名称最多 60 个字符'),
})

export const creditCardSchema = z.object({
  paymentTypeId: z.string().min(1, '请选择支付类型'),
  name: z.string().trim().min(1, '请输入信用卡名称').max(60, '名称最多 60 个字符').refine(doesNotContainSensitiveCardData, '名称不能包含完整卡号、安全码、密码或验证码'),
  bankName: z.string().trim().min(1, '请输入银行').max(60, '银行最多 60 个字符').refine(doesNotContainSensitiveCardData, '银行不能包含完整卡号、安全码、密码或验证码'),
  lastFour: z.string().trim().refine(value => !value || /^\d{4}$/.test(value), '尾号只能是四位数字'),
  notes: z.string().trim().max(500, '备注最多 500 个字符').refine(value => !value || doesNotContainSensitiveCardData(value), '备注不能包含卡号、安全码、密码或验证码').optional(),
  statementDay: z.coerce.number().int().min(1, '出账日范围为 1–31').max(31, '出账日范围为 1–31'),
  repaymentRule: z.enum(['fixed_day', 'days_after_statement']),
  repaymentDay: z.coerce.number().int().min(1).max(31).optional(),
  repaymentDaysAfterStatement: z.coerce.number().int().min(0).max(60).optional(),
  creditLimit: z.string().refine(value => !value || (Number.isFinite(Number(value)) && Number(value) >= 0), '额度不能小于 0'),
  currencyCode: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, '币种必须是三位大写代码'),
}).superRefine((value, context) => {
  if (value.repaymentRule === 'fixed_day' && !value.repaymentDay)
    context.addIssue({ code: 'custom', path: ['repaymentDay'], message: '请输入固定还款日' })
  if (value.repaymentRule === 'days_after_statement' && value.repaymentDaysAfterStatement === undefined)
    context.addIssue({ code: 'custom', path: ['repaymentDaysAfterStatement'], message: '请输入出账后还款天数' })
})

export type CreditCardInput = z.infer<typeof creditCardSchema>

export function clampBillingDay(year: number, monthIndex: number, day: number): Date {
  const base = new Date(year, monthIndex, 1)
  return new Date(year, monthIndex, Math.min(day, getDaysInMonth(base)))
}

function nextDayOccurrence(today: Date, day: number): Date {
  let candidate = clampBillingDay(today.getFullYear(), today.getMonth(), day)
  if (candidate < new Date(today.getFullYear(), today.getMonth(), today.getDate()))
    candidate = clampBillingDay(today.getFullYear(), today.getMonth() + 1, day)
  return candidate
}

export function getNextCardDates(input: {
  today: Date
  statementDay: number
  repaymentRule: 'fixed_day' | 'days_after_statement'
  repaymentDay?: number | null
  repaymentDaysAfterStatement?: number | null
}) {
  const statementDate = nextDayOccurrence(input.today, input.statementDay)
  const repaymentDate = input.repaymentRule === 'fixed_day'
    ? nextDayOccurrence(input.today, input.repaymentDay || 1)
    : addDays(statementDate, input.repaymentDaysAfterStatement || 0)
  return { statementDate: format(statementDate, 'yyyy-MM-dd'), repaymentDate: format(repaymentDate, 'yyyy-MM-dd') }
}
