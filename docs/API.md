# Holdly — API 接口文档

> 所有路由使用 React Router v7 的 loader/action 模式。loader 负责数据获取，action 负责数据变更。
> 认证路由统一在 `app-shell.tsx` loader 中检查登录状态，未登录重定向 `/login?next=`。

---

## Auth 模块

### `/login`

| 类型 | 说明 |
|---|---|
| Loader | 已登录 → redirect `/dashboard`（或 `?next=` 参数）|
| Action `oauth` | 接收 `provider`（github/google），返回 OAuth redirect URL |
| Action (默认) | 邮箱密码登录，Zod 验证后调用 `signInWithPassword`，成功 → redirect |

### `/register`

| 类型 | 说明 |
|---|---|
| Loader | 已登录 → redirect `/dashboard` |
| Action | 验证 `{ displayName, email, password, confirmPassword }`，调用 `signUp`，邮件确认回跳 `/auth/callback?registered=1`。无 session 时通过响应 cookie 保存 PKCE verifier 并返回 `{ success: true }`，有 session 时 redirect `/dashboard?registered=1` |

### `/forgot-password`

| 类型 | 说明 |
|---|---|
| Loader | 无 |
| Action | 验证 email，调用 `resetPasswordForEmail`，通过响应 cookie 保存 PKCE verifier，返回 `{ success: true }` 或 `{ error }` |

### `/auth/callback`

| 类型 | 说明 |
|---|---|
| Loader | 交换 OAuth / 邮箱确认 code 为 session，成功 → redirect `/dashboard`（或 `?next=`）；带 `registered=1` 时 redirect `/dashboard?registered=1`，失败 → `/login?error=` |

### `/account/update-password`

| 类型 | 说明 |
|---|---|
| Loader | 认证检查；`?mode=change` 表示账户内改密，否则为邮件恢复模式 |
| Action | 账户内改密先调用 `signInWithPassword` 验证旧密码，再调用 `updateUser`；邮件恢复模式直接更新密码；成功 redirect `/settings/account?passwordChanged=1` |

---

## Dashboard 模块

### `GET /dashboard`

| 类型 | 说明 |
|---|---|
| Loader | 返回 `{ kpi, statsByType, expiring }` |
| Action | 无 |

**loader 返回数据**：

```typescript
{
  kpi: {
    dailyCostTotal: number,        // 所有资产当日日均成本之和
    subscriptionMonthlyTotal: number, // 活跃订阅月度费用之和
    subscriptionYearlyTotal: number,  // 活跃订阅年度费用之和
    activeAssetCount: number,      // 活跃资产数量
    activeAssetPurchaseTotal: number  // 活跃资产购入价之和
  },
  statsByType: {
    one_time: {
      categorySpending: [{ categoryName, emoji, amount, percentage }],
      monthlyTrend: [{ month, amount }]
    },
    subscription: {
      categorySpending: [{ categoryName, emoji, amount, percentage }],
      monthlyTrend: [{ month, amount }]
    }
  },
  expiring: [{
    id, emoji, name, detail   // detail 为到期描述文本（如"订阅 · 2026-06-15 到期（18 天后）"）
  }]

> **到期日计算**：使用`nextRenewalDate`字段优先，否则从`subscriptionStartDate`/`purchaseDate`推算。到期日 = `nextRenewalDate - 1天`。
}
```

---

## Assets 模块

### `GET /assets`

| 类型 | 说明 |
|---|---|
| Loader | 返回 `{ assets, categories, tags, assetTagMap }` |
| Action | 无 |

**loader 返回数据**：

```typescript
{
  assets: [{
    id, name, emoji, assetType, categoryId,
    purchasePrice, currentValue, purchaseDate,
    subscriptionPrice, billingCycle, nextRenewalDate, subscriptionStatus,
    dailyCost,       // 计算字段
    holdingDays,     // 计算字段
    deletedAt, tradedInAt,
    createdAt, updatedAt
  }],
  categories: [{ id, name, emoji, isPreset, sortOrder }],
  tags: [{ id, name, color }],
  assetTagMap: Record<assetId, tagId[]>
}
```

