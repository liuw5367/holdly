# 手动续费操作 — 实现记录

> 状态：已实现 | 最近校对：2026-07-15

---

## 1. 概述

在订阅详情页新增"记录续费"功能，让用户可以手动记录一次续费支付。续费后 `nextRenewalDate` 自动推进一个计费周期，同时将续费记录存入已有的 `subscription_renewals` 表。

## 2. 设计目标

- 用户可以记录"已续费"并推进下次续费日期
- 不改变持有天数、每日成本和订阅花费的计算口径
- 金额可编辑，应对涨价/优惠；用户可选择是否同步更新后续预计价格 `subscriptionPrice`
- 同步推进 `assets.nextRenewalDate`，供详情页、Dashboard 和提醒系统复用

## 3. 交互设计

### 3.1 按钮位置

详情页两个信息卡片下方新增全宽「记录续费」按钮，位于操作网格之上：

```
┌──── 订阅信息卡片 ────┐
│ ...                   │
│ 下次续费日期 2026-06-15│
└───────────────────────┘
┌──── 状态卡片 ──────────┐
│ ...                   │
└───────────────────────┘

┌─── 记录续费（全宽按钮）───┐  ← 新增

┌─── [编辑] [提醒] [取消/恢复] [删除] ───┐
```

- 已取消的订阅不显示此按钮
- 使用现有的 Button `variant="default"` 样式

### 3.2 Dialog

```
┌──────────────────────────────────┐
│ 记录续费                          │
│                                  │
│ 续费金额                          │
│ [  ￥88.00                   ]   │  ← 数字输入，预填 subscriptionPrice
│                                  │
│ 计费周期                          │
│  月付                            │  ← 只读展示 billingCycle 中文标签
│                                  │
│ 本次周期                          │
│  2026-05-15 → 2026-06-14        │  ← 只读，当前周期的起止日期
│                                  │
│ 下次续费日期                       │
│  2026-06-15                      │  ← 只读，确认后推进至此
│                                  │
│      [取消]    [确认续费]          │
└──────────────────────────────────┘
```

- 金额使用数字输入，预填当前 `subscriptionPrice`，允许修改
- 确认前校验：金额必须 > 0
- 确认后按钮显示 loading spinner，防止重复提交

### 3.3 续费后页面变化

| UI 元素 | 变化 |
|---|---|
| 下次续费日期 | 推进一个周期（月付+1月，季付+3月，年付+1年）|
| 最近续费 | 信息卡片末尾新增一行，显示最近续费日期和金额 |
| 其他所有字段 | 不变 |

### 3.4 边界条件

| 条件 | 行为 |
|---|---|
| 订阅已取消 | 隐藏续费按钮，显示"恢复订阅"按钮 |
| 金额为空或 ≤ 0 | Dialog 前端拦截，不提交 |
| 重复点击 | Button disabled + spinner，防重复 |
| 金额录入非法字符 | 数字输入框天然过滤 |

## 4. 技术方案

### 4.1 数据模型

使用已有 `subscription_renewals` 表（`app/db/schema.ts:148`）：

| 字段 | 值 |
|---|---|
| `assetId` | 当前资产 ID |
| `billingCycle` | 当前 `asset.billingCycle` |
| `price` | 用户填写的续费金额 |
| `startDate` | 续费周期的起始日（即旧的 nextRenewalDate）|

### 4.2 查询层

在 `app/db/queries/assets.ts` 新增两个函数：

#### `getLatestRenewal(assetId: string)`

```sql
SELECT * FROM subscription_renewals
WHERE asset_id = ?
ORDER BY start_date DESC
LIMIT 1
```

返回最近一条续费记录或 null。

#### `createRenewal(assetId, billingCycle, price, startDate)`

```sql
INSERT INTO subscription_renewals (asset_id, billing_cycle, price, start_date)
VALUES (?, ?, ?, ?)
```

- `billingCycle` 从 `asset.billingCycle` 取（当前值，不与后续编辑关联）
- 写入续费记录后，根据 `billingCycle` 推进并更新 `assets.next_renewal_date`

### 4.3 Loader 变更

`app/routes/subscriptions.$id.tsx`：

- 新增查询 `getLatestRenewal(asset.id)`
- 将结果传入组件（`latestRenewal` 或 null）

### 4.4 续费日期计算

- 新建订阅时，服务端根据 `subscriptionStartDate || purchaseDate` 和计费周期生成首个未来续费日
- 详情页、Dashboard 和提醒系统统一读取持久化的 `assets.nextRenewalDate`
- 每次确认只从事务内读取并锁定的 `nextRenewalDate` 推进一个周期，不根据当前日期自动跳过逾期周期

### 4.5 Action 变更

新增 `renew` intent：

| 参数 | 来源 |
|---|---|
| `price` | Dialog 表单 |
| `expectedStartDate` | Dialog 打开时的 `nextRenewalDate`，仅作为并发校验令牌 |
| `notes` | 可选说明 |
| `updateExpectedPrice` | 是否同步更新后续预计价格 |

Action 处理：
1. 验证表单字段并锁定当前订阅资产行
2. 核对 `expectedStartDate` 与服务端当前 `nextRenewalDate`；重复请求返回明确提示
3. 写入续费记录并推进 `nextRenewalDate`
4. 返回 `{ ok: true }`，路由提交完成后重新验证 loader 数据

### 4.6 数据流

```
用户点击"记录续费"
  → Dialog 打开（预填金额，展示日期）
  → 用户确认
  → submit intent=renew
  → Action 创建 subscription_renewals 记录并更新 assets.next_renewal_date
  → 返回 { ok: true }
  → Loader 重新加载（含新续费记录）
  → 页面读取持久化后的 nextRenewalDate
  → 最近续费行出现
```

## 5. 涉及文件

| 文件 | 改动 |
|---|---|
| `app/db/queries/assets.ts` | 新增 `getLatestRenewal` + `createRenewal` |
| `app/routes/subscriptions.$id.tsx` | Loader 增加续费查询 + `renew` intent + Dialog + 最近续费展示 |
| `docs/REQUIREMENT.md` | 记录续费的产品需求基线 |
| 本文件 | 保存实现边界与验证方式 |

## 6. 验证

### 执行验证

1. `pnpm typecheck` — 零错误
2. `pnpm lint` — 零错误
3. 打开未取消的订阅详情页 → 看到"记录续费"按钮
4. 已取消的订阅 → 不显示此按钮
5. 点击按钮 → Dialog 打开，金额预填正确
6. 修改金额 → 确认续费 → 下次续费日期推进
7. 再次续费 → 日期继续推进

### 回滚

代码可通过 `git revert` 回滚。续费历史属于用户记录，功能回滚时保留，不执行硬删除；如需修正误录数据，应先设计受审计的用户操作流程。
