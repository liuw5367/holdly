# Holdly — 开发架构文档

---

## 技术栈

| 层级 | 方案 | 决策理由 |
|---|---|---|
| 框架 | React Router v7 | 配置式路由；loader/action 提供服务端数据接口，页面以客户端交互为主 |
| 构建 | Vite 8.0 | RRv7 默认，HMR 极快 |
| UI | shadcn/ui (base-nova) + Tailwind v4 | 组件可控、样式一致、无运行时开销 |
| ORM | Drizzle ORM | 类型安全，SQL-like API，迁移工具完善 |
| 数据库 | PostgreSQL (Supabase) | 免费额度充足，Auth 内置 |
| 认证 | Supabase Auth | GitHub/Google OAuth + 邮箱密码，开箱即用 |
| 表单 | react-hook-form + Zod | 客户端验证 + 服务端 schema 复用 |
| 图表 | Recharts | React 生态，配合 shadcn Charts |
| 部署 | Vercel + GitHub Actions | Vercel 承载应用，GitHub Actions 定时调用提醒与备份端点 |

## 路由结构

```
routes.ts
├── /.well-known/appspecific/com.chrome.devtools.json → well-known.ts
├── index                          → _index.tsx          （重定向 /dashboard）
│
├── login                          → login.tsx
├── register                       → register.tsx
├── forgot-password                → forgot-password.tsx
├── auth/callback                  → auth.callback.tsx
│
└── app-shell.tsx（认证守卫布局）
    ├── account/update-password    → account.update-password.tsx
    ├── dashboard                  → dashboard.tsx
    ├── assets                     → assets._index.tsx
    ├── assets/new                 → assets.new.tsx
    ├── assets/:id                 → assets.$id.tsx
    ├── assets/:id/edit            → assets.$id.edit.tsx
    ├── assets/:id/trade-in        → assets.$id.trade-in.tsx
    ├── subscriptions/new          → subscriptions.new.tsx
    ├── subscriptions/:id          → subscriptions.$id.tsx
    ├── subscriptions/:id/edit     → subscriptions.$id.edit.tsx
    ├── plans                      → plans._index.tsx
    ├── plans/new                  → plans.new.tsx
    ├── plans/invite/:token        → plans.invite.$token.tsx
    ├── plans/:id                  → plans.$id.tsx
    ├── plans/:id/edit             → plans.$id.edit.tsx
    ├── plans/:id/records/:month           → plans.$id.records.$month.tsx
    ├── plans/:id/records/:month/edit      → plans.$id.records.$month.edit.tsx
    ├── settings                   → settings.tsx
    ├── settings/account           → settings.account.tsx
    ├── settings/categories        → settings/categories.tsx
    ├── settings/tags              → settings/tags.tsx
    ├── settings/payment-types     → settings/payment-types.tsx
    ├── settings/payment-accounts  → settings/payment-accounts.tsx
    ├── settings/reminders         → settings/reminders.tsx
    └── settings/data              → settings/data.tsx
├── settings/export-xlsx           → settings.export-xlsx.tsx（认证导出，无布局）
├── api/cron/send-reminders       → api.cron.send-reminders.tsx（无布局）
└── api/cron/send-backup          → api.cron.send-backup.tsx（无布局）
```

## 目录结构

```
app/
├── components/
│   ├── ui/                  # shadcn/ui 基础组件
│   ├── layout/
│   │   └── app-shell.tsx    # 认证布局壳（侧边栏 + 底部 Tab）
│   ├── asset-form.tsx       # 资产表单（买断/订阅共用）
│   ├── page-header.tsx      # 页面标题栏（返回 + 标题）
│   ├── plan-invite-panel.tsx # 计划邀请链接管理面板
│   └── public-avatar.tsx    # Emoji 头像展示
├── db/
│   ├── schema.ts            # Drizzle schema（18 张表）
│   └── queries/
│       ├── assets.ts        # 资产 CRUD + 保修/维修/换新
│       ├── dashboard.ts     # Dashboard 聚合查询
│       ├── plans.ts         # 计划查询层统一导出
│       ├── plans.read.ts    # 计划、成员与月记录读取
│       ├── plans.write.ts   # 计划与月记录写入
│       ├── plans.invite.ts  # 邀请链接
│       ├── plans.import.ts  # CSV 历史导入
│       ├── plans.types.ts   # 计划类型与纯函数
│       └── settings.ts      # 设置 CRUD
├── lib/
│   ├── cost.ts              # 持有成本计算引擎
│   ├── asset-meta.ts        # 资产元数据工具（路径、格式化）
│   ├── plan-avatar.ts       # 计划成员头像颜色系统
│   ├── supabase.server.ts   # Supabase 服务端 client
│   ├── redirect.ts          # safeRedirect 安全校验
│   ├── utils.ts             # cn() Tailwind class 合并
│   ├── asset.schema.ts      # 资产/维修表单 Zod schema
│   ├── auth.schema.ts       # 认证表单 Zod schema
│   ├── plan.schema.ts       # 计划表单 Zod schema
│   ├── backup.server.ts     # 数据导出 XLSX + 备份邮件 HTML 生成
│   ├── email-template.server.ts # Resend 邮件品牌外壳与提醒模板
│   └── email.server.ts      # Resend 邮件发送
├── routes.ts                # 路由配置（React Router v7 config-based）
├── routes/                  # 路由文件（loader/action/component）
├── root.tsx                 # 根布局（NProgress、PWA SW、主题、错误边界）
├── app.css                  # 全局样式 + 色彩 token + 字体
└── +types/                  # React Router 类型生成
```

## 数据流模式

### React Router v7 Loader/Action

应用使用 RRv7 的配置式路由，每个路由文件导出三个部分：

```
route.tsx
├── loader(request)    → 服务端数据获取，返回 JSON
├── action(request)    → 服务端数据变更，处理表单提交
└── default()          → 客户端组件，通过 useLoaderData() 读取数据
```

**数据获取**：loader 在服务端运行，查询数据库后通过 `useLoaderData()` 传递给组件。无客户端 fetch，无 TanStack Query。

**数据变更**：表单提交到 action，action 处理后通常 `redirect()` 到目标页面。使用 `useFetcher()` 处理非跳转型变更（如行内编辑、设置保存）。

**客户端状态**：使用 React 原生 `useState` / `useMemo`，无全局状态管理库。

### 典型数据流（以新建资产为例）

```
用户填写表单
  → react-hook-form 验证（Zod schema）
  → 表单 POST 到 action
  → action 服务端 Zod 验证
  → createAsset() 写入数据库
  → redirect('/assets/:id')
  → 新页面 loader 获取数据
  → 组件渲染
```

## 认证流程

```
请求进入
  → app-shell.tsx loader
  → createSupabaseServerClient(request)
  → supabase.auth.getUser()
  → 未登录 → redirect('/login?next=' + pathname)
  → 已登录 → 返回 user 数据 + 渲染子路由
```

Supabase client 每请求创建（`app/lib/supabase.server.ts`），通过 cookies 管理 session。不使用全局 Supabase 实例。

### OAuth 流程

```
点击 OAuth 按钮
  → action 调用 supabase.auth.signInWithOAuth()
  → 返回 redirect URL
  → 浏览器跳转到 OAuth 提供商
  → 回调到 /auth/callback
  → callback loader 交换 code 为 session
  → redirect('/dashboard')
```

注册邮件确认同样回调 `/auth/callback`。注册 action 使用 `emailRedirectTo=/auth/callback?registered=1`，callback 成功换取 session 后跳转 `/dashboard?registered=1`，Dashboard 显示一次注册成功提示并清理 query。

