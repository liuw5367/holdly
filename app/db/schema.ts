import {
  boolean,
  date,
  index,
  integer,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core'

// --- profiles ---
export const profiles = pgTable('profiles', {
  id: uuid('id').primaryKey(),
  displayName: text('display_name').notNull().default(''),
  email: text('email'),
  avatarEmoji: text('avatar_emoji').default('😊'),
  reminderSubscriptionDays: integer('reminder_subscription_days').default(7),
  reminderWarrantyDays: integer('reminder_warranty_days').default(14),
  reminderEnabled: boolean('reminder_enabled').default(true),
  backupEnabled: boolean('backup_enabled').default(false),
  backupDayOfMonth: integer('backup_day_of_month').default(1),
  backupFrequency: text('backup_frequency').default('monthly'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

// --- categories ---
export const categories = pgTable('categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull(),
  name: text('name').notNull(),
  emoji: text('emoji').notNull().default('📦'),
  isPreset: boolean('is_preset').default(false),
  sortOrder: integer('sort_order').default(0),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

// --- tags ---
export const tags = pgTable('tags', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull(),
  name: text('name').notNull(),
  color: text('color').notNull().default('#cc785c'),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

// --- payment_types ---
export const paymentTypes = pgTable('payment_types', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull(),
  name: text('name').notNull(),
  isPreset: boolean('is_preset').default(false),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
})

// --- payment_accounts ---
export const paymentAccounts = pgTable('payment_accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull(),
  paymentTypeId: uuid('payment_type_id').notNull(),
  name: text('name').notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
})

// --- assets ---
export const assets = pgTable('assets', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull(),
  name: text('name').notNull(),
  emoji: text('emoji').notNull().default('📦'),
  categoryId: uuid('category_id'),
  assetType: text('asset_type', { enum: ['one_time', 'subscription'] }).notNull().default('one_time'),

  // 买断型字段
  purchasePrice: numeric('purchase_price', { precision: 12, scale: 2 }),
  listPrice: numeric('list_price', { precision: 12, scale: 2 }),
  currentValue: numeric('current_value', { precision: 12, scale: 2 }),
  purchaseDate: date('purchase_date'),
  purchaseReceipt: text('purchase_receipt'),

  // 订阅型字段
  subscriptionPrice: numeric('subscription_price', { precision: 12, scale: 2 }),
  billingCycle: text('billing_cycle', { enum: ['monthly', 'quarterly', 'yearly'] }),
  nextRenewalDate: date('next_renewal_date'),
  subscriptionStartDate: date('subscription_start_date'),
  subscriptionStatus: text('subscription_status', { enum: ['active', 'cancelled', 'expired'] }).default('active'),
  subscriptionStoppedAt: date('subscription_stopped_at'),

  // 通用
  paymentTypeId: uuid('payment_type_id'),
  paymentAccountId: uuid('payment_account_id'),
  notes: text('notes'),

  // 到期提醒
  reminderEnabled: boolean('reminder_enabled').default(false),
  reminderSubscriptionDaysOverride: integer('reminder_subscription_days_override'),
  reminderWarrantyDaysOverride: integer('reminder_warranty_days_override'),

  // 软删除
  deletedAt: timestamp('deleted_at', { withTimezone: true }),

  // 以旧换新
  tradedInAt: date('traded_in_at'),
  tradeInPrice: numeric('trade_in_price', { precision: 12, scale: 2 }),
  tradedFromAssetId: uuid('traded_from_asset_id'),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

// --- asset_value_records ---
export const assetValueRecords = pgTable('asset_value_records', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull(),
  assetId: uuid('asset_id').notNull(),
  value: numeric('value', { precision: 12, scale: 2 }).notNull(),
  valuedOn: date('valued_on').notNull(),
  source: text('source', { enum: ['manual', 'market', 'professional', 'baseline'] }).notNull().default('manual'),
  notes: text('notes'),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, t => ({
  assetDateIndex: index('asset_value_records_asset_date_idx').on(t.assetId, t.valuedOn),
  userIndex: index('asset_value_records_user_idx').on(t.userId),
}))

// --- asset_tags ---
export const assetTags = pgTable('asset_tags', {
  assetId: uuid('asset_id').notNull(),
  tagId: uuid('tag_id').notNull(),
}, t => ({
  pk: primaryKey({ columns: [t.assetId, t.tagId] }),
}))

// --- warranties ---
export const warranties = pgTable('warranties', {
  id: uuid('id').primaryKey().defaultRandom(),
  assetId: uuid('asset_id').notNull().unique(),
  startDate: date('start_date').notNull(),
  endDate: date('end_date').notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

// --- repair_records ---
export const repairRecords = pgTable('repair_records', {
  id: uuid('id').primaryKey().defaultRandom(),
  assetId: uuid('asset_id').notNull(),
  repairDate: date('repair_date').notNull(),
  cost: numeric('cost', { precision: 10, scale: 2 }).default('0'),
  reason: text('reason'),
  vendor: text('vendor'),
  result: text('result'),
  isDone: boolean('is_done').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

// --- subscription_renewals ---
export const subscriptionRenewals = pgTable('subscription_renewals', {
  id: uuid('id').primaryKey().defaultRandom(),
  assetId: uuid('asset_id').notNull(),
  billingCycle: text('billing_cycle', { enum: ['monthly', 'quarterly', 'yearly'] }).notNull(),
  price: numeric('price', { precision: 10, scale: 2 }).notNull(),
  startDate: date('start_date').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

// --- plans ---
export const plans = pgTable('plans', {
  id: uuid('id').primaryKey().defaultRandom(),
  ownerId: uuid('owner_id').notNull(),
  name: text('name').notNull(),
  emoji: text('emoji').notNull().default('💰'),
  mode: text('mode', { enum: ['accumulate', 'snapshot'] }).notNull().default('accumulate'),
  startingValue: numeric('starting_value', { precision: 12, scale: 2 }).notNull().default('0'),
  permission: text('permission', { enum: ['own', 'all'] }).notNull().default('own'),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

// --- plan_members ---
export const planMembers = pgTable('plan_members', {
  id: uuid('id').primaryKey().defaultRandom(),
  planId: uuid('plan_id').notNull(),
  userId: uuid('user_id').notNull(),
  role: text('role', { enum: ['owner', 'editor'] }).notNull().default('editor'),
  note: text('note'),
  joinedAt: timestamp('joined_at', { withTimezone: true }).defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

// --- plan_default_items ---
export const planDefaultItems = pgTable('plan_default_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  planId: uuid('plan_id').notNull(),
  itemType: text('item_type', { enum: ['income', 'expense'] }).notNull(),
  name: text('name').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

// --- plan_invite_links ---
export const planInviteLinks = pgTable('plan_invite_links', {
  id: uuid('id').primaryKey().defaultRandom(),
  planId: uuid('plan_id').notNull(),
  token: text('token').notNull(),
  createdByUserId: uuid('created_by_user_id').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, t => ({
  tokenUnique: unique('plan_invite_links_token_unique').on(t.token),
}))

// --- plan_records ---
export const planRecords = pgTable('plan_records', {
  id: uuid('id').primaryKey().defaultRandom(),
  planId: uuid('plan_id').notNull(),
  year: integer('year').notNull(),
  month: integer('month').notNull(),
  recordedTotalValue: numeric('recorded_total_value', { precision: 12, scale: 2 }),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, t => ({
  yearMonthUnique: unique('plan_records_plan_id_year_month_unique').on(t.planId, t.year, t.month),
}))

// --- plan_record_items ---
export const planRecordItems = pgTable('plan_record_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  recordId: uuid('record_id').notNull(),
  memberId: uuid('member_id').notNull(),
  itemType: text('item_type', { enum: ['income', 'expense'] }).notNull(),
  name: text('name').notNull(),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

// --- plan_record_member_notes ---
export const planRecordMemberNotes = pgTable('plan_record_member_notes', {
  id: uuid('id').primaryKey().defaultRandom(),
  recordId: uuid('record_id').notNull(),
  memberId: uuid('member_id').notNull(),
  note: text('note').notNull().default(''),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, t => ({
  recordMemberUnique: unique('plan_record_member_notes_record_member_unique').on(t.recordId, t.memberId),
}))

// --- reminder_jobs ---
export const reminderJobs = pgTable('reminder_jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  assetId: uuid('asset_id').notNull(),
  userId: uuid('user_id').notNull(),
  reminderType: text('reminder_type', { enum: ['subscription_renewal', 'warranty_expiry'] }).notNull(),
  scheduledAt: timestamp('scheduled_at', { withTimezone: true }).notNull(),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
})
