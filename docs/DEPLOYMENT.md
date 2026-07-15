# Holdly — 部署与环境配置指南

---

## 环境变量

| 变量 | 必填 | 说明 |
|---|---|---|
| `SUPABASE_URL` | 是 | Supabase 项目 URL，格式 `https://xxx.supabase.co` |
| `SUPABASE_ANON_KEY` | 是 | Supabase 匿名 Key（公开，前端可见）|
| `DATABASE_URL` | 是 | PostgreSQL 连接串，供应用查询和 Drizzle Kit 使用 |
| `RESEND_API_KEY` | 邮件功能必填 | Resend API Key；缺失时提醒和备份邮件不会发送 |
| `EMAIL_FROM` | 否 | 发件人地址，默认 `Holdly <notifications@holdly.app>` |
| `CRON_SECRET` | GitHub Actions 必填 | Cron 端点共享密钥，需与仓库 Secret 同值 |

`.env.example` 内容：

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
DATABASE_URL=postgresql://postgres:your-password@db.your-project.supabase.co:5432/postgres
RESEND_API_KEY=re_xxxxxxxxxxxx
EMAIL_FROM='Holdly <notifications@your-domain.com>'
CRON_SECRET=your-random-secret-string
```

---

## Supabase 项目配置

### 1. 创建项目

前往 [supabase.com](https://supabase.com) 创建项目，获取 URL 和 anon key。

### 2. 数据库初始化

在 Supabase Dashboard → SQL Editor 中执行 `docs/db-init.sql`。

该脚本创建：
- 18 张业务表
- 30 个索引
- 注册自动初始化触发器（`handle_new_user`）

### 3. Auth 配置

在 Supabase Dashboard → Authentication → URL Configuration 中设置：

| 配置项 | 值 |
|---|---|
| Site URL | `https://your-domain.com` |
| Redirect URLs | `https://your-domain.com/auth/callback` |

本地开发时需额外添加 `http://localhost:5173/auth/callback`。

#### 密码恢复邮件模板

在 Supabase Dashboard → Authentication → Email Templates → Reset password 中，将重置链接改为直接携带 token hash：

```html
<a href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=recovery&next=%2Faccount%2Fupdate-password">
  设置新密码
</a>
```

不要使用默认的 `{{ .ConfirmationURL }}`。默认链接的 PKCE code 只能由保存了 verifier cookie 的发信浏览器交换；`token_hash` 回调允许用户从邮件客户端、其他浏览器或其他设备完成密码设置。

### 4. OAuth 提供商（可选）

在 Authentication → Providers 中启用：

- **GitHub**：需要 GitHub OAuth App 的 Client ID 和 Client Secret
- **Google**：需要 Google Cloud Console 的 OAuth 2.0 Client ID 和 Client Secret

回调 URL 均设置为 `{SUPABASE_URL}/auth/v1/callback`。

### 5. 数据库触发器

`docs/db-init.sql` 中的 `handle_new_user()` 触发器在用户注册时自动：
1. 创建 `profiles` 记录
2. 插入 7 个预置分类
3. 插入 7 个预置支付类型

无需额外配置，执行 SQL 即生效。

---

## Vercel 部署

### 1. 连接仓库

在 [vercel.com](https://vercel.com) 导入 Git 仓库，Framework Preset 自动识别为 React Router。

### 2. 环境变量

在 Vercel 项目 Settings → Environment Variables 中添加：

| 变量 | 值 |
|---|---|
| `SUPABASE_URL` | 你的 Supabase 项目 URL |
| `SUPABASE_ANON_KEY` | 你的 Supabase anon key |
| `DATABASE_URL` | Supabase PostgreSQL 连接串 |
| `RESEND_API_KEY` | Resend API Key |
| `EMAIL_FROM` | 发件人地址（可选）|
| `CRON_SECRET` | Cron 共享密钥 |

### 3. 构建配置

- Build Command: `pnpm build`
- Output Directory: 默认（由 React Router 配置）
- Install Command: `pnpm install`

### 4. 部署

推送代码到 main 分支自动触发部署。

---

## 定时任务

仓库通过 GitHub Actions 调用两个 Cron 端点：

| 工作流 | 时间（UTC） | 端点 |
|---|---|---|
| `.github/workflows/send-reminders.yml` | 每日 08:00 | `POST /api/cron/send-reminders` |
| `.github/workflows/send-backup.yml` | 每日 09:00 | `POST /api/cron/send-backup` |

在 GitHub 仓库的 Actions secrets 中配置：

| Secret | 说明 |
|---|---|
| `CRON_SECRET` | 与部署环境中的 `CRON_SECRET` 保持一致 |
| `VERCEL_URL` | 部署域名，例如 `https://holdly.example.com`；不配置时工作流使用仓库内的默认地址 |

工作流通过 `x-cron-secret` 请求头鉴权。端点也兼容携带 `x-cron-trigger: true` 的 Vercel Cron 请求，但仓库当前没有 `vercel.json`，默认调度来源是 GitHub Actions。提醒设置页在本地环境还提供仅处理当前登录用户的手动检查入口。

---

## Resend 邮件服务

### 1. 注册

前往 [resend.com](https://resend.com) 注册，获取 API Key。

### 2. 域名验证

在 Resend Dashboard 添加并验证发送域名（如 `mail.holdly.app`）。

### 3. 配置

API Key 需添加到 Vercel 环境变量（供 cron route 使用）：

| 变量 | 值 |
|---|---|
| `RESEND_API_KEY` | 你的 Resend API Key |
| `EMAIL_FROM` | 发件人地址，如 `Holdly <notifications@你的域名>`（可选，默认 `notifications@holdly.app`）|

---

## 数据库迁移

项目使用 Drizzle Kit 管理迁移。

### 开发环境

```bash
# 修改 app/db/schema.ts 后生成迁移文件
pnpm db:generate

# 推送变更到数据库（开发用）
pnpm db:push

# 正式执行迁移（生产用）
pnpm db:migrate
```

### 迁移文件

迁移 SQL 存储在 `drizzle/` 目录，Drizzle 元数据位于被 Git 忽略的 `drizzle/meta/`。不要在文档中固定迁移数量；以目录中的 SQL 文件为准。

---

## PWA 配置

PWA 通过 `vite-plugin-pwa` 自动配置，无需手动管理 Service Worker。

- 注册方式：`autoUpdate`（自动更新）
- 图标：`public/pwa-192.png`、`public/pwa-512.png`、`public/maskable-512.png`
- 图标生成：`scripts/generate-icons.mjs`（使用 sharp）

构建后自动生成 `manifest.webmanifest` 和 Service Worker 文件。

---

## 本地开发

```bash
# 安装依赖
pnpm install

# 复制环境变量
cp .env.example .env.local
# 编辑 .env.local 填入数据库、Supabase、邮件与 Cron 配置

# 启动开发服务器
pnpm dev

# 类型检查
pnpm typecheck

# 代码检查
pnpm lint

# 运行测试
pnpm test
```
