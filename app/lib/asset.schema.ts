import { z } from 'zod'

export const assetFormSchema = z.object({
  name: z.string().min(1, '名称必填').max(60, '名称最多 60 个字符'),
  emoji: z.string().min(1),
  categoryId: z.string().min(1, '请选择分类'),
  assetType: z.enum(['one_time', 'subscription']),
  paymentTypeId: z.string().optional(),
  paymentAccountId: z.string().optional(),
  tagIds: z.array(z.string()),
  notes: z.string().max(500, '备注最多 500 个字符').optional(),

  // 买断型
  purchasePrice: z.string().optional(),
  currentValue: z.string().optional().refine(value => !value || (Number.isFinite(Number(value)) && Number(value) >= 0), '当前估价不能小于 0'),
  purchaseDate: z.string().optional(),
  purchaseReceipt: z.string().trim().max(500, '购买凭证最多 500 个字符').optional(),

  // 订阅型
  subscriptionPrice: z.string().optional(),
  billingCycle: z.enum(['monthly', 'quarterly', 'yearly']).optional(),
  nextRenewalDate: z.string().optional(),
  subscriptionStartDate: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.assetType === 'one_time') {
    if (!data.purchasePrice || Number(data.purchasePrice) <= 0) {
      ctx.addIssue({ code: 'custom', message: '购入价必须大于 0', path: ['purchasePrice'] })
    }
    if (!data.purchaseDate) {
      ctx.addIssue({ code: 'custom', message: '请选择购入日期', path: ['purchaseDate'] })
    }
  }
  else {
    if (!data.subscriptionPrice || Number(data.subscriptionPrice) <= 0) {
      ctx.addIssue({ code: 'custom', message: '订阅价必须大于 0', path: ['subscriptionPrice'] })
    }
    if (!data.billingCycle) {
      ctx.addIssue({ code: 'custom', message: '请选择订阅周期', path: ['billingCycle'] })
    }
  }
})

export type AssetFormValues = z.infer<typeof assetFormSchema>

export const repairRecordSchema = z.object({
  repairDate: z.string().min(1, '请选择维修日期'),
  cost: z.string().default('0').refine(value => Number.isFinite(Number(value)) && Number(value) >= 0, '维修费用不能小于 0'),
  reason: z.string().trim().max(200, '维修原因最多 200 个字符').optional(),
  vendor: z.string().trim().max(100, '维修商最多 100 个字符').optional(),
  result: z.string().trim().max(200, '维修结果最多 200 个字符').optional(),
  isDone: z.boolean().default(true),
})

export const assetSaleSchema = z.object({
  tradeInPrice: z.string().refine(value => Number.isFinite(Number(value)) && Number(value) >= 0, '卖出价格不能小于 0'),
  tradedInAt: z.string().min(1, '请选择卖出日期'),
})

export const warrantySchema = z.object({
  startDate: z.string().min(1, '请选择保修开始日期'),
  endDate: z.string().min(1, '请选择保修结束日期'),
  notes: z.string().trim().max(500, '保修备注最多 500 个字符').optional(),
}).refine(data => data.endDate >= data.startDate, {
  message: '保修结束日期不能早于开始日期',
  path: ['endDate'],
})

export type RepairRecordFormValues = z.infer<typeof repairRecordSchema>

export const assetValueRecordSchema = z.object({
  value: z.string().refine(value => Number.isFinite(Number(value)) && Number(value) >= 0, '估值不能小于 0'),
  valuedOn: z.string().min(1, '请选择估值日期'),
  source: z.enum(['manual', 'market', 'professional', 'baseline']),
  notes: z.string().trim().max(500, '估值备注最多 500 个字符').optional(),
})
