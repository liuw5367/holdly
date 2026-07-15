import type { RouteConfig } from '@react-router/dev/routes'
import {
  index,
  layout,
  route,

} from '@react-router/dev/routes'

export default [
  route('/.well-known/appspecific/com.chrome.devtools.json', 'routes/well-known.ts'),

  index('routes/_index.tsx'),

  route('login', 'routes/login.tsx'),
  route('register', 'routes/register.tsx'),
  route('forgot-password', 'routes/forgot-password.tsx'),
  route('auth/callback', 'routes/auth.callback.tsx'),

  layout('components/layout/app-shell.tsx', [
    route('account/update-password', 'routes/account.update-password.tsx'),
    route('dashboard', 'routes/dashboard.tsx'),
    route('assets', 'routes/assets._index.tsx'),
    route('subscriptions', 'routes/subscriptions._index.tsx'),
    route('assets/new', 'routes/assets.new.tsx'),
    route('subscriptions/new', 'routes/subscriptions.new.tsx'),
    route('assets/:id', 'routes/assets.$id.tsx'),
    route('assets/:id/edit', 'routes/assets.$id.edit.tsx'),
    route('subscriptions/:id/edit', 'routes/subscriptions.$id.edit.tsx'),
    route('assets/:id/trade-in', 'routes/assets.$id.trade-in.tsx'),
    route('subscriptions/:id', 'routes/subscriptions.$id.tsx'),
    route('plans', 'routes/plans._index.tsx'),
    route('plans/new', 'routes/plans.new.tsx'),
    route('plans/invite/:token', 'routes/plans.invite.$token.tsx'),
    route('plans/:id', 'routes/plans.$id.tsx'),
    route('plans/:id/edit', 'routes/plans.$id.edit.tsx'),
    route('plans/:id/records/:month', 'routes/plans.$id.records.$month.tsx'),
    route('plans/:id/records/:month/edit', 'routes/plans.$id.records.$month.edit.tsx'),
    route('settings', 'routes/settings.tsx'),
    route('settings/account', 'routes/settings.account.tsx'),
    route('settings/categories', 'routes/settings/categories.tsx'),
    route('settings/tags', 'routes/settings/tags.tsx'),
    route('settings/payment-types', 'routes/settings/payment-types.tsx'),
    route('settings/payment-accounts', 'routes/settings/payment-accounts.tsx'),
    route('settings/reminders', 'routes/settings/reminders.tsx'),
    route('settings/data', 'routes/settings/data.tsx'),
  ]),
  route('settings/export-xlsx', 'routes/settings.export-xlsx.tsx'),
  route('api/cron/send-reminders', 'routes/api.cron.send-reminders.tsx'),
  route('api/cron/send-backup', 'routes/api.cron.send-backup.tsx'),
] satisfies RouteConfig