### `GET /assets/:id`

| 类型 | 说明 |
|---|---|
| Loader | 订阅型 → redirect `/subscriptions/:id`。返回完整资产详情 |
| Action | 支持 6 个 intent |

**loader 返回数据**：

```typescript
{
  asset,                  // 完整资产对象
  tagIds: string[],
  warranty: { id, assetId, startDate, endDate, notes } | null,
  repairRecords: [{ id, repairDate, cost, reason, vendor, result, isDone }],
  dailyCost: number,
  holdingDays: number,
  allCategories, allTags, paymentTypes, paymentAccounts,
  tradedFromAsset: { id, name, emoji } | null,   // 换新来源
  tradeToAsset: { id, name, emoji } | null        // 换新目标
}
```

**action intents**：

| Intent | 参数 | 说明 |
|---|---|---|
| `delete` | — | 软删除资产，redirect `/assets` |
| `sell` | `tradeInPrice`, `tradedInAt` | 标记资产为已卖出（`tradedInAt` + `tradeInPrice`）|
| `add-repair` | `repairDate`, `cost`, `reason`, `vendor`, `result`, `isDone` | 创建维修记录 |
| `update-repair` | `repairId` + 同上字段 | 更新当前资产的维修记录；不属于该资产时返回 404 |
| `delete-repair` | `repairId` | 删除当前资产的维修记录（硬删除）；不属于该资产时返回 404 |
| `upsert-warranty` | `startDate`, `endDate`, `notes` | 创建或更新保修信息 |

### `POST /assets/new`

| 类型 | 说明 |
|---|---|
| Loader | 返回 `{ categories, tags, paymentTypes, paymentAccounts }` |
| Action | 验证 `assetFormSchema`，调用 `createAsset`，成功 → redirect 详情页 |

### `POST /assets/:id/edit`

| 类型 | 说明 |
|---|---|
| Loader | 返回现有资产数据 + 表单下拉数据。模式不匹配时 redirect 至正确编辑路径 |
| Action | 验证 `assetFormSchema`，调用 `updateAsset`，成功 → redirect 详情页 |

### `POST /assets/:id/trade-in`

| 类型 | 说明 |
|---|---|
| Loader | 返回旧资产 + 表单下拉数据 |
| Action | 校验父资产、日期与金额；在事务中创建新资产、关联新旧、添加换新标签并标记旧资产；成功后 redirect 新资产详情 |

**action 参数**：`tradeInPrice`（回收价）、`tradeInDate`（换新日期）、新资产表单字段

---

## Subscriptions 模块

### `GET /subscriptions/:id`

| 类型 | 说明 |
|---|---|
| Loader | 非订阅型 → redirect `/assets/:id`。返回订阅详情 + 计算指标 |
| Action | 支持 3 个 intent |

**loader 返回数据**：

```typescript
{
  asset, tagIds, allCategories, allTags,
  paymentTypes, paymentAccounts,
  holdingDays: number,
  dailyCost: number
}
```

**action intents**：

| Intent | 参数 | 说明 |
|---|---|---|
| `cancel` | `stoppedAt` | 取消订阅，设置 `subscriptionStoppedAt` + `subscriptionStatus: 'cancelled'` |
| `resume` | — | 恢复订阅，清除 `subscriptionStoppedAt` + `subscriptionStatus: 'active'` |
| `delete` | — | 软删除，redirect `/assets` |

### `POST /subscriptions/new`

| 类型 | 说明 |
|---|---|
| Loader | 返回表单下拉数据 |
| Action | 验证 `assetFormSchema`，调用 `createAsset`（`assetType: 'subscription'`），成功 → redirect 详情页 |

### `POST /subscriptions/:id/edit`

| 类型 | 说明 |
|---|---|
| Loader | 返回现有数据 + 下拉数据。非订阅型 → redirect `/assets/:id/edit` |
| Action | 验证 + `updateAsset`，成功 → redirect 详情页 |

---

## Plans 模块

