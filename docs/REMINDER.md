# 提醒系统设计方案

> 状态：已实现 | 最近校对：2026-07-15

---

## 1. 设计目标

实现完整的邮件提醒闭环，覆盖两种提醒类型：**订阅续费到期** 和 **保修到期**。

### 范围

- 全局提醒开关与天数配置（设置页）
- 单资产提醒开关与天数覆盖（资产详情页）
- 邮件发送（Resend + GitHub Actions 定时触发，兼容 Vercel Cron 请求头）
- Dashboard 提醒状态展示

### 非范围

- 站内通知 / 通知中心
- PWA 推送通知
- 提醒历史发送记录展示
- 短信 / 其他推送渠道

---

## 2. 数据模型

### 2.1 配置字段

`profiles` 保存全局配置，`assets` 保存单资产开关和可选覆盖值：

| 字段 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `profiles.reminder_enabled` | boolean | `true` | 全局提醒开关 |
| `profiles.reminder_subscription_days` | integer | `7` | 全局订阅提醒天数 |
| `profiles.reminder_warranty_days` | integer | `14` | 全局保修提醒天数 |
| `assets.reminder_enabled` | boolean | `false` | 单资产提醒开关 |
| `assets.reminder_subscription_days_override` | integer? | `null` | 单资产订阅提醒天数覆盖 |
| `assets.reminder_warranty_days_override` | integer? | `null` | 单资产保修提醒天数覆盖 |

新资产创建时默认 `false`，用户需在详情页手动开启。

### 2.2 提醒天数解析规则

```
有效提醒天数 = asset 有 override → 用 override
             否则 → 用 profile 全局默认
```

### 2.3 提醒生效条件（全量满足才执行）

```
profile.reminder_enabled = true
  AND asset.reminder_enabled = true
  AND asset 未软删除
  AND 提醒日已到
  AND 尚未发送过
```

### 2.4 `reminder_jobs` 表（已存在，无需变更）

| 字段 | 类型 | 说明 |
|---|---|---|
| id | UUID PK | |
| asset_id | UUID | 关联资产 |
| user_id | UUID | 所属用户 |
| reminder_type | enum | `subscription_renewal` / `warranty_expiry` |
| scheduled_at | TIMESTAMPTZ | 应发送时间 |
| sent_at | TIMESTAMPTZ? | 实际发送时间（null=未发送） |
| cancelled_at | TIMESTAMPTZ? | 取消时间 |

---

## 3. 用户体验设计

### 3.1 设置页 — 全局默认

位置：`/settings/reminders`（独立子页面，与分类/标签等设置子页一致），路由挂载在 `app-shell.tsx` 布局下。

```
┌──────────────────────────────────┐
│  启用邮件提醒              [开关] │
│  ─────────────────────────────── │
│  订阅续费提醒      [7天前 ▾]     │
│  ─────────────────────────────── │
│  保修到期提醒     [14天前 ▾]     │
│  ─────────────────────────────── │
│  [保存设置]   (仅变更时显示)      │
│  ─────────────────────────────── │
│  手动检查（仅 localhost 可见）    │
│  ┌────────────────────────┐      │
│  │ 立即检查提醒           │      │
│  └────────────────────────┘      │
└──────────────────────────────────┘
```

- 天数选择固定选项：续费 3/7/14 天，保修 7/14/30 天（匹配 `docs/REQUIREMENT.md §3.8`）
- 「立即检查提醒」按钮 → POST 到 cron endpoint，手动触发当前用户检查
- 全局开关关闭时，cron 端点直接跳过该用户
- 手动检查按钮仅在本地开发环境显示（`hostname === 'localhost'`）

### 3.2 资产详情页 — 单资产提醒

#### 3.2.1 状态展示

在资产详情页的对应区域新增一行提醒状态：

**买断资产（保修区块内）：**

```
保修提醒：已关闭  [设置]
或
保修提醒：7天前 🔔 已开启  [设置]
```

**订阅资产（基本信息区）：**

```
续费提醒：已关闭  [设置]
或  
续费提醒：7天前 🔔 已开启  [设置]
```

#### 3.2.2 设置弹窗

点击「设置」按钮弹出 Dialog（替代当前自由文本输入框）：

