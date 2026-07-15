ALTER TABLE "subscription_renewals" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "subscription_renewals" ADD COLUMN "confirmation_key" text;--> statement-breakpoint
ALTER TABLE "subscription_renewals" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "subscription_renewals" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now();--> statement-breakpoint
ALTER TABLE "subscription_renewals" ADD CONSTRAINT "subscription_renewals_confirmation_key_unique" UNIQUE("confirmation_key");