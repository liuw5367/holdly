# 任务 1：资产信息闭环

## 目标

让买断型资产详情完整呈现从购买、保修、维修到出售或换新的关键事件，并修正当前估值为空时仍可能出现无意义信息的问题。此任务只整理已有资产信息，不引入新的估值历史表。

## 范围

- 资产详情仅在 `currentValue` 有值时显示“当前估值”和相关差额。
- 资产详情展示已有的购买凭证文本或链接；资产新增/编辑表单允许维护该字段。
- 资产详情增加按日期排序的事件时间线：购买、保修开始、维修、保修结束、出售、换新。
- 出售、维修、保修操作增加服务端字段校验与资源归属校验。
- 修复已出售资产日均成本的裸浮点除法，统一使用 `currency.js`。
- 相关备份导出继续包含购买凭证和资产状态，不改变现有导出入口。

## 不做

- 不上传或托管购买凭证文件，只保存文本或 URL。
- 不增加资产估值记录；由任务 2 完成。
- 不重构现有资产表单或详情页整体布局。

## 数据与接口

本任务不新增数据库字段。继续使用：

- `assets.current_value`
- `assets.purchase_receipt`
- `assets.purchase_date`
- `assets.traded_in_at` / `assets.trade_in_price`
- `warranties.start_date` / `warranties.end_date`
- `repair_records.repair_date`

新增或收紧 Zod 校验：

- 购买凭证：去除首尾空格，允许普通说明或合法 URL，最大长度受表单 schema 限制。
- 出售：日期必填，出售价格为非负金额；已换新资产不得重复标记出售。
- 保修：开始、结束日期必填，结束日期不得早于开始日期。
- 维修：日期必填，费用为非负金额，其他文本字段限制长度。
- 所有详情 action 在写入前确认资产属于当前登录用户。

## 实现步骤

1. 扩展 `app/lib/asset.schema.ts`、`app/components/asset-form.tsx`、资产新增/编辑 action，读写 `purchaseReceipt`。
2. 在资产详情 loader 中组装统一时间线数据，按日期降序呈现；相同日期使用稳定的事件类型顺序。
3. 在详情信息区域增加购买凭证展示：合法的 `http/https` 地址可点击，普通文本原样展示。
4. 将估值卡片和估值差额包裹在 `currentValue != null` 条件内，数值 `0` 仍视为已填写。
5. 为出售、维修、保修 intent 接入 Zod 校验并返回可展示的错误信息。
6. 将资产列表的日均成本计算切换为 `currency.js` 的 `divide`。
7. 同步 `docs/REQUIREMENT.md`、`docs/API.md`、`docs/ARCHITECTURE.md` 中相关行为描述。

## 预计修改文件

- `app/lib/asset.schema.ts`
- `app/lib/cost.ts` 或邻近的精确金额工具
- `app/components/asset-form.tsx`
- `app/routes/assets.new.tsx`
- `app/routes/assets.$id.edit.tsx`
- `app/routes/assets.$id.tsx`
- `app/routes/assets._index.tsx`
- 必要的 `*.test.ts`
- `docs/REQUIREMENT.md`
- `docs/API.md`
- `docs/ARCHITECTURE.md`

## 测试与验收

- 单元测试覆盖：`currentValue` 为 `null`、`0`、正数时的显示判定。
- 单元测试覆盖：保修日期倒置、负维修费、负出售价格被拒绝。
- 单元测试覆盖：时间线事件排序和缺失日期跳过。
- 日均成本测试覆盖已出售资产，并断言结果经过 `currency.js` 精确计算。
- 手动验证桌面 1280px 与移动 375px：无估值资产不出现估值字段；凭证与时间线不溢出。
- `pnpm typecheck`、`pnpm lint` 与相关测试全部通过。

## 完成定义

- 上述验收条件全部满足。
- 文档与实现同步。
- 删除本规划文档，并在独立代码提交中包含删除记录。

## Issue 状态

待创建。当前 GitHub CLI 登录令牌失效，恢复认证后补建远端 Issue。