OAuth 和注册邮件确认使用 PKCE code 回调。密码恢复及 OAuth-only 账户设置密码使用恢复邮件中的 `token_hash`，由 `/auth/callback` 调用 `verifyOtp(type: recovery)` 建立 session 后进入 `/account/update-password`；因此邮件可以在不同浏览器或设备中打开，不依赖发信端保存的 PKCE verifier cookie。账户内修改密码则先用旧密码重新认证，再更新密码。

## 数据库约定

1. **无外键约束**：表中存储关联字段（`user_id`、`asset_id` 等）但不声明 `REFERENCES`。关联查询由 Drizzle ORM 在应用层处理。理由：简化迁移、避免级联删除的隐式行为。

2. **软删除**：带 `deleted_at TIMESTAMPTZ` 的用户业务实体必须过滤 `deleted_at IS NULL`，禁止硬删除。`repair_records` 允许硬删除；`asset_tags` 等关联表在移除关系时直接删除关联行。保修、续费和提醒任务没有面向用户的删除入口。

3. **金额计算**：使用 `currency.js` 做精确计算，禁止裸浮点数运算。核心逻辑见 `app/lib/cost.ts`。

4. **时间戳**：所有表有 `created_at`，多数有 `updated_at`。使用 `TIMESTAMPTZ` 类型。

5. **主键**：统一使用 UUID（`gen_random_uuid()`），除 `profiles`（关联 Supabase Auth UUID）和 `asset_tags`（复合主键）。

6. **注册初始化**：数据库触发器 `handle_new_user()` 在 `auth.users` 插入后自动创建 profile、预置分类、预置支付类型。

## 数据模型

共 18 张表，定义在 `app/db/schema.ts`。

> **注意**：以下字段表省略了部分 NOT NULL 约束和默认值以保持简洁，完整定义以 `schema.ts` 为准。多数实体表有 `created_at`，需要编辑追踪的实体通常还有 `updated_at`；`asset_tags` 仅保存复合主键。

### 用户与配置

**`profiles`** — 用户资料（关联 Supabase Auth UUID）

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | UUID (PK) | 关联 `auth.users.id` |
| `display_name` | TEXT | 昵称 |
| `email` | TEXT | 邮箱 |
| `avatar_emoji` | TEXT | 头像 emoji，默认 😊 |
| `reminder_enabled` | BOOLEAN | 提醒总开关，默认 true |
| `reminder_subscription_days` | INTEGER | 订阅提醒提前天数，默认 7 |
| `reminder_warranty_days` | INTEGER | 保修提醒提前天数，默认 14 |
| `backup_enabled` | BOOLEAN | 定时备份开关，默认 false |
| `backup_day_of_month` | INTEGER | 每月备份发送日期（1-28），默认 1 |
| `backup_frequency` | TEXT | 备份频率，默认 'monthly'（目前仅支持每月） |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

### 分类与标签

**`categories`** — 资产分类

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | UUID PK | |
| `user_id` | UUID | 所属用户 |
| `name` | TEXT | 分类名称 |
| `emoji` | TEXT | 分类图标，默认 📦 |
| `is_preset` | BOOLEAN | 是否预置分类 |
| `sort_order` | INTEGER | 排序权重 |
| `deleted_at` | TIMESTAMPTZ | 软删除 |
| `created_at` | TIMESTAMPTZ | |

**`tags`** — 资产标签

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | UUID PK | |
| `user_id` | UUID | |
| `name` | TEXT | 标签名称 |
| `color` | TEXT | 标签颜色，默认 #cc785c |
| `deleted_at` | TIMESTAMPTZ | 软删除 |
| `created_at` | TIMESTAMPTZ | |

### 支付方式

**`payment_types`** — 支付类型

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | UUID PK | |
| `user_id` | UUID | |
| `name` | TEXT | 类型名称 |
| `is_preset` | BOOLEAN | 是否预置 |
| `deleted_at` | TIMESTAMPTZ | 软删除 |
| `created_at` | TIMESTAMPTZ | |

**`payment_accounts`** — 支付账户

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | UUID PK | |
| `user_id` | UUID | |
| `payment_type_id` | UUID | 所属支付类型 |
| `name` | TEXT | 账户名称 |
| `deleted_at` | TIMESTAMPTZ | 软删除 |
| `created_at` | TIMESTAMPTZ | |

### 资产核心

**`assets`** — 资产（买断型和订阅型共用一张表）

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | UUID PK | |
| `user_id` | UUID | |
| `name` | TEXT | 资产名称 |
| `emoji` | TEXT | 图标，默认 📦 |
| `category_id` | UUID | 分类 ID |
| `asset_type` | TEXT ENUM | `one_time` / `subscription` |
| `purchase_price` | NUMERIC(12,2) | 买断购入价 |
| `list_price` | NUMERIC(12,2) | 换新设备原始标价，普通资产可为空 |
| `current_value` | NUMERIC(12,2) | 当前估价 |
| `purchase_date` | DATE | 购入日期 |
| `purchase_receipt` | TEXT | 凭证（订单号、说明或 URL 文本，应用不托管文件） |
| `subscription_price` | NUMERIC(12,2) | 订阅价格 |
| `billing_cycle` | TEXT ENUM | `monthly` / `quarterly` / `yearly` |
| `next_renewal_date` | DATE | 下次续费日（计算字段存储） |
| `subscription_start_date` | DATE | 订阅开始日 |
| `subscription_status` | TEXT ENUM | `active` / `cancelled` / `expired` |
| `subscription_stopped_at` | DATE | 取消订阅日期 |
| `payment_type_id` | UUID | 支付类型 |
| `payment_account_id` | UUID | 支付账户 |
| `notes` | TEXT | 备注 |
| `reminder_enabled` | BOOLEAN | 单资产提醒开关，默认 false |
| `reminder_subscription_days_override` | INTEGER | 单资产订阅提醒天数覆盖 |
| `reminder_warranty_days_override` | INTEGER | 单资产保修提醒天数覆盖 |
| `traded_in_at` | DATE | 以旧换新日期 |
| `trade_in_price` | NUMERIC(12,2) | 回收价 |
| `traded_from_asset_id` | UUID | 换新来源资产 ID |
| `deleted_at` | TIMESTAMPTZ | 软删除 |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

**`asset_tags`** — 资产-标签关联（复合主键，无软删除）

| 字段 | 类型 | 说明 |
|---|---|---|
| `asset_id` | UUID | 复合 PK |
| `tag_id` | UUID | 复合 PK |

**`asset_value_records`** — 买断型资产估值历史

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | UUID PK | |
| `user_id` | UUID | 用户归属，用于每次查询过滤 |
| `asset_id` | UUID | 关联资产，不声明外键 |
| `value` | NUMERIC(12,2) | 非负估值金额 |
| `valued_on` | DATE | 估值日期 |
| `source` | TEXT ENUM | `manual` / `market` / `professional` / `baseline` |
| `notes` | TEXT | 可选备注 |
| `deleted_at` | TIMESTAMPTZ | 软删除 |
| `created_at` / `updated_at` | TIMESTAMPTZ | |

新增估值与同步 `assets.current_value` 在同一事务中完成。软删除最新估值时从剩余有效记录按 `valued_on DESC, created_at DESC` 回算当前值；无剩余记录时清空。迁移会为已有非空当前估值补一条去重的 `baseline` 记录。

### 保修与维修

**`warranties`** — 保修信息（每个资产最多一条）

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | UUID PK | |
| `asset_id` | UUID (UNIQUE) | 关联资产 |
| `start_date` | DATE | 保修起始日 |
| `end_date` | DATE | 保修到期日 |
| `notes` | TEXT | 备注 |
| `created_at` / `updated_at` | TIMESTAMPTZ | |

