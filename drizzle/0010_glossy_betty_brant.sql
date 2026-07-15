ALTER TABLE "payment_accounts" ADD COLUMN "account_kind" text DEFAULT 'generic' NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_accounts" ADD COLUMN "bank_name" text;--> statement-breakpoint
ALTER TABLE "payment_accounts" ADD COLUMN "last_four" text;--> statement-breakpoint
ALTER TABLE "payment_accounts" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "payment_accounts" ADD COLUMN "statement_day" integer;--> statement-breakpoint
ALTER TABLE "payment_accounts" ADD COLUMN "repayment_rule" text;--> statement-breakpoint
ALTER TABLE "payment_accounts" ADD COLUMN "repayment_day" integer;--> statement-breakpoint
ALTER TABLE "payment_accounts" ADD COLUMN "repayment_days_after_statement" integer;--> statement-breakpoint
ALTER TABLE "payment_accounts" ADD COLUMN "credit_limit" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "payment_accounts" ADD COLUMN "currency_code" text DEFAULT 'CNY' NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_accounts" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_accounts" ADD COLUMN "created_at" timestamp with time zone DEFAULT now();--> statement-breakpoint
ALTER TABLE "payment_accounts" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now();