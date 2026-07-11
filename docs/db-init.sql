-- ============================================================
-- Holdly 数据库初始化脚本
-- 在 Supabase SQL Editor 中执行
-- 注意：所有表不使用外键约束，关联由应用层 ORM 处理
-- ============================================================

-- 1. profiles（用户资料）
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY,
  display_name TEXT NOT NULL DEFAULT '',
  email TEXT,
  avatar_emoji TEXT DEFAULT '😊',
  reminder_subscription_days INTEGER DEFAULT 7,
  reminder_warranty_days INTEGER DEFAULT 14,
  reminder_enabled BOOLEAN DEFAULT TRUE,
  backup_enabled BOOLEAN DEFAULT FALSE,
  backup_day_of_month INTEGER DEFAULT 1,
  backup_frequency TEXT DEFAULT 'monthly',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. categories（分类）
CREATE TABLE IF NOT EXISTS public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  emoji TEXT NOT NULL DEFAULT '📦',
  is_preset BOOLEAN DEFAULT FALSE,
  sort_order INTEGER DEFAULT 0,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. tags（标签）
CREATE TABLE IF NOT EXISTS public.tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#cc785c',
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. payment_types（支付类型）
CREATE TABLE IF NOT EXISTS public.payment_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  is_preset BOOLEAN DEFAULT FALSE,
  deleted_at TIMESTAMPTZ
);

-- 5. payment_accounts（支付账户）
CREATE TABLE IF NOT EXISTS public.payment_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  payment_type_id UUID NOT NULL,
  name TEXT NOT NULL,
  deleted_at TIMESTAMPTZ
);

-- 6. assets（资产）
CREATE TABLE IF NOT EXISTS public.assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  emoji TEXT NOT NULL DEFAULT '📦',
  category_id UUID,
  asset_type TEXT NOT NULL DEFAULT 'one_time',

  -- 买断型字段
  purchase_price NUMERIC(12, 2),
  list_price NUMERIC(12, 2),
  current_value NUMERIC(12, 2),
  purchase_date DATE,
  purchase_receipt TEXT,

  -- 订阅型字段
  subscription_price NUMERIC(12, 2),
  billing_cycle TEXT,
  next_renewal_date DATE,
  subscription_start_date DATE,
  subscription_status TEXT DEFAULT 'active',
  subscription_stopped_at DATE,

  -- 通用
  payment_type_id UUID,
  payment_account_id UUID,
  notes TEXT,

  -- 到期提醒
  reminder_enabled BOOLEAN DEFAULT FALSE,
  reminder_subscription_days_override INTEGER,
  reminder_warranty_days_override INTEGER,

  -- 软删除
  deleted_at TIMESTAMPTZ,

  -- 以旧换新
  traded_in_at DATE,
  trade_in_price NUMERIC(12, 2),
  traded_from_asset_id UUID,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. asset_tags（资产-标签关联）
CREATE TABLE IF NOT EXISTS public.asset_tags (
  asset_id UUID NOT NULL,
  tag_id UUID NOT NULL,
  PRIMARY KEY (asset_id, tag_id)
);

-- 8. warranties（保修信息）
CREATE TABLE IF NOT EXISTS public.warranties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL UNIQUE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. repair_records（维修记录）
CREATE TABLE IF NOT EXISTS public.repair_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL,
  repair_date DATE NOT NULL,
  cost NUMERIC(10, 2) DEFAULT 0,
  reason TEXT,
  vendor TEXT,
  result TEXT,
  is_done BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. subscription_renewals（订阅续费记录）
CREATE TABLE IF NOT EXISTS public.subscription_renewals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL,
  billing_cycle TEXT NOT NULL,
  price NUMERIC(10, 2) NOT NULL,
  start_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. plans（计划）
CREATE TABLE IF NOT EXISTS public.plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL,
  name TEXT NOT NULL,
  emoji TEXT NOT NULL DEFAULT '💰',
  mode TEXT NOT NULL DEFAULT 'accumulate',
  starting_value NUMERIC(12, 2) NOT NULL DEFAULT '0',
  permission TEXT NOT NULL DEFAULT 'own',
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. plan_members（计划成员）
CREATE TABLE IF NOT EXISTS public.plan_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL,
  user_id UUID NOT NULL,
  role TEXT NOT NULL DEFAULT 'editor',
  note TEXT,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 13. plan_default_items（计划默认项目）
CREATE TABLE IF NOT EXISTS public.plan_default_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL,
  item_type TEXT NOT NULL,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 14. plan_invite_links（计划邀请链接）
CREATE TABLE IF NOT EXISTS public.plan_invite_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL,
  token TEXT NOT NULL UNIQUE,
  created_by_user_id UUID NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 15. plan_records（月度记录）
CREATE TABLE IF NOT EXISTS public.plan_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  recorded_total_value NUMERIC(12, 2),
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(plan_id, year, month)
);