**`repair_records`** — 维修记录（**硬删除**，唯一例外）

维修、保修和续费写操作必须先验证父资产属于当前用户且未软删除。维修更新和删除同时以 `repair_id + asset_id` 定位，禁止仅凭子资源 ID 修改。出售价格与维修费用由服务端校验为非负金额，保修结束日期不得早于开始日期。

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | UUID PK | |
| `asset_id` | UUID | 关联资产 |
| `repair_date` | DATE | 维修日期 |
| `cost` | NUMERIC(10,2) | 费用，默认 0 |
| `reason` | TEXT | 维修原因 |
| `vendor` | TEXT | 维修商 |
| `result` | TEXT | 维修结果 |
| `is_done` | BOOLEAN | 是否完成 |
| `created_at` | TIMESTAMPTZ | |

**`subscription_renewals`** — 订阅续费记录

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | UUID PK | |
| `asset_id` | UUID | 关联资产 |
| `billing_cycle` | TEXT ENUM | 续费时的计费周期 |
| `price` | NUMERIC(10,2) | 续费价格 |
| `start_date` | DATE | 续费周期起始日 |
| `notes` | TEXT | 可选价格变化说明 |
| `confirmation_key` | TEXT UNIQUE | `${assetId}:${startDate}`，防止周期重复确认；旧记录为空 |
| `deleted_at` | TIMESTAMPTZ | 软删除 |
| `created_at` / `updated_at` | TIMESTAMPTZ | |

续费确认在事务内锁定服务端读取的 `assets.next_renewal_date` 语义，写入确认键并仅推进一个计费周期。用户可选择是否把实际价格同步为后续 `subscription_price`。查询续费历史必须过滤 `deleted_at IS NULL`。

### 计划模块

**`plans`** — 计划

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | UUID PK | |
| `owner_id` | UUID | 创建者 |
| `name` | TEXT | 计划名称 |
| `emoji` | TEXT | 图标，默认 💰 |
| `mode` | TEXT ENUM | `accumulate` / `snapshot` |
| `starting_value` | NUMERIC(12,2) | 净值起始值，默认 0 |
| `permission` | TEXT ENUM | `own` / `all` |
| `deleted_at` | TIMESTAMPTZ | 软删除 |
| `created_at` / `updated_at` | TIMESTAMPTZ | |

**`plan_members`** — 计划成员

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | UUID PK | |
| `plan_id` | UUID | |
| `user_id` | UUID | |
| `role` | TEXT ENUM | `owner` / `editor` |
| `note` | TEXT | 成员备注 |
| `joined_at` | TIMESTAMPTZ | 加入时间 |
| `deleted_at` | TIMESTAMPTZ | 软删除 |
| `created_at` / `updated_at` | TIMESTAMPTZ | |

**`plan_default_items`** — 计划预设收支项

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | UUID PK | |
| `plan_id` | UUID | |
| `item_type` | TEXT ENUM | `income` / `expense` |
| `name` | TEXT | 项目名称 |
| `sort_order` | INTEGER | 排序 |
| `deleted_at` | TIMESTAMPTZ | 软删除 |
| `created_at` / `updated_at` | TIMESTAMPTZ | |

**`plan_invite_links`** — 邀请链接

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | UUID PK | |
| `plan_id` | UUID | |
| `token` | TEXT (UNIQUE) | 邀请 token |
| `created_by_user_id` | UUID | 生成者 |
| `expires_at` | TIMESTAMPTZ | 过期时间（30 天） |
| `revoked_at` | TIMESTAMPTZ | 撤销时间 |
| `created_at` / `updated_at` | TIMESTAMPTZ | |

**`plan_records`** — 月度记录

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | UUID PK | |
| `plan_id` | UUID | |
| `year` | INTEGER | |
| `month` | INTEGER | |
| `recorded_total_value` | NUMERIC(12,2) | snapshot 模式总额 |
| `deleted_at` | TIMESTAMPTZ | 软删除 |
| `created_at` / `updated_at` | TIMESTAMPTZ | |

UNIQUE 约束：`(plan_id, year, month)`

**`plan_record_items`** — 记录收支明细

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | UUID PK | |
| `record_id` | UUID | 关联月度记录 |
| `member_id` | UUID | 所属成员 |
| `item_type` | TEXT ENUM | `income` / `expense` |
| `name` | TEXT | 项目名 |
| `amount` | NUMERIC(12,2) | 金额 |
| `deleted_at` | TIMESTAMPTZ | 软删除 |
| `created_at` / `updated_at` | TIMESTAMPTZ | |

**`plan_record_member_notes`** — 成员月度备注

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | UUID PK | |
| `record_id` | UUID | |
| `member_id` | UUID | |
| `note` | TEXT | 备注内容 |
| `deleted_at` | TIMESTAMPTZ | 软删除 |
| `created_at` / `updated_at` | TIMESTAMPTZ | |

UNIQUE 约束：`(record_id, member_id)`

### 提醒系统

**`reminder_jobs`** — 提醒任务（无软删除）

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | UUID PK | |
| `asset_id` | UUID | 关联资产 |
| `user_id` | UUID | 关联用户 |
| `reminder_type` | TEXT ENUM | `subscription_renewal` / `warranty_expiry` |
| `scheduled_at` | TIMESTAMPTZ | 计划发送时间 |
| `sent_at` | TIMESTAMPTZ | 实际发送时间 |
| `cancelled_at` | TIMESTAMPTZ | 取消时间 |
| `created_at` | TIMESTAMPTZ | |

## 成本计算引擎

详见 [COST-ENGINE.md](COST-ENGINE.md)。

核心文件：`app/lib/cost.ts`，导出 6 个函数：

| 函数 | 用途 |
|---|---|
| `calcOneTimeDailyCost` | 买断型当日日均成本 |
| `calcSubscriptionDailyCost` | 订阅型日均成本 |
| `activeDaysInRange` | 订阅在区间内的有效天数 |
| `calcOneTimeCostRange` | 买断持有中区间成本 |
| `calcSoldOneTimeCostRange` | 买断已卖出区间成本 |
| `countSubPaymentsInMonth` | 订阅某月续费次数 |

## 组件复用模式

### AssetForm 共享组件

`app/components/asset-form.tsx` 是买断型和订阅型资产共用的表单组件，通过 props 区分模式：

- `mode="asset"` → `/assets/new`、`/assets/:id/edit`、`/assets/:id/trade-in`
- `mode="subscription"` → `/subscriptions/new`、`/subscriptions/:id/edit`

组件内通过 `hideOneTimeFields` / `hideSubscriptionFields` 控制字段显隐。emoji 选择器、分类、支付方式、标签等字段在两种模式下共享。

### PlanEditorPage 共享组件

`app/routes/plans.editor-page.tsx` 是计划新建和编辑共用的编辑器组件，配合 `plans.shared.ts` 中的 `loadPlanEditorData` 和 `handlePlanEditorAction` 处理数据加载和保存。

## 路由守卫层级

```
root.tsx
├── 公开路由（/login, /register, /forgot-password, /auth/callback）
└── app-shell.tsx（loader 检查认证）
    ├── /dashboard
    ├── /assets/*
    ├── /subscriptions/*
    ├── /plans/*
    └── /settings/*
```

认证检查在 `app-shell.tsx` 的 loader 中完成，所有子路由自动继承守卫。

## Zod Schema 复用

Zod schema 定义在 `app/lib/*.schema.ts`，同时用于：
1. 客户端：react-hook-form 的 resolver（`@hookform/resolvers/zod`）
2. 服务端：action 中的 `schema.parse()` 验证

