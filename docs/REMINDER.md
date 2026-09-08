# 邮件提醒

本文记录 Holdly 当前的邮件提醒实现。产品支持订阅续费和保修到期两类提醒，不包含站内通知、PWA 推送或短信。

## 当前能力

- 全局提醒配置保存在 `profiles` 表，包括总开关、订阅提前天数和保修提前天数。
- 单资产配置保存在 `assets` 表，包括提醒开关和两类提醒的可选覆盖天数。
- 新资产的提醒默认关闭，需要用户在资产或订阅详情页开启。
- 设置页可修改全局配置。本地开发环境还显示「立即检查提醒」入口，只处理当前登录用户。
- Dashboard 的到期项目包含 `reminderEnabled`，用于显示单项提醒状态。

## 生效规则

提醒需要同时满足以下条件：

1. 用户的全局提醒开关已开启。
2. 资产未软删除，且单资产提醒开关已开启。
3. 订阅续费日或保修到期日存在。
4. 当前日期已进入提醒窗口，且仍在发送边界内。
5. `reminder_jobs` 中没有相同资产、提醒类型和计划发送日期的已发送记录。

有效提前天数优先使用单资产覆盖值；没有覆盖值时使用用户的全局默认值。订阅可选 3、7、14 天，保修可选 7、14、30 天。

## 处理流程

`POST /api/cron/send-reminders` 负责定时任务和登录用户的手动检查：

1. 定时任务查询所有开启全局提醒的用户；手动检查只处理当前用户。
2. `processUserReminders(userId)` 查询已开启提醒且未软删除的资产。
3. 系统分别计算订阅续费和保修到期的计划发送日期。
4. 发送前按 `asset_id + reminder_type + scheduled_at` 查询 `reminder_jobs`。
5. Resend 投递成功后写入发送记录；失败时不写记录，下一次任务可以重试。

当前去重流程是“查询、发送、写入”三步，数据库没有对应的唯一约束。并发调用可能重复发送，因此不应并行触发同一批提醒。

## 调度与鉴权

仓库的 `.github/workflows/send-reminders.yml` 每日 UTC 08:00 调用提醒端点，并通过 `x-cron-secret` 传递与部署环境一致的 `CRON_SECRET`。

没有 Cron 请求头时，端点要求有效的 Supabase session，并只处理当前用户。设置页的手动检查按钮只在 localhost 或 127.0.0.1 显示。

当前端点还接受 `x-cron-trigger: true`。该请求头可由任意客户端构造，不是有效的身份凭据，不能作为生产环境的信任边界。生产调度只应使用 `x-cron-secret`，并应在发布前移除这条兼容分支。

## 数据模型

| 字段 | 默认值 | 说明 |
|---|---:|---|
| `profiles.reminder_enabled` | `true` | 全局提醒开关 |
| `profiles.reminder_subscription_days` | `7` | 全局订阅提前天数 |
| `profiles.reminder_warranty_days` | `14` | 全局保修提前天数 |
| `assets.reminder_enabled` | `false` | 单资产提醒开关 |
| `assets.reminder_subscription_days_override` | `null` | 单资产订阅提前天数 |
| `assets.reminder_warranty_days_override` | `null` | 单资产保修提前天数 |

`reminder_jobs` 保存资产、用户、提醒类型、计划发送时间、实际发送时间和取消时间。它用于避免正常串行任务重复投递，不记录面向用户展示的提醒历史。

## 实现位置

| 职责 | 文件 |
|---|---|
| 全局设置与本地手动检查 | `app/routes/settings/reminders.tsx` |
| 单资产设置 | `app/routes/assets.$id.tsx`、`app/routes/subscriptions.$id.tsx` |
| Cron 入口 | `app/routes/api.cron.send-reminders.tsx` |
| 提醒计算与发送编排 | `app/lib/reminder.server.ts` |
| 邮件投递与模板 | `app/lib/email.server.ts`、`app/lib/email-template.server.ts` |
| 数据模型 | `app/db/schema.ts`、`docs/db-init.sql` |