-- 16. plan_record_items（月度记录条目）
CREATE TABLE IF NOT EXISTS public.plan_record_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id UUID NOT NULL,
  member_id UUID NOT NULL,
  item_type TEXT NOT NULL,
  name TEXT NOT NULL,
  amount NUMERIC(12, 2) NOT NULL,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 17. plan_record_member_notes（月度记录成员备注）
CREATE TABLE IF NOT EXISTS public.plan_record_member_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id UUID NOT NULL,
  member_id UUID NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(record_id, member_id)
);

-- 18. reminder_jobs（提醒任务）
CREATE TABLE IF NOT EXISTS public.reminder_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL,
  user_id UUID NOT NULL,
  reminder_type TEXT NOT NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 索引（提升查询性能）
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_categories_user_id ON public.categories(user_id);
CREATE INDEX IF NOT EXISTS idx_tags_user_id ON public.tags(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_types_user_id ON public.payment_types(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_accounts_user_id ON public.payment_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_assets_user_id ON public.assets(user_id);
CREATE INDEX IF NOT EXISTS idx_assets_deleted_at ON public.assets(deleted_at);
CREATE INDEX IF NOT EXISTS idx_asset_tags_asset_id ON public.asset_tags(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_tags_tag_id ON public.asset_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_warranties_asset_id ON public.warranties(asset_id);
CREATE INDEX IF NOT EXISTS idx_repair_records_asset_id ON public.repair_records(asset_id);
CREATE INDEX IF NOT EXISTS idx_subscription_renewals_asset_id ON public.subscription_renewals(asset_id);
CREATE INDEX IF NOT EXISTS idx_plans_owner_id ON public.plans(owner_id);
CREATE INDEX IF NOT EXISTS idx_plans_deleted_at ON public.plans(deleted_at);
CREATE INDEX IF NOT EXISTS idx_plan_members_plan_id ON public.plan_members(plan_id);
CREATE INDEX IF NOT EXISTS idx_plan_members_user_id ON public.plan_members(user_id);
CREATE INDEX IF NOT EXISTS idx_plan_members_deleted_at ON public.plan_members(deleted_at);
CREATE INDEX IF NOT EXISTS idx_plan_default_items_plan_id ON public.plan_default_items(plan_id);
CREATE INDEX IF NOT EXISTS idx_plan_default_items_deleted_at ON public.plan_default_items(deleted_at);
CREATE INDEX IF NOT EXISTS idx_plan_invite_links_plan_id ON public.plan_invite_links(plan_id);
CREATE INDEX IF NOT EXISTS idx_plan_invite_links_token ON public.plan_invite_links(token);
CREATE INDEX IF NOT EXISTS idx_plan_records_plan_id ON public.plan_records(plan_id);
CREATE INDEX IF NOT EXISTS idx_plan_records_deleted_at ON public.plan_records(deleted_at);
CREATE INDEX IF NOT EXISTS idx_plan_record_items_record_id ON public.plan_record_items(record_id);
CREATE INDEX IF NOT EXISTS idx_plan_record_items_member_id ON public.plan_record_items(member_id);
CREATE INDEX IF NOT EXISTS idx_plan_record_items_deleted_at ON public.plan_record_items(deleted_at);
CREATE INDEX IF NOT EXISTS idx_plan_record_member_notes_record_id ON public.plan_record_member_notes(record_id);
CREATE INDEX IF NOT EXISTS idx_plan_record_member_notes_member_id ON public.plan_record_member_notes(member_id);
CREATE INDEX IF NOT EXISTS idx_plan_record_member_notes_deleted_at ON public.plan_record_member_notes(deleted_at);
CREATE INDEX IF NOT EXISTS idx_reminder_jobs_user_id ON public.reminder_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_reminder_jobs_scheduled_at ON public.reminder_jobs(scheduled_at);

-- ============================================================
-- 注册自动初始化 Trigger
-- 用户注册后自动创建 profile + 预置分类 + 预置支付类型
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- 创建 profile
  INSERT INTO public.profiles (id, display_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', ''),
    NEW.email
  );

  -- 初始化预置分类
  INSERT INTO public.categories (user_id, name, emoji, is_preset, sort_order) VALUES
    (NEW.id, '数码设备', '💻', TRUE, 1),
    (NEW.id, '软件工具', '🔧', TRUE, 2),
    (NEW.id, '书籍', '📚', TRUE, 3),
    (NEW.id, '订阅服务', '🔄', TRUE, 4),
    (NEW.id, '摄影', '📷', TRUE, 5),
    (NEW.id, '家居物品', '🏠', TRUE, 6),
    (NEW.id, '其他', '📦', TRUE, 7);

  -- 初始化预置支付类型
  INSERT INTO public.payment_types (user_id, name, is_preset) VALUES
    (NEW.id, '信用卡', TRUE),
    (NEW.id, '借记卡', TRUE),
    (NEW.id, '微信支付', TRUE),
    (NEW.id, '支付宝', TRUE),
    (NEW.id, 'Apple Pay', TRUE),
    (NEW.id, '现金', TRUE),
    (NEW.id, '其他', TRUE);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