类型通过 `z.infer<typeof schema>` 推导，与 Drizzle schema 独立维护。

## PWA 配置

通过 `vite-plugin-pwa` 实现，注册方式为 `autoUpdate`（Service Worker 自动更新）。

**manifest 配置**（`vite.config.ts`）：

| 配置项 | 值 |
|---|---|
| `name` | Holdly |
| `theme_color` | #cc785c |
| `background_color` | #f0e5dc |
| `display` | standalone |
| `start_url` | / |

图标资源：`public/pwa-192.png`、`public/pwa-512.png`、`public/maskable-512.png`。

**SW 注册**：在 `root.tsx` 的 `App` 组件中通过 `useEffect` 动态导入 `virtual:pwa-register`，调用 `registerSW({ immediate: true })`。

**HTML meta**（`root.tsx` Layout）：
- `apple-mobile-web-app-capable: yes`
- `apple-mobile-web-app-status-bar-style: default`
- `theme-color: #cc785c`

## NProgress 进度条

在 `root.tsx` 的 `App` 组件中，通过 `useNavigation()` 监听路由状态变化：

```typescript
const navigation = useNavigation()
const isNavigating = navigation.state !== 'idle'

useEffect(() => {
  if (isNavigating) NProgress.start()
  else NProgress.done()
}, [isNavigating])
```

样式引入：`import 'nprogress/nprogress.css'`。自定义样式覆盖见 `app/app.css`。

## 邮件提醒

提醒系统已完整实现，详见 `docs/REMINDER.md`。核心架构：

- **Cron 端点**：`/api/cron/send-reminders`（`app/routes/api.cron.send-reminders.tsx`），每日 UTC 08:00 触发，也支持用户手动触发
- **邮件发送**：通过 Resend API（`app/lib/email.server.ts`），需要 `RESEND_API_KEY` 环境变量
- **邮件模板**：应用直接发送的邮件共用 `app/lib/email-template.server.ts` 品牌外壳；提醒使用 560px 标准版，含大表格的数据备份使用 1200px 紧凑宽版
- **提醒类型**：订阅续费到期、保修到期
- **配置层级**：全局默认（设置页）→ 单资产覆盖（资产/订阅详情页）
- **开关层级**：全局关闭直接短路；全局开启后再检查单资产开关
- **时间边界**：单次任务生成一个 `today` 并传入日期纯函数，Cron 和手动检查共用实现

## 月计划成员分组

`plan_record_items.member_id` 表示金额归属成员。读取层通过纯函数按成员生成收入项、支出项、收入合计、支出合计和净额；这些合计为派生数据，不写回数据库。详情页隐藏无条目的成员，编辑页保留所有当前成员用于新增条目。当前用户优先，其余成员按计划成员顺序，已退出成员的历史条目排在最后。

## 数据备份

数据备份功能允许用户按月将全部资产和计划数据通过邮件发送给自己。核心架构：

- **设置页**：`/settings/data`（`app/routes/settings/data.tsx`），备份开关 + 发送日期选择（1-28 日）+ 导出 XLSX 按钮
- **Cron 端点**：`/api/cron/send-backup`（`app/routes/api.cron.send-backup.tsx`），每日 UTC 09:00 触发
- **GitHub Actions**：`.github/workflows/send-backup.yml`，每日触发 cron 端点
- **共享逻辑**：`app/lib/backup.server.ts`，导出 `generateExportXlsx`（生成 XLSX 文件）和 `generateBackupHtml`（生成 HTML 邮件正文）
- **备份存储**：配置存储在 `profiles` 表（`backup_enabled`、`backup_day_of_month`、`backup_frequency`），不独立建表
- **邮件发送**：通过 Resend API，HTML 表格形式发送（Resend 免费版不支持附件，未来可扩展）
- **频率限制**：目前仅支持每月备份，频率字段 `backup_frequency` 已预留供未来扩展
