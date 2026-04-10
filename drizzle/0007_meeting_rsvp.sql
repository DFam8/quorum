CREATE TYPE "meeting_rsvp_status" AS ENUM('attending', 'not_attending');

CREATE TABLE "meeting_rsvp" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "meeting_id" uuid NOT NULL REFERENCES "meeting"("id") ON DELETE CASCADE,
  "resident_id" uuid NOT NULL REFERENCES "resident"("id") ON DELETE CASCADE,
  "status" "meeting_rsvp_status" NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "meeting_rsvp_meeting_id_resident_id_unique" UNIQUE("meeting_id","resident_id")
);