```
┌────────────── Dialog ──────────────┐
│  续费提醒设置（或"保修提醒设置"）      │
│                                      │
│  开启提醒              [开关]         │
│                                      │
│  提醒时间    [7天前 ▾]               │
│             ◉ 跟随全局（7天）         │
│             ○ 自定义                 │
│                                      │
│       [取消]            [保存]        │
└──────────────────────────────────────┘
```

关键交互细节：
- 「开启提醒」开关关闭时，「提醒时间」行置灰不可编辑
- 「开启提醒」默认关闭（新资产默认不发提醒）
- 选择「跟随全局」时显示全局值，提供预览
- 选择「自定义」时展开天数下拉选择

### 3.3 Dashboard — 即将到期区域

现有「即将到期」卡片增强为显示提醒状态：

| 图标 | 含义 |
|---|---|
| 🔔 ✓ | 已开启提醒 |
| 🔔 | 未开启提醒（可点击跳转设置） |
| （无） | 提醒已全局关闭（profile 级别） |

---

## 4. 后端设计

### 4.1 Cron 端点

路由：`app/routes/api.cron.send-reminders.tsx`

**部署配置**：`.github/workflows/send-reminders.yml` 每日 UTC 08:00 调用端点。端点同时兼容 GitHub Actions、Vercel Cron 请求头和已登录用户请求。

**处理逻辑（同一个端点同时处理 cron 触发和手动触发）：**

```
POST /api/cron/send-reminders
x-cron-secret: <CRON_SECRET>  (GitHub Actions)
或
x-cron-trigger: true          (兼容 Vercel Cron)
或
POST /api/cron/send-reminders  (手动触发，需认证)
```

1. 查询所有 `profile.reminder_enabled = true` 的用户
2. 对每个用户，查询其所有 `asset.deleted_at IS NULL AND asset.reminder_enabled = true` 的资产
3. 对每条资产：
   a. 确定提醒类型（订阅 → subscription_renewal，有保修 → warranty_expiry）
   b. 计算 due_date（续费日/保修到期日）
   c. 计算 reminder_days（override ?? profile 全局值）
   d. 计算 scheduled_at = due_date - reminder_days
   e. 如果提醒日已到且仍满足发送边界 → 按 `asset_id + reminder_type + scheduled_at` 查 `reminder_jobs` 去重
   f. 未发送过 → 发邮件；发送成功后写入 `reminder_jobs`（`sent_at = now()`）
4. Cron 触发使用 `CRON_SECRET` 或 `x-cron-trigger` 鉴权；手动触发需用户 session

发送频率控制：**每个 asset + 每个提醒类型 + 每个计划提醒日只发一次**。邮件发送失败时不写任务记录，下一次任务可以重试。

### 4.2 邮件发送

使用 Resend：

```
POST https://api.resend.com/emails
```

邮件模板：

- 订阅续费提醒：显示订阅名称、续费日期和金额，并提醒用户确认支付账户余额。
- 保修到期提醒：显示资产名称和保修到期日，并提醒用户及时处理续保或保修服务。
- HTML 邮件共用 `app/lib/email-template.server.ts` 的 Holdly 品牌外壳，同时保留纯文本版本作为兼容回退。

收件人：`profile.email`

### 4.3 手动触发

设置页「立即检查提醒」按钮直接提交 `manual_reminder_check` action，复用 `processUserReminders(user.id)`，只检查当前用户。该入口仅在 localhost / 127.0.0.1 显示。

---

## 5. 实现位置

| 职责 | 文件 |
|---|---|
| 全局设置与本地手动检查 | `app/routes/settings/reminders.tsx` |
| 单资产提醒设置 | `app/routes/assets.$id.tsx`、`app/routes/subscriptions.$id.tsx` |
| Cron 入口 | `app/routes/api.cron.send-reminders.tsx` |
| 提醒计算、去重与发送编排 | `app/lib/reminder.server.ts` |
| 邮件投递与品牌模板 | `app/lib/email.server.ts`、`app/lib/email-template.server.ts` |
| 数据模型 | `app/db/schema.ts`、`docs/db-init.sql` |

---

## 6. 回滚方案

- 代码回滚：`git revert`
- 停止发送：关闭全局提醒或禁用定时工作流，不需要修改已有数据
- `reminder_jobs` 是投递去重记录；回滚功能时保留已有记录，避免恢复功能后重复发送
