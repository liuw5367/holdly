# Holdly 持有成本计算引擎

> 核心实现：`app/lib/cost.ts`
> 测试：`app/lib/cost.test.ts`

---

## 设计思路

Holdly 的核心价值是将购入价格摊薄为每日成本。不同类型资产的摊薄方式不同：

- **买断型**：随着持有天数增加，日均成本**动态递减**（持有越久，每天分摊越少）
- **订阅型**：日均成本**固定**（周期价格 / 周期天数）

---

## 算法详解

### 1. 买断型当日日均成本

```
dailyCost = purchasePrice / n
n = today - purchaseDate + 1（购买日当天 n=1）
```

实现：`calcOneTimeDailyCost(purchasePrice, purchaseDate)`

示例：
- 购入价 18999，持有 637 天 → `18999 / 637 = 29.83/天`
- 购入当天 → `18999 / 1 = 18999/天`

### 2. 订阅型日均成本

```
monthly  → price / 30
quarterly → price / 91
yearly   → price / 365
```

实现：`calcSubscriptionDailyCost(price, cycle)`

使用固定天数而非精确日历天数，简化计算。

### 3. 买断型区间成本

区间 `[rangeStart, rangeEnd]` 的持有成本通过**调和级数逐项求和**计算：

```
n_start = rangeStart - purchaseDate + 1
n_end   = rangeEnd - purchaseDate + 1

cost = purchasePrice × Σ(1/n)，n ∈ [max(n_start, 1), n_end]
```

实现：`calcOneTimeCostRange(purchasePrice, purchaseDate, rangeStart, rangeEnd)`

**为什么不使用连续近似 ln(n_end/n_start)？**

早期需求文档设计使用 `P_b × ln(n_end / (n_start- 1))` 连续近似。实际实现采用逐项求和，原因：
- 计算量小（单资产持有天数通常 < 3000）
- 精度更高，无近似误差
- 边界情况处理更简单

### 4. 买断已卖出区间成本

与上面类似，但区间限制在持有期 `[purchaseDate, tradeInDate - 1]` 的交集内：

```
effective_start = max(rangeStart, purchaseDate)
effective_end   = min(rangeEnd, tradeInDate - 1)

cost = (purchasePrice - tradeInPrice) × Σ(1/n)
```

实现：`calcSoldOneTimeCostRange(purchasePrice, purchaseDate, tradeInPrice, tradeInDate, rangeStart, rangeEnd)`

**盈利情况**：`tradeInPrice > purchasePrice` 时系数为负，表示卖出盈利。

### 5. 订阅型区间成本

```
cost = (price / 30) × activeDays
```

`activeDays` = 订阅在区间内的有效天数，由 `activeDaysInRange()` 计算。

实现：`calcSubscriptionCostRange(price, subStartDate, subEndDate, rangeStart, rangeEnd)`

### 6. 订阅某月续费次数

判断订阅在指定月份内是否有续费日（0 或 1 次）：

```
续费日 = subscriptionStartDate + k × cycleMonths
k = max(0, ceil(monthsToStart / cycleMonths))

cycleMonths: monthly=1, quarterly=3, yearly=12
```

实现：`countSubPaymentsInMonth(monthStart, monthEnd, subStartDate, cycle)`

---

## 以旧换新成本处理

以旧换新后，新旧资产的日期不重叠：
- 旧资产持有期：`[purchaseDate, tradedInAt]`
- 新资产持有期：`[purchaseDate (= 换新日), ...]`

在 Dashboard 统计中：
- 旧资产已卖出，使用 `calcSoldOneTimeCostRange` 计算持有期成本
- 新资产持有中，使用 `calcOneTimeCostRange` 计算

---

## 精度约定

- 金额字段：`NUMERIC(12, 2)`，两位小数
- 运算：使用 `currency.js` 处理金额加减，避免 JavaScript 浮点数精度问题
- 日均成本展示：保留两位小数（`toFixed(2)`）
- 函数输入和返回值为 `number`；金额运算通过 `currency.js` 完成，日期天数与调和系数使用原生数值运算

---

## 边界情况

| 场景 | 处理 |
|---|---|
| 购买日当天 | `n=1`，日均 = 购入价 |
| 购买日在未来 | `n=max(1, ...)` 防负数 |
| 区间在购买日之前 | 返回 0 |
| 卖出日等于购买日 | `n=1`，持有天数取 1 防除零 |
| 订阅未开始 | `activeDays` 返回 0 |
| 订阅已结束 | `activeDays` 按结束日截断 |

---

## 测试用例

见 `app/lib/cost.test.ts`。测试覆盖买断型日均成本、订阅型日均成本、区间有效天数、买断与订阅区间成本、月内订阅扣款次数，以及购入首日、未来日期、卖出截断等边界情况。
