CREATE TABLE "unit_maintenance_request" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "community_id" uuid NOT NULL REFERENCES "community"("id") ON DELETE CASCADE,
  "unit_id" uuid NOT NULL REFERENCES "unit"("id") ON DELETE CASCADE,
  "submitted_by" uuid NOT NULL REFERENCES "resident"("id") ON DELETE CASCADE,
  "title" varchar(255) NOT NULL,
  "description" text,
  "priority" "maintenance_priority" NOT NULL DEFAULT 'routine',
  "status" "maintenance_status" NOT NULL DEFAULT 'open',
  "board_notes" text,
  "resolved_at" timestamp,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);
