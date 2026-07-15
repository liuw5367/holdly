CREATE TABLE "asset_value_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"asset_id" uuid NOT NULL,
	"value" numeric(12, 2) NOT NULL,
	"valued_on" date NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	"notes" text,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX "asset_value_records_asset_date_idx" ON "asset_value_records" USING btree ("asset_id","valued_on");--> statement-breakpoint
CREATE INDEX "asset_value_records_user_idx" ON "asset_value_records" USING btree ("user_id");
--> statement-breakpoint
INSERT INTO "asset_value_records" ("user_id", "asset_id", "value", "valued_on", "source", "notes")
SELECT a."user_id", a."id", a."current_value", COALESCE(a."purchase_date", a."created_at"::date), 'baseline', '历史当前估值迁移基线'
FROM "assets" a
WHERE a."asset_type" = 'one_time'
  AND a."current_value" IS NOT NULL
  AND a."deleted_at" IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM "asset_value_records" r
    WHERE r."asset_id" = a."id" AND r."source" = 'baseline'
  );
