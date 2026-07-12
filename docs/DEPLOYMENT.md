# Holdly — 部署与环境配置指南

---

## 环境变量

| 变量 | 必填 | 说明 |
|---|---|---|
| `SUPABASE_URL` | 是 | Supabase 项目 URL，格式 `https://xxx.supabase.co` |
| `SUPABASE_ANON_KEY` | 是 | Supabase 匿名 Key（公开，前端可见）|

`.env.example` 内容：

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
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

### 3. 构建配置

- Build Command: `pnpm build`
- Output Directory: 默认（由 React Router 配置）
- Install Command: `pnpm install`

### 4. 部署

推送代码到 main 分支自动触发部署。

---

## Vercel Cron（邮件提醒）

邮件提醒功能依赖 Vercel Cron 定时触发 API route。

在 `vercel.json` 中配置：

```json
{
  "crons": [
    {
      "path": "/api/cron/send-reminders",
      "schedule": "0 8 * * *"
    }
  ]
}
```

每日 UTC 08:00（北京时间 16:00）触发，扫描用户资产配置，通过 Resend 发送到期提醒邮件。同时支持用户从设置页手动触发。

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

迁移文件存储在 `drizzle/` 目录，包含 SQL 迁移文件和 JSON 快照。当前共 6 个迁移版本（0000-0005）。

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
# 编辑 .env.local 填入 Supabase 凭据

# 启动开发服务器
pnpm dev

# 类型检查
pnpm typecheck

# 代码检查
pnpm lint

# 运行测试
pnpm test
```
