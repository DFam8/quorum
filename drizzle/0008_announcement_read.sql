CREATE TABLE "announcement_read" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "announcement_id" uuid NOT NULL REFERENCES "announcement"("id") ON DELETE CASCADE,
  "resident_id" uuid NOT NULL REFERENCES "resident"("id") ON DELETE CASCADE,
  "read_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "announcement_read_announcement_id_resident_id_unique" UNIQUE("announcement_id","resident_id")
);