### `GET /plans`

| 类型 | 说明 |
|---|---|
| Loader | 返回 `{ plans }` — 用户参与的所有计划摘要 |
| Action | 无 |

**loader 返回数据**：

```typescript
{
  plans: [{
    id, name, emoji, planMode, permission,
    members: [{ userId, displayName, avatarEmoji, role, note }],
    latestNetIncome: number,
    latestMonth: string
  }]
}
```

### `GET /plans/:id`

| 类型 | 说明 |
|---|---|
| Loader | 返回完整计划详情 |
| Action | 支持 3 个 intent |

**loader 返回数据**：

```typescript
{
  id, name, emoji, planMode, startingValue, permission, ownerId,
  members, defaultItems,
  records: [{ id, year, month, recordedTotalValue, totalIncome, totalExpense, netIncome, totalValue }],
  trend: [{ month, label, amount }],
  canManage: boolean,
  canEditAllItems: boolean,
  inviteLink: string | null,
  inviteExpiresAt: string | null
}
```

**action intents**：

| Intent | 参数 | 说明 |
|---|---|---|
| `delete-plan` | — | 软删除计划，redirect `/plans` |
| `regenerate-invite` | — | 撤销旧链接 + 创建新链接（30 天有效）|
| `revoke-invite` | — | 撤销所有活跃邀请链接 |

### `POST /plans/new`

| 类型 | 说明 |
|---|---|
| Loader | 返回默认编辑器数据（`mode: 'create'`）|
| Action `save-plan` | 验证 `planSaveSchema`，调用 `savePlan`，成功 → redirect `/plans/:planId` |
| Action `regenerate-invite` / `revoke-invite` | 报错（需先保存计划）|

### `POST /plans/:id/edit`

| 类型 | 说明 |
|---|---|
| Loader | 返回现有计划数据（`mode: 'edit'`）|
| Action `save-plan` | 验证 + 更新计划，成功 → redirect |
| Action `regenerate-invite` | 重新生成邀请链接 |
| Action `revoke-invite` | 撤销邀请链接 |
| Action `import-history` | 解析 CSV 文件，调用 `importPlanSnapshotHistory` |

### `GET /plans/:id/records/:month`

| 类型 | 说明 |
|---|---|
| Loader | 返回月度记录详情（items + memberNotes + members + currentUserId），客户端按成员派生分组和小计 |
| Action `delete-record` | 需 `confirmMonth` 匹配，软删除记录，redirect `/plans/:id` |

### `POST /plans/:id/records/:month/edit`

| 类型 | 说明 |
|---|---|
| Loader | 返回现有记录或默认项（支持 `?blank=1` 创建空记录）|
| Action | 解析 JSON payload，验证 `planRecordPatchSchema`，调用 `savePlanRecordPatch` |

**savePlanRecordPatch 数据结构**：

```typescript
{
  planId, year, month,
  expectedUpdatedAt: string,  // 乐观锁
  addedItems: [{ memberId, itemType, name, amount }],
  updatedItems: [{ id, name, amount }],
  deletedItems: string[],     // item IDs
  memberNotes: [{ memberId, note }]
}
```

### `GET /plans/invite/:token`

| 类型 | 说明 |
|---|---|
| Loader | 验证 token，接受邀请。成功 → redirect `/plans/:planId?invite=joined` |
| Action | 无 |

**redirect 规则**：
- 未登录 → `/login`（不保留 token）
- token 无效 → `/plans?invite=invalid`
- 已加入 → `/plans/:planId?invite=already`
- 新加入 → `/plans/:planId?invite=joined`

## Settings 模块

### `GET /settings`

| 类型 | 说明 |
|---|---|
| Loader | 返回 `{ profile: { displayName, email, avatarEmoji }, counts }` |
| Action `update_profile` | 更新 `displayName` + `avatarEmoji` |

### `GET/POST /settings/account`

| 类型 | 说明 |
|---|---|
| Loader | 返回 `{ email, hasPassword }` |
| Action `send_password_email` | OAuth-only 账户发送密码设置邮件，并通过响应 cookie 保存 PKCE verifier |
| Action `logout` | `supabase.auth.signOut()`，redirect `/login` |

