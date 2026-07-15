# 任务 4：信用卡资料及订阅联动

## 目标

在现有支付账户基础上增加安全、轻量的信用卡资料管理，并利用已有 `assets.payment_account_id` 关联订阅，回答“这张卡承载哪些订阅、近期预计扣多少”的问题。

## 范围

- 扩展支付账户以区分普通账户和信用卡。
- 信用卡记录银行、名称、尾号、备注、出账日、还款规则、额度和币种。
- 信用卡详情展示关联订阅与未来 30 天预计扣费。
- 停用信用卡前提示仍关联的活动订阅；停用不删除历史数据。
- 订阅管理中心和详情展示关联信用卡的简要资料。
- 多币种金额按币种分组，不做汇率折算。

## 安全边界

系统禁止保存：

- 完整卡号。
- CVV/CVC。
- 取款或支付密码。
- 网银凭证、短信验证码、账单文件。
- 实时余额、已出账金额或还款交易。

仅允许四位数字尾号。界面明确提示“请勿填写完整卡号或安全码”。备注字段同样展示该提示。

## 数据模型

扩展 `payment_accounts`：

| 字段 | 类型 | 说明 |
|---|---|---|
| `account_kind` | text enum | `generic`、`credit_card`，默认 `generic` |
| `bank_name` | text | 信用卡必填 |
| `last_four` | text | 可空，仅四位数字 |
| `notes` | text | 可空 |
| `statement_day` | integer | 1–31，可空 |
| `repayment_rule` | text enum | `fixed_day`、`days_after_statement` |
| `repayment_day` | integer | 固定还款日 1–31 |
| `repayment_days_after_statement` | integer | 出账后 0–60 天 |
| `credit_limit` | numeric(12,2) | 非负，可空 |
| `currency_code` | text | ISO 4217 三位大写代码，默认 `CNY` |
| `is_active` | boolean | 默认 `true` |
| `created_at` | timestamptz | 默认当前时间 |
| `updated_at` | timestamptz | 默认当前时间 |

不声明数据库外键。已有支付账户迁移后为 `generic`、`CNY`、活动状态。

## 日期语义

- `statement_day`、`repayment_day` 的 29–31 日在短月份按该月最后一天展示。
- `days_after_statement` 从实际出账日期按自然日计算。
- 本任务只展示规则和计算的下一日期，不创建账单或还款记录。

## 页面与交互

- 支付账户设置页保留普通账户快速新增，并增加“添加信用卡”入口。
- 信用卡使用独立新增/编辑页，避免把大量字段塞入现有行内表单。
- 信用卡详情展示：银行与名称、尾号、账单/还款规则、额度与币种、关联订阅。
- 关联订阅显示下一续费日与预计价格；未来 30 天合计按币种分组。
- 停用操作使用确认对话框，并列出仍在使用此卡的活动订阅数量；停用后仍可查看历史关联，新增/编辑订阅时不再作为可选项。
- 卡片视觉使用现有暖色表面和语义 token，不仿制真实银行卡，也不展示敏感信息占位。

## 查询与金额规则

- 查询支付账户始终过滤 `deleted_at IS NULL`；资产表单只列出 `is_active = true` 的账户，编辑已有停用账户关联时仍显示当前值以便迁移。
- 信用卡详情通过当前用户的资产查询关联订阅，不信任客户端提供的用户或账户归属。
- 未来 30 天预计扣费按每项订阅自身的 `currency_code` 聚合，使用 `currency.js`。
- 一个支付账户只有一个币种；普通账户默认为 `CNY`。
- 不计算额度占用率，因为系统没有账单余额。

## 路由规划

- `/settings/payment-accounts`：账户列表与入口。
- `/settings/payment-accounts/new-card`：新增信用卡。
- `/settings/payment-accounts/:id`：信用卡详情。
- `/settings/payment-accounts/:id/edit`：编辑信用卡。

## 预计修改文件

- `app/db/schema.ts`
- `app/db/queries/settings.ts`
- 新增 `app/lib/payment-account.schema.ts`
- `app/routes.ts`
- `app/routes/settings/payment-accounts.tsx`
- 新增信用卡新增、详情、编辑路由
- `app/components/asset-form.tsx`
- `app/routes/subscriptions._index.tsx`
- `app/routes/subscriptions.$id.tsx`
- `drizzle/*.sql`
- `docs/db-init.sql`
- `docs/REQUIREMENT.md`
- `docs/API.md`
- `docs/ARCHITECTURE.md`
- `app/lib/backup.server.ts`
- 必要的 `*.test.ts`

## 测试与验收

- schema 测试覆盖尾号、币种、额度、日期范围和还款规则的互斥必填关系。
- 日期测试覆盖 2 月与 30 天月份中的 29–31 日回退。
- 查询测试覆盖停用账户不出现在新关联选项、现有详情仍可解析关联名称。
- 聚合测试覆盖同币种精确相加和多币种分组，禁止跨币种求和。
- 停用信用卡不会删除账户或订阅，关联数量提示正确。
- 备份导出包含非敏感信用卡资料，且不增加任何禁止字段。
- 手动验证桌面 1280px 与移动 375px：表单、详情、关联订阅和确认对话框可用。
- `pnpm typecheck`、`pnpm lint` 与相关测试全部通过。

## 完成定义

- 信用卡资料、日期规则、订阅关联和多币种展示形成闭环。
- 安全边界在数据模型、校验和 UI 文案三处一致。
- 删除本规划文档，并在独立代码提交中包含删除记录。

## Issue 状态

待创建。当前 GitHub CLI 登录令牌失效，恢复认证后补建远端 Issue。
