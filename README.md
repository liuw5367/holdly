# Holdly

个人资产持有成本追踪 PWA。把购入价格摊薄成每日成本，让每件物品的真实代价清晰可见。

## 功能特性

- **资产管理**：买断型和订阅型资产的完整生命周期管理，包括保修、维修记录、以旧换新
- **持有成本**：买断型动态递减日均成本、订阅型周期日均成本、区间成本统计
- **统计总览**：KPI 卡片、分类花费分布、月度趋势图、即将到期提醒
- **协作计划**：多人收支预算管理，支持累加/快照双模式，邀请链接协作
- **提醒与备份**：订阅/保修邮件提醒、按月邮件备份、XLSX 手动导出
- **设置中心**：分类、标签、支付方式、提醒、备份与主题管理
- **PWA 支持**：可添加到主屏幕，离线缓存，自动更新

## 技术栈

React Router v7 · Vite · TypeScript · shadcn/ui (base-nova) · Tailwind v4 · Drizzle ORM · Supabase Auth · PostgreSQL · PWA

## 目录结构

```
app/
├── components/          # 组件
│   ├── ui/              # shadcn/ui 基础组件
│   ├── layout/          # 布局组件（app-shell）
│   ├── asset-form.tsx   # 资产表单（买断/订阅共用）
│   └── ...
├── db/
│   ├── schema.ts        # Drizzle schema（18 张表）
│   └── queries/         # 数据库查询（assets/dashboard/plans/settings）
├── lib/
│   ├── cost.ts          # 持有成本计算引擎
│   ├── asset-meta.ts    # 资产元数据工具
│   ├── supabase.server.ts  # Supabase 服务端 client
│   ├── *.schema.ts      # Zod 验证 schema
│   └── ...
├── routes.ts            # 路由配置
├── routes/              # 路由文件（loader/action/component）
├── root.tsx             # 根布局（NProgress、PWA、主题）
└── app.css              # 全局样式 + 色彩 token
docs/                    # 项目文档
drizzle/                 # 数据库迁移文件
public/                  # 静态资源（PWA 图标、favicon）
```

## 快速开始

```bash
pnpm install
cp .env.example .env.local   # 填入数据库、Supabase、邮件与 Cron 配置
pnpm dev
```

### 环境变量

| 变量 | 说明 |
|---|---|
| `SUPABASE_URL` | Supabase 项目 URL |
| `SUPABASE_ANON_KEY` | Supabase 匿名 Key |
| `DATABASE_URL` | PostgreSQL 连接串，应用查询与 Drizzle 命令共用 |
| `RESEND_API_KEY` | Resend API Key；发送提醒和备份邮件时必填 |
| `EMAIL_FROM` | 发件人地址；可选，默认 `Holdly <notifications@holdly.app>` |
| `CRON_SECRET` | GitHub Actions 调用 Cron 端点时使用的共享密钥 |

## 脚本

| 命令 | 说明 |
|---|---|
| `pnpm dev` | 启动开发服务器 |
| `pnpm build` | 生产构建 |
| `pnpm start` | 启动生产服务 |
| `pnpm lint` | ESLint 检查 |
| `pnpm lint:fix` | ESLint 自动修复 |
| `pnpm typecheck` | TypeScript 类型检查（先执行 typegen） |
| `pnpm test` | 运行 Vitest 测试 |
| `pnpm db:generate` | 生成 Drizzle 迁移文件 |
| `pnpm db:push` | 推送 schema 到 Supabase |
| `pnpm db:migrate` | 执行数据库迁移 |
| `pnpm db:studio` | 打开 Drizzle Studio |

## 文档

- [产品需求文档](docs/REQUIREMENT.md)
- [设计规范](docs/DESIGN.md)
- [开发架构](docs/ARCHITECTURE.md)
- [部署指南](docs/DEPLOYMENT.md)
- [成本计算引擎](docs/COST-ENGINE.md)
- [API 接口文档](docs/API.md)
- [提醒系统](docs/REMINDER.md)
- [手动续费实现记录](docs/subscription-renewal-design.md)
- [数据库初始化 SQL](docs/db-init.sql)
- [HTML 原型](docs/holdly-prototype.html)