### `GET /settings/reminders`

| 类型 | 说明 |
|---|---|
| Loader | 返回 `{ reminderEnabled, reminderSubscriptionDays, reminderWarrantyDays }` |
| Action `update_reminder` | 更新 `reminderEnabled` + `reminderSubscriptionDays` + `reminderWarrantyDays` |
| Action `manual_reminder_check` | 触发 `POST /api/cron/send-reminders`，返回 `{ sent }` |

### `GET/POST /settings/categories`

| 类型 | 说明 |
|---|---|
| Loader | 返回 `{ categories }` |
| Action `create` | 参数 `name` + `emoji` |
| Action `update` | 参数 `id` + `name` |
| Action `delete` | 参数 `id`，软删除 + 关联资产 `category_id` 设 null |

### `GET/POST /settings/tags`

| 类型 | 说明 |
|---|---|
| Loader | 返回 `{ tags }`（含 `assetCount`）|
| Action `create` | 参数 `name` + `color` |
| Action `update` | 参数 `id` + `name` + `color` |
| Action `delete` | 参数 `id`，软删除 + 清除 `asset_tags` 关联 |

### `GET/POST /settings/payment-types`

| 类型 | 说明 |
|---|---|
| Loader | 返回 `{ paymentTypes }` |
| Action `create` | 参数 `name` |
| Action `update` | 参数 `id` + `name` |
| Action `delete` | 参数 `id`，软删除 + 级联软删除下级 `payment_accounts` |

### `GET/POST /settings/payment-accounts`

| 类型 | 说明 |
|---|---|
| Loader | 返回 `{ paymentTypes, paymentAccounts }` |
| Action `create` | 参数 `name` + `paymentTypeId` |
| Action `update` | 参数 `id` + `name` |
| Action `delete` | 参数 `id`，软删除 |

### `GET /settings/data`

| 类型 | 说明 |
|---|---|
| Loader | 返回 `{ backupEnabled, backupDayOfMonth, backupFrequency }` |
| Action `update_backup` | 更新 `backupEnabled` + `backupDayOfMonth` + `backupFrequency` |

### `GET /settings/export-xlsx`

| 类型 | 说明 |
|---|---|
| Loader | 返回 XLSX 文件二进制流（`Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`）|
| Action | 无 |

---

## Cron 模块

### `POST /api/cron/send-backup`

| 类型 | 说明 |
|---|---|
| Action | 每日触发，匹配用户 `backupDayOfMonth` → 生成 HTML 邮件，通过 Resend 发送 |

**鉴权**：`x-cron-secret`（GitHub Actions）或 `x-cron-trigger`（Vercel Cron）

**处理逻辑**：
1. 查询所有 `backupEnabled = true` 的用户
2. 过滤 `backupDayOfMonth === today.getDate()` 且 `backupFrequency === 'monthly'` 的用户
3. 对每个用户调用 `generateBackupHtml(userId)` 生成资产 + 计划数据的 HTML 表格
4. 通过 Resend API 发送到 `profile.email`

**响应**：返回 `{ ok, sent, checked, skipped, failed }`。`skipped` 包含 `noEmail`、`differentDay`、`unsupportedFrequency`，用于区分 cron 已运行但没有邮件发送的原因；Resend 发送失败时计入 `failed`，不计入 `sent`。

---

## 数据查询层

所有查询实现在 `app/db/queries/` 目录：

| 文件 | 函数数量 | 职责 |
|---|---|---|
| `assets.ts` | 26 | 资产 CRUD + 保修/维修/换新/标签/分类 |
| `dashboard.ts` | 1 | Dashboard 聚合（KPI + 分类花费 + 趋图 + 到期）|
| `plans.ts` | 13 | 计划 CRUD + 成员/邀请/记录/导入 |
| `settings.ts` | 18 | 个人资料/分类/标签/支付方式/备份配置 CRUD |

---

*文档结束*
