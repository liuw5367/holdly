# Holdly 设计规范

> 本文记录当前应用使用的视觉语言和组件约束。认证页面与应用主体采用不同的组件规则，均以现有实现为准。

---

## 0. 品牌基调

Holdly 使用暖色、低阴影的编辑风格：

- **画布**：暖奶油色 `#faf9f5`（不是纯白），整体氛围温暖、人文
- **主色**：暖珊瑚 `#cc785c`，hover 加深至 `#a9583e`
- **文字**：暖墨色 `#141413`（非纯黑），次要文字 `#3d3d3a`，弱化文字 `#6c6a64`
- **字体变量**：`--font-display` 声明 `EB Garamond, Georgia, serif`，`--font-body` 声明 `Inter, system-ui, sans-serif`
- **深度**：色块对比为主（奶油 vs 深色卡片），不使用阴影
- **圆角**：按钮/输入框 10px，卡片 12px/16px，徽标 pill

认证页面的色彩以 `app/app.css` 中的 `--color-*` 变量为准。

当前仓库只打包了 Geist Variable，但字体变量没有引用它，也没有打包 EB Garamond 或 Inter。系统未安装对应字体时，浏览器会使用 Georgia 和系统无衬线字体回退。这是当前实现状态，不应把 EB Garamond 或 Inter 视为稳定可用的内置字体。

---

## 1. 页面布局

认证页面使用居中全屏布局，所有内容垂直居中。

```
min-height: 100dvh
display: flex
flex-direction: column
justify-content: center
align-items: center
padding: 48px 24px 32px
text-align: center
background: var(--color-canvas)
```

---

## 2. 排版层级

### 品牌名 `.brand-name`
- font-family: `var(--font-display)` (EB Garamond)
- font-size: **42px**
- font-weight: 400
- color: `var(--color-primary)` (#cc785c)
- margin-bottom: **20px**

### 标题 `.tagline`
- font-family: `var(--font-display)` (EB Garamond)
- font-size: **22px**
- font-weight: 400
- color: `var(--color-ink)` (#141413)
- line-height: 1.3
- margin-bottom: **8px**

### 副标题 `.subtitle`
- font-size: **13px**
- color: `var(--color-muted)` (#6c6a64)
- margin-bottom: **32px**
- max-width: 280px

---

## 3. 表单组 `.auth-group`

```
width: 100%
max-width: 360px
display: flex
flex-direction: column
gap: 10px        ← 注意：不是 12px
```

### 标签 `.input-label`
- display: block
- font-size: **12px**
- font-weight: 500
- color: `var(--color-muted)` (#6c6a64)
- margin-bottom: **6px**

### 输入框 `.input-field`
- width: 100%, height: **44px**
- padding: 0 **12px**
- background: `var(--color-canvas)` (#faf9f5)
- color: `var(--color-ink)` (#141413)
- border: **1px solid** `var(--color-hairline)` (#e6dfd8)
- border-radius: **10px**
- font-size: **15px**
- outline: none
- transition: border-color 0.15s, box-shadow 0.15s

**focus 状态（重要）**:
- border-color: `var(--color-primary)` (#cc785c)
- box-shadow: **0 0 0 3px** `var(--color-primary-muted)` (#f0e4dc)

**placeholder**:
- color: `var(--color-muted-soft)` (#8e8b82)

---

## 4. 按钮

### 主按钮 `.btn-primary`
```
display: inline-flex
align-items: center
justify-content: center
gap: 6px
height: 44px
padding: 12px 20px
background: var(--color-primary)    (#cc785c)
color: #fff
font-size: 15px
font-weight: 600
border-radius: 10px
border: none
cursor: pointer
width: 100%
transition: background 0.15s, transform 0.1s
```
- **hover**: `background: var(--color-primary-active)` (#a9583e)
- **active**: `transform: scale(0.98)`

### 次按钮 `.btn-secondary`
```
display: inline-flex
align-items: center
justify-content: center
gap: 8px
height: 44px
padding: 0 16px
background: var(--color-canvas)     (#faf9f5)
color: var(--color-ink)             (#141413)
font-size: 15px
font-weight: 500
border: 1px solid var(--color-hairline)  (#e6dfd8)
border-radius: 10px
cursor: pointer
width: 100%
transition: background 0.15s
```
- **hover**: `background: var(--color-surface-soft)` (#f5f0e8)

---

## 5. 分隔线 `.login-divider`

```
display: flex
align-items: center
gap: 12px
color: var(--color-muted)    (#6c6a64)
font-size: 12px
margin: 16px 0
```

- `::before` 和 `::after`: `content: ''; flex: 1; height: 1px; background: var(--color-hairline)`

---

## 6. 页脚链接 `.login-footer`

```
display: flex
gap: 24px
justify-content: center
margin-top: 20px
font-size: 14px
color: var(--color-primary)    (#cc785c)
```

- **hover**: `color: var(--color-primary-active)` (#a9583e)

---

## 7. 成功状态

注册/找回密码成功后，替换主表单区域为卡片：
- 外层：同 `.login-page` 布局
- 卡片：`background: var(--color-surface-card)`, `border-radius: 16px`, `padding: 24px`
- 标题：`font-size: 16px`, `font-weight: 600`, `color: var(--color-ink)`
- 说明：`font-size: 14px`, `color: var(--color-muted)`, `margin-top: 8px`
- 按钮：同主按钮规格，`margin-top: 16px`

---

## 8. 服务条款（仅注册页）

```
font-size: 12px
color: var(--color-muted)    (#6c6a64)
margin-top: 12px
text-align: center
```

链接：`color: var(--color-primary)`

---

## 9. CSS 变量冲突说明

`app.css` 中 `@theme` 块定义 Holdly 的 `--color-primary` 等 token。不能使用 `@theme inline` 覆盖这些变量，因为 `@theme inline` 输出在 CSS 非层级（unlayered），优先级高于 `@theme` 的 `@layer theme`，会导致 Holdly 的珊瑚色 `#cc785c` 被 shadcn 的深色覆盖。

**规则**：Holdly 的 `--color-*` token 必须在 `@theme` 中定义，且不能被其他 `@theme` 块覆盖。

---

## 10. 色彩 Token 完整清单

### Light（默认）

| Token | 值 | 用途 |
|---|---|---|
| `--color-canvas` | `#faf9f5` | 页面背景 |
| `--color-surface-soft` | `#f5f0e8` | 侧边栏、hover 背景 |
| `--color-surface-card` | `#efe9de` | 卡片、弹窗背景 |
| `--color-surface-strong` | `#e8e0d2` | 徽标、禁用态背景 |
| `--color-hairline` | `#e6dfd8` | 边框、分割线 |
| `--color-primary` | `#cc785c` | 主色（珊瑚色）|
| `--color-primary-active` | `#a9583e` | 主色 hover/active |
| `--color-primary-muted` | `#f0e4dc` | 主色浅底（focus ring）|
| `--color-ink` | `#141413` | 主文字 |
| `--color-body` | `#3d3d3a` | 正文文字 |
| `--color-muted` | `#6c6a64` | 次要文字 |
| `--color-muted-soft` | `#8e8b82` | 弱化文字（placeholder）|
| `--color-success` | `#5db872` | 成功状态 |
| `--color-warning` | `#d4a017` | 警告状态 |
| `--color-error` | `#c64545` | 错误状态 |
| `--color-info` | `#5db8a6` | 信息状态 |

### Dark（`.dark`）

| Token | 值 |
|---|---|
| `--color-canvas` | `#181715` |
| `--color-surface-soft` | `#1f1e1b` |
| `--color-surface-card` | `#252320` |
| `--color-surface-strong` | `#302e2a` |
| `--color-hairline` | `#3a3835` |
| `--color-ink` | `#faf9f5` |
| `--color-body` | `#d4d0c8` |
| `--color-muted` | `#a09d96` |
| `--color-muted-soft` | `#8e8b82` |
| `--color-success` | `#8acb95` |
| `--color-warning` | `#e6bd57` |
| `--color-error` | `#e87676` |
| `--color-info` | `#7dd3c1` |

### 圆角

| Token | 值 | 用途 |
|---|---|---|
| `--radius-xs` | 4px | 小元素 |
| `--radius-sm` | 6px | tag |
| `--radius-md` | 8px | 内部元素 |
| `--radius-lg` | 12px | 卡片 |
| `--radius-xl` | 16px | 弹窗、Sheet |
| `--radius-pill` | 9999px | 徽标、胶囊按钮 |

---

## 11. App Shell 布局

认证后的所有页面共享 `app-shell.tsx` 布局。

### 桌面端（≥ 768px）

```
┌─────────────────────────────────────────────┐
│ ┌──────┐ ┌──────────────────────────────┐   │
│ │Holdly│ │                              │   │
│ │      │ │      Main Content            │   │
│ │ 资产  │ │      max-width: 800px       │   │
│ │ 计划  │ │      padding: 32px          │   │
│ │ 统计  │ │                              │   │
│ │ 设置  │ │                              │   │
│ │      │ │                              │   │
│ └──────┘ └──────────────────────────────┘   │
└─────────────────────────────────────────────┘
```

- 左侧固定侧边栏：宽 220px，`position: fixed`，背景 `surface-soft`
- 品牌名：EB Garamond，22px，主色
- 导航项：icon (18px) + label (15px)，active 态主色 + `primary-muted` 背景
- 内容区：`margin-left: 220px`，`max-width: 800px` 居中，`padding: 32px`

### 移动端（< 768px）

```
┌──────────────────────┐
│                      │
│     Main Content     │
│     max-width: 640px │
│     padding: 16px    │
│                      │
├──────────────────────┤
│  资产   计划   统计   设置  │  ← 底部 Tab Bar
└──────────────────────┘
```

- 底部固定 Tab Bar：主体高度 `--tab-bar-height` (56px)，无顶部内边距，底部额外预留 `--tab-bar-safe-area`，值为 `safe-area-inset-bottom` 的一半；总高度 `--tab-bar-total-height` 包含主体、安全区和 1px 顶部分割线。
- Tab 项：4 个等宽项，填满导航主体高度并垂直居中；icon (22px) + label (10px)，active 态主色。
- 内容区：`max-width: 640px`，`padding: 16px`，底部预留 `--tab-bar-total-height`。

---

## 12. 应用主体页面规范

### 12.1 Dashboard (`/dashboard`)

**布局**：单列

- **KPI 卡片**：2×2 网格，每卡片显示指标名（`muted` 12px）+ 数值（`ink` 20px bold）。买断视图展示持有中数量、今日持有成本、资产原值和近一年持有成本；订阅视图展示活动订阅、月度预计、年度预计和需关注数量。卡片背景 `surface-card`，圆角 `radius-lg`，内边距 16px。
- **分类花费**：分段标题 + 水平进度条。进度条高度 6px，背景 `hairline`，填充 `primary`。右侧显示百分比和金额。
- **月度趋势图**：Recharts AreaChart，高度 200px，渐变填充。坐标轴文字 `muted` 12px。
- **即将到期**：列表项 emoji + 名称 + 到期信息。顶部警告横幅背景 `warning` 浅底。

**买断/订阅切换**：统计总览标题右侧只放置一个 Toggle Group，统一切换 KPI、分类花费和趋势图的数据视图。视觉沿用原统计页的紧凑分段按钮：外层和内部选项均使用 `radius-md`，禁止被 Toggle Group 的首尾 `radius-lg` 覆盖；外层采用 `hairline` 细边框和 2px 内边距，内部选项高 24px、水平内边距 8px、12px 文字；选中项使用 `primary` 实心背景和 `primary-foreground` 文字，未选中项不填充背景。移动端保持单行，切换状态通过 URL 查询参数保留。

订阅视图的四张 KPI 卡片与买断视图使用完全相同的卡片结构、字号和间距。人民币金额统一显示 `¥`，不向用户展示内部币种代码 `CNY`；非人民币金额仍显示对应币种代码，禁止误标为人民币。

### 12.2 资产列表 (`/assets`)

**筛选栏**：
- 搜索框：`Input` 组件 + 搜索 icon，placeholder「搜索资产…」
- 类型筛选：水平 pill 按钮组（买断型/订阅型/已取消）
- 分类筛选：水平滚动 pill 按钮（全部 + 各分类 emoji+名称）
- 标签筛选/排序：icon 按钮，点击打开底部 Sheet

**资产卡片**：
- 布局：emoji（左侧）+ 名称/标签（中间）+ 价格/成本（右侧）
- 背景 `surface-card`，圆角 `radius-lg`，内边距 16px，margin-bottom 8px
- 每日成本：主色高亮，数字使用 `font-mono`
- 状态指示点：活跃使用 success 色，已结束使用 error 色

### 12.3 资产详情 (`/assets/:id`)

**Hero 区**：emoji 大图标（48px）+ 名称（`font-display` 24px）+ 状态徽标 + 分类/标签行

**信息卡片**：背景 `surface-card`，圆角 `radius-lg`，内边距 16px，margin-bottom 12px
- 行布局：label（`muted` 14px 左）+ value（`ink` 14px 右）
- 每日成本 value 使用主色 + `font-mono` 18px bold

**操作按钮**：资产与订阅详情底部操作统一使用 secondary 浅色背景，删除使用 destructive。按钮高 40px、文字 13px、图标 14px；取消订阅使用禁止/停止语义图标。价值历史和续费历史记录的删除入口使用低对比度小叉号，位于右下角、日期下方，保留删除确认。底部不同操作使用不同语义图标：估值为趋势图、维修为工具、保修为盾牌、卖出为钱币。价值趋势图左侧展示“估值（元）”金额刻度。

**维修记录**：时间轴样式，竖线 + 圆点，每条记录为卡片

### 12.4 资产表单（新建/编辑）

共享 `AssetForm` 组件，布局从上到下：
- Emoji 选择器（Popover 弹出）
- 表单字段：Label（12px muted）+ Input/Select（h-44px，radius-10px）
- 支付类型/账户：并排两列
- 底部 sticky 提交栏：primary 按钮 full-width

### 12.5 计划详情 (`/plans/:id`)

- 趋势图：同 Dashboard 图表风格
- KPI 卡片：2 列
- 月度记录列表：每行显示月份 + 总额 + 净收入（绿色/红色箭头）+ 收支摘要
- 月度记录详情与编辑：按成员使用独立分组卡片；组头在一行展示收入、支出、净额，窄屏时成员身份与汇总上下排列但汇总本身不换行
- 编辑权限：不可编辑的成员组使用「只读」文字标识，不以整体低透明度作为唯一提示

### 12.6 计划编辑器

共享 `PlanEditorPage` 组件：
- Emoji 选择器 + 名称输入
- 模式选择器（accumulate/snapshot）
- 权限选择器（own/all）
- 成员列表：头像 + 名称 + 角色 + 备注输入
- 默认项目列表：按 income/expense 分组，可增删
- CSV 导入区域（snapshot 模式）
- 邀请链接管理面板

### 12.7 设置页

- 分组：标题（`muted` 12px uppercase）+ 列表项
- 列表项：icon + label + 右侧 value/arrow，h-48px
- 行内编辑：点击切换为 input + 保存/取消按钮
- 数据管理：各子页面入口显示条目计数 badge

---

## 13. 通用组件规范

### 13.1 加载状态

- 页面加载：骨架屏或 spinner 居中
- 资产列表、统计页和计划列表先显示导航和标题，数据区域用 `PageLoading` 显示局部 spinner；不使用遮挡 SSR 内容的全屏启动遮罩，不在查询完成前显示空状态
- 按钮操作：`disabled` + Spinner icon，不禁用其他按钮
- 路由切换：NProgress 顶部 2px 进度条（主色）

### 13.2 错误状态

- 表单错误：字段下方红色文字 12px
- 页面错误：ErrorBoundary 居中显示状态码 + 文案 + 返回按钮
- 流式数据错误：保留导航和标题，数据区域显示失败说明及「重新加载」按钮；重试时仅禁用该按钮并显示 spinner
- Toast 错误：Sonner `toast.error()`，顶部居中

### 13.3 空状态

- 居中布局：icon/插图 + 标题（16px ink）+ 描述（14px muted）+ CTA 按钮
- 背景 `surface-card`，圆角 `radius-xl`，padding 32px
- 资产列表使用共享 `EmptyState` 组件区分“暂无资产”和“筛选无结果”两种状态

### 13.4 按钮与切换控件交互状态

- 主按钮 hover 使用 `primary-active`，保持白色文字。
- 普通 `outline`、`ghost` 按钮 hover 使用 `primary/10` 浅底和 `primary` 文字，避免回退到中性灰色。
- `Toggle`、`ToggleGroup` 的选中态必须使用主题色：默认采用 `primary` 背景、`primary-foreground` 文字，hover 使用 `primary-active`。禁止使用 `muted`、`secondary` 或任何中性灰色表示选中。
- 切换控件未选中项沿用普通按钮的主题色 hover；只有危险、成功等明确业务语义可以覆盖默认选中颜色。
- 危险操作保持 `destructive` 语义色，不套用主题色 hover。
- 纯展示型 Badge、状态标签不因 hover 改变颜色；只有可点击元素提供 hover 反馈。
- 禁用控件不响应 hover，并维持清晰的禁用视觉状态。

### 13.5 图标和操作入口

- 普通按钮图标统一以 14px 为基线；`sm` 按钮使用 14px，`icon-xs`/`icon-sm` 按钮分别使用对应的 12px/14px 视觉尺寸。
- 图标按钮必须提供 `aria-label`；同一页面上的编辑、删除、关闭、选择和保存操作使用不同且明确的语义图标。
- 异步操作只禁用当前操作入口，并在原位置显示 spinner；成功后恢复图标和文案，失败时保留可编辑内容。
- 价值历史、续费历史的删除按钮放在记录右下角、日期下方，使用 `IconX` 小尺寸呈现，默认低对比度，悬停时才使用错误色。

### 13.6 窄屏和滚动

- 业务页面以 375px × 812px 作为最小验收视口，长名称、邮箱、备注和金额必须通过收缩、换行或截断保持可读，不允许产生横向滚动。
- Dialog、AlertDialog 和 Sheet 的内容区域在视口高度不足时允许纵向滚动，页脚操作保持可达。
- 移动端表单保存栏必须避开 `--tab-bar-height` 和底部安全区；页面内容底部同步预留操作栏空间。

### 13.7 Select 选中项显示

项目使用 Base UI 版 shadcn Select。`SelectItem` 的子元素只负责渲染下拉列表，空的 `<SelectValue />` 不会根据这些子元素自动查找显示名称。根 `Select` 没有提供 `items` 时，触发器会直接显示选中项的 `value`，UUID、状态 key 等内部值会暴露给用户。

优先把同一组 `{ value, label }` 数据同时传给 `Select` 和 `SelectItem`：

```tsx
const items = [
  { value: 'active', label: '活动中' },
  { value: 'cancelled', label: '已停止' },
]

<Select items={items} value={status} onValueChange={setStatus}>
  <SelectTrigger>
    <SelectValue />
  </SelectTrigger>
  <SelectContent>
    <SelectGroup>
      {items.map(item => (
        <SelectItem key={item.value} value={item.value}>
          {item.label}
        </SelectItem>
      ))}
    </SelectGroup>
  </SelectContent>
</Select>
```

如果不能提供 `items`，必须在 `SelectValue` 中显式完成 `value` 到显示名称的映射。禁止在没有 `items` 或自定义映射时使用空的 `<SelectValue />`。提交前应检查触发器的收起状态，不能只检查展开后的下拉列表。

---

## 14. Do / Don't

### 认证页面

#### Do
- 使用 `var(--font-display)` (EB Garamond) 做品牌名和标题
- 使用原始 HTML 元素（`<button>`, `<input>`, `<label>`），不使用 shadcn 组件
- 所有颜色使用 `--color-*` 前缀的 CSS 变量
- 输入框 focus 必须有 `box-shadow: 0 0 0 3px var(--color-primary-muted)` 光晕
- 按钮必须有 hover（颜色加深）和 active（scale 0.98）过渡动画
- 品牌色、字体和间距以本文件及 `app/app.css` 为准

#### Don't
- 不使用 shadcn 的 `Button`、`Input`、`Label` 组件
- 不使用 `--background`、`--foreground`、`--border` 等 shadcn CSS 变量
- 不使用 Tailwind 的 `font-sans` 做标题字体
- 分隔线字号不要用 13px，统一 12px
- footer 不要用 `justify-between`，用 `justify-center` + `gap: 24px`
- 不要使用 `@theme inline` 覆盖 `--color-*` token

### 应用主体页面

#### Do
- 使用 shadcn/ui 组件（`Button`、`Input`、`Select`、`Card` 等）
- 颜色使用 shadcn 映射 token（`bg-card`、`text-foreground`、`border-border`）
- 金额/数字使用 `font-[family-name:var(--font-mono)]`
- 按钮异步操作必须有独立 loading 状态
- 路由 loader 中处理认证，未登录重定向 `/login`

#### Don't
- 不使用原始 `<button>`、`<input>` 元素（认证页面例外）
- 不硬编码颜色值，使用 CSS 变量或 Tailwind token
- 不因一个按钮 loading 而禁用全页按钮
