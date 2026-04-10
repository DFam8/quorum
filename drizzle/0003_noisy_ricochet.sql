ALTER TABLE "community" ALTER COLUMN "max_occupants_per_unit" SET DEFAULT 8;--> statement-breakpoint
ALTER TABLE "resident" ADD COLUMN "notification_settings" jsonb DEFAULT '{}'::jsonb;