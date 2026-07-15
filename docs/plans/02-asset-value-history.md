# 任务 2：资产价值历史

## 目标

在买断型资产上建立可追溯的估值记录，使“当前估值”由历史记录闭环维护，并在详情页展示价值变化趋势。

## 范围

- 新增资产价值记录表、查询和软删除能力。
- 手动新增估值记录时同步更新 `assets.current_value`。
- 删除当前最新记录后回退到上一条有效记录；没有记录时清空当前估值。
- 对已有非空 `assets.current_value` 生成一条基线记录，避免历史能力上线后丢失来源。
- 资产详情显示估值摘要、折损/增值金额与趋势图；没有当前估值时整个区域不显示。
- 支持记录估值日期、金额、来源和可选备注。

## 不做

- 不接入二手市场、证券行情或第三方估值 API。
- 不自动换算币种；买断型资产沿用当前产品金额口径。
- 不允许修改历史记录，录错时软删除后重新添加，以保持审计语义简单。

## 数据模型

新增 `asset_value_records`：

| 字段 | 类型 | 约束与说明 |
|---|---|---|
| `id` | uuid | 主键，默认随机生成 |
| `user_id` | uuid | 必填，用于归属过滤，不声明外键 |
| `asset_id` | uuid | 必填，不声明外键 |
| `value` | numeric(12,2) | 必填，非负校验由应用层完成 |
| `valued_on` | date | 必填，估值日期 |
| `source` | text enum | `manual`、`market`、`professional`、`baseline` |
| `notes` | text | 可空 |
| `deleted_at` | timestamptz | 软删除时间 |
| `created_at` | timestamptz | 默认当前时间 |
| `updated_at` | timestamptz | 默认当前时间 |

查询始终同时过滤 `user_id` 与 `deleted_at IS NULL`。排序使用 `valued_on DESC, created_at DESC`，确保同日记录有稳定的“最新”定义。

## 迁移方案

1. Drizzle schema 与 `docs/db-init.sql` 同步新增表和必要索引。
2. 生成 Drizzle SQL migration。
3. migration 使用 `INSERT ... SELECT` 为每个 `current_value IS NOT NULL` 且未软删除的买断型资产补一条 `baseline` 记录：
   - `value = current_value`
   - `valued_on = COALESCE(purchase_date, created_at::date)`
   - `notes = '历史当前估值迁移基线'`
4. 迁移可重复执行时不得重复生成基线，使用 `NOT EXISTS` 防护。

## 写入一致性

- 新增记录与更新 `assets.current_value` 在同一数据库事务中完成。
- 软删除记录与回算当前估值在同一事务中完成。
- 写入前先验证资产归属当前用户且类型为 `one_time`。
- 软删除只更新目标记录的 `deleted_at`；若目标不是最新记录，不改当前估值。
- 当前值回算通过查询剩余记录的首条完成，不使用客户端传值。

## 页面与交互

- 资产详情估值区包含：当前估值、相对购入价变化、最近估值日期、折线趋势。
- 趋势少于两条记录时显示数值与历史列表，不绘制误导性的单点趋势。
- 新增记录使用聚焦对话框；包含日期、金额、来源、备注，提交按钮有独立 loading。
- 历史列表展示日期、金额、来源、备注与删除操作；删除使用确认对话框。
- 金额使用等宽数字，图表使用现有 `Chart` 组件和语义颜色。
- 移动端图表保持横向不滚动，轴标签精简，历史列表改为紧凑纵向布局。

## 预计修改文件

- `app/db/schema.ts`
- `app/db/queries/assets.ts` 或新增聚焦的估值查询文件
- `app/routes/assets.$id.tsx`
- `app/components/ui/chart.tsx`（仅在现有 API 不足时调整）
- `drizzle/*.sql`
- `docs/db-init.sql`
- `docs/REQUIREMENT.md`
- `docs/API.md`
- `docs/ARCHITECTURE.md`
- `app/lib/backup.server.ts`
- 必要的 `*.test.ts`

## 测试与验收

- schema/纯函数测试覆盖来源枚举、非负金额、日期与备注校验。
- 查询层测试或可测试事务逻辑覆盖新增记录同步当前值。
- 覆盖删除最新记录回退、删除非最新记录不变、删除最后一条清空当前值。
- 覆盖迁移基线的去重条件。
- 备份导出包含估值历史，且不包含软删除记录。
- 手动验证桌面 1280px 与移动 375px 的趋势图、表单、空状态和删除流程。
- `pnpm typecheck`、`pnpm lint` 与相关测试全部通过。

## 完成定义

- 数据迁移、查询、UI、导出和文档形成闭环。
- 删除本规划文档，并在独立代码提交中包含删除记录。

## Issue 状态

待创建。当前 GitHub CLI 登录令牌失效，恢复认证后补建远端 Issue。
