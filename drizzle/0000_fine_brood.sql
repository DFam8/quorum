CREATE TYPE "public"."agenda_status" AS ENUM('draft', 'published');--> statement-breakpoint
CREATE TYPE "public"."ai_input_type" AS ENUM('draft', 'prompt');--> statement-breakpoint
CREATE TYPE "public"."ai_mode" AS ENUM('polish', 'rewrite', 'suggest');--> statement-breakpoint
CREATE TYPE "public"."ai_tone" AS ENUM('formal', 'friendly', 'neutral');--> statement-breakpoint
CREATE TYPE "public"."ballot_choice" AS ENUM('yes', 'no', 'abstain');--> statement-breakpoint
CREATE TYPE "public"."board_acceptance_decision" AS ENUM('accepted', 'not_accepted');--> statement-breakpoint
CREATE TYPE "public"."booking_status" AS ENUM('confirmed', 'cancelled', 'overridden');--> statement-breakpoint
CREATE TYPE "public"."committee_member_status" AS ENUM('pending', 'member', 'removed');--> statement-breakpoint
CREATE TYPE "public"."committee_mode" AS ENUM('auto_approve', 'manual', 'invite_only');--> statement-breakpoint
CREATE TYPE "public"."committee_status" AS ENUM('active', 'archived');--> statement-breakpoint
CREATE TYPE "public"."context_type" AS ENUM('community', 'committee');--> statement-breakpoint
CREATE TYPE "public"."facility_status" AS ENUM('open', 'closed', 'under_maintenance');--> statement-breakpoint
CREATE TYPE "public"."household_status" AS ENUM('active', 'moved_out');--> statement-breakpoint
CREATE TYPE "public"."invite_status" AS ENUM('pending', 'accepted', 'expired');--> statement-breakpoint
CREATE TYPE "public"."maintenance_priority" AS ENUM('urgent', 'routine');--> statement-breakpoint
CREATE TYPE "public"."maintenance_status" AS ENUM('open', 'in_progress', 'resolved');--> statement-breakpoint
CREATE TYPE "public"."meeting_status" AS ENUM('scheduled', 'held', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."minutes_decision" AS ENUM('approved', 'changes_requested');--> statement-breakpoint
CREATE TYPE "public"."minutes_status" AS ENUM('drafting', 'in_review', 'approved', 'published');--> statement-breakpoint
CREATE TYPE "public"."notification_category" AS ENUM('urgent_announcement', 'violation', 'vote_result', 'board_dm', 'general_announcement', 'vote_reminder', 'agenda_published', 'minutes_published', 'maintenance_update', 'forum_activity', 'dm');--> statement-breakpoint
CREATE TYPE "public"."notification_channel" AS ENUM('email', 'in_app', 'sms');--> statement-breakpoint
CREATE TYPE "public"."notification_status" AS ENUM('queued', 'sent', 'delivered', 'failed');--> statement-breakpoint
CREATE TYPE "public"."quorum_failure_mode" AS ENUM('rerun', 'auto_extend', 'super_admin_override');--> statement-breakpoint
CREATE TYPE "public"."resident_type" AS ENUM('owner', 'renter');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('super_admin', 'board_member', 'committee_lead');--> statement-breakpoint
CREATE TYPE "public"."unit_type" AS ENUM('condo', 'apartment', 'sfh');--> statement-breakpoint
CREATE TYPE "public"."vote_status" AS ENUM('pending_approval', 'open', 'closed', 'failed', 'accepted', 'published');--> statement-breakpoint
CREATE TYPE "public"."vote_type" AS ENUM('election', 'budget', 'bylaw', 'improvement');--> statement-breakpoint
CREATE TABLE "agenda" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"meeting_id" uuid NOT NULL,
	"status" "agenda_status" DEFAULT 'draft' NOT NULL,
	"comments_enabled" boolean DEFAULT false NOT NULL,
	"published_at" timestamp,
	"items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agenda_comment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agenda_id" uuid NOT NULL,
	"resident_id" uuid NOT NULL,
	"body" text NOT NULL,
	"hidden" boolean DEFAULT false NOT NULL,
	"hidden_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "announcement" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"community_id" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"body" text NOT NULL,
	"priority" varchar(20) DEFAULT 'general' NOT NULL,
	"pinned" boolean DEFAULT false NOT NULL,
	"hidden" boolean DEFAULT false NOT NULL,
	"hidden_reason" text,
	"created_by" uuid NOT NULL,
	"ai_assisted" boolean DEFAULT false,
	"ai_mode" "ai_mode",
	"ai_tone" "ai_tone",
	"ai_input" text,
	"ai_input_type" "ai_input_type",
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"community_id" uuid NOT NULL,
	"actor_id" uuid,
	"action" varchar(255) NOT NULL,
	"entity_type" varchar(100) NOT NULL,
	"entity_id" uuid,
	"before" jsonb,
	"after" jsonb,
	"ip_address" varchar(50),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ballot" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vote_id" uuid NOT NULL,
	"household_id" uuid NOT NULL,
	"cast_by" uuid NOT NULL,
	"choice" "ballot_choice" NOT NULL,
	"cast_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ballot_vote_id_household_id_unique" UNIQUE("vote_id","household_id")
);
--> statement-breakpoint
CREATE TABLE "board_acceptance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vote_id" uuid NOT NULL,
	"resident_id" uuid NOT NULL,
	"decision" "board_acceptance_decision" NOT NULL,
	"notes" text,
	"voted_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "booking" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"facility_id" uuid NOT NULL,
	"household_id" uuid NOT NULL,
	"booked_by" uuid NOT NULL,
	"starts_at" timestamp NOT NULL,
	"ends_at" timestamp NOT NULL,
	"guest_count" integer,
	"notes" text,
	"status" "booking_status" DEFAULT 'confirmed' NOT NULL,
	"cancelled_by" uuid,
	"cancel_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "committee_member" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"committee_id" uuid NOT NULL,
	"resident_id" uuid NOT NULL,
	"status" "committee_member_status" DEFAULT 'pending' NOT NULL,
	"invited_by" uuid,
	"joined_at" timestamp,
	"removed_at" timestamp,
	"removal_reason" text
);
--> statement-breakpoint
CREATE TABLE "community" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"address" varchar(500),
	"timezone" varchar(100) DEFAULT 'America/Chicago' NOT NULL,
	"max_super_admins" integer DEFAULT 2 NOT NULL,
	"max_occupants_per_unit" integer DEFAULT 6 NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"community_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"category" varchar(100) NOT NULL,
	"file_url" varchar(500) NOT NULL,
	"file_size_bytes" integer,
	"version" integer DEFAULT 1 NOT NULL,
	"change_note" text,
	"parent_id" uuid,
	"uploaded_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "facility" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"community_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"capacity" integer,
	"status" "facility_status" DEFAULT 'open' NOT NULL,
	"booking_restrictions" jsonb DEFAULT '{}'::jsonb,
	"hours" jsonb DEFAULT '{}'::jsonb,
	"archived_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "household" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"unit_id" uuid NOT NULL,
	"primary_resident_id" uuid,
	"status" "household_status" DEFAULT 'active' NOT NULL,
	"move_in_date" date,
	"move_out_date" date,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "maintenance_request" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"facility_id" uuid NOT NULL,
	"submitted_by" uuid NOT NULL,
	"assigned_to" uuid,
	"title" varchar(255) NOT NULL,
	"description" text,
	"photo_urls" jsonb DEFAULT '[]'::jsonb,
	"priority" "maintenance_priority" DEFAULT 'routine' NOT NULL,
	"status" "maintenance_status" DEFAULT 'open' NOT NULL,
	"resolution_notes" text,
	"resolved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meeting" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"community_id" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"meeting_type" varchar(100),
	"location" varchar(255),
	"scheduled_at" timestamp NOT NULL,
	"status" "meeting_status" DEFAULT 'scheduled' NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "message" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"thread_id" uuid NOT NULL,
	"sender_id" uuid NOT NULL,
	"body" text NOT NULL,
	"hidden" boolean DEFAULT false NOT NULL,
	"hidden_reason" text,
	"read_at" timestamp,
	"ai_assisted" boolean DEFAULT false,
	"ai_mode" "ai_mode",
	"ai_tone" "ai_tone",
	"ai_input" text,
	"ai_input_type" "ai_input_type",
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "minutes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"meeting_id" uuid NOT NULL,
	"status" "minutes_status" DEFAULT 'drafting' NOT NULL,
	"body" text,
	"imported_doc_url" varchar(500),
	"last_edited_by" uuid,
	"last_edited_at" timestamp,
	"finalized_at" timestamp,
	"published_at" timestamp,
	"reminder_sent_at" timestamp,
	"escalation_sent_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "minutes_approval" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"minutes_id" uuid NOT NULL,
	"resident_id" uuid NOT NULL,
	"decision" "minutes_decision" NOT NULL,
	"round" integer DEFAULT 1 NOT NULL,
	"notes" text,
	"voted_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"resident_id" uuid NOT NULL,
	"category" "notification_category" NOT NULL,
	"channel" "notification_channel" NOT NULL,
	"subject" varchar(500),
	"body" text,
	"mandatory" boolean DEFAULT false NOT NULL,
	"status" "notification_status" DEFAULT 'queued' NOT NULL,
	"sent_at" timestamp,
	"read_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resident" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"email" varchar(255) NOT NULL,
	"phone" varchar(50),
	"first_name" varchar(100) NOT NULL,
	"last_name" varchar(100) NOT NULL,
	"resident_type" "resident_type" NOT NULL,
	"directory_opt_out" boolean DEFAULT false NOT NULL,
	"invite_status" "invite_status" DEFAULT 'pending' NOT NULL,
	"invite_token" varchar(255),
	"invite_expires_at" timestamp,
	"last_login_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "resident_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "resident_role" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"resident_id" uuid NOT NULL,
	"role" "role" NOT NULL,
	"rank" integer,
	"title" varchar(100),
	"context_id" uuid NOT NULL,
	"context_type" "context_type" NOT NULL,
	"temporary" boolean DEFAULT false NOT NULL,
	"temporary_reason" varchar(255),
	"granted_by" uuid,
	"granted_at" timestamp DEFAULT now() NOT NULL,
	"revoked_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "segment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"community_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"created_by" uuid NOT NULL,
	"filter_criteria" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"last_evaluated_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sub_committee" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"community_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"purpose" text,
	"lead_resident_id" uuid,
	"membership_mode" "committee_mode" DEFAULT 'manual' NOT NULL,
	"status" "committee_status" DEFAULT 'active' NOT NULL,
	"archived_at" timestamp,
	"created_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "unit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"community_id" uuid NOT NULL,
	"unit_number" varchar(50) NOT NULL,
	"unit_type" "unit_type" NOT NULL,
	"building" varchar(100),
	"floor" integer,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "unit_unit_number_unique" UNIQUE("unit_number")
);
--> statement-breakpoint
CREATE TABLE "vote" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"community_id" uuid NOT NULL,
	"parent_vote_id" uuid,
	"run_number" integer DEFAULT 1 NOT NULL,
	"vote_type" "vote_type" NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"threshold_pct" numeric(5, 2) NOT NULL,
	"quorum_pct" numeric(5, 2) NOT NULL,
	"quorum_failure_mode" "quorum_failure_mode" DEFAULT 'rerun' NOT NULL,
	"max_reruns" integer DEFAULT 3 NOT NULL,
	"status" "vote_status" DEFAULT 'pending_approval' NOT NULL,
	"opens_at" timestamp,
	"closes_at" timestamp,
	"created_by" uuid NOT NULL,
	"approved_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agenda" ADD CONSTRAINT "agenda_meeting_id_meeting_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meeting"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agenda_comment" ADD CONSTRAINT "agenda_comment_agenda_id_agenda_id_fk" FOREIGN KEY ("agenda_id") REFERENCES "public"."agenda"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agenda_comment" ADD CONSTRAINT "agenda_comment_resident_id_resident_id_fk" FOREIGN KEY ("resident_id") REFERENCES "public"."resident"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "announcement" ADD CONSTRAINT "announcement_community_id_community_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."community"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "announcement" ADD CONSTRAINT "announcement_created_by_resident_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."resident"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_community_id_community_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."community"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_id_resident_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."resident"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ballot" ADD CONSTRAINT "ballot_vote_id_vote_id_fk" FOREIGN KEY ("vote_id") REFERENCES "public"."vote"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ballot" ADD CONSTRAINT "ballot_household_id_household_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."household"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ballot" ADD CONSTRAINT "ballot_cast_by_resident_id_fk" FOREIGN KEY ("cast_by") REFERENCES "public"."resident"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board_acceptance" ADD CONSTRAINT "board_acceptance_vote_id_vote_id_fk" FOREIGN KEY ("vote_id") REFERENCES "public"."vote"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board_acceptance" ADD CONSTRAINT "board_acceptance_resident_id_resident_id_fk" FOREIGN KEY ("resident_id") REFERENCES "public"."resident"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking" ADD CONSTRAINT "booking_facility_id_facility_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facility"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking" ADD CONSTRAINT "booking_household_id_household_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."household"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking" ADD CONSTRAINT "booking_booked_by_resident_id_fk" FOREIGN KEY ("booked_by") REFERENCES "public"."resident"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking" ADD CONSTRAINT "booking_cancelled_by_resident_id_fk" FOREIGN KEY ("cancelled_by") REFERENCES "public"."resident"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "committee_member" ADD CONSTRAINT "committee_member_committee_id_sub_committee_id_fk" FOREIGN KEY ("committee_id") REFERENCES "public"."sub_committee"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "committee_member" ADD CONSTRAINT "committee_member_resident_id_resident_id_fk" FOREIGN KEY ("resident_id") REFERENCES "public"."resident"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "committee_member" ADD CONSTRAINT "committee_member_invited_by_resident_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."resident"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document" ADD CONSTRAINT "document_community_id_community_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."community"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document" ADD CONSTRAINT "document_uploaded_by_resident_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."resident"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facility" ADD CONSTRAINT "facility_community_id_community_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."community"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "household" ADD CONSTRAINT "household_unit_id_unit_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."unit"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_request" ADD CONSTRAINT "maintenance_request_facility_id_facility_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facility"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_request" ADD CONSTRAINT "maintenance_request_submitted_by_resident_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "public"."resident"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_request" ADD CONSTRAINT "maintenance_request_assigned_to_resident_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."resident"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting" ADD CONSTRAINT "meeting_community_id_community_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."community"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting" ADD CONSTRAINT "meeting_created_by_resident_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."resident"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message" ADD CONSTRAINT "message_sender_id_resident_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."resident"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "minutes" ADD CONSTRAINT "minutes_meeting_id_meeting_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meeting"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "minutes" ADD CONSTRAINT "minutes_last_edited_by_resident_id_fk" FOREIGN KEY ("last_edited_by") REFERENCES "public"."resident"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "minutes_approval" ADD CONSTRAINT "minutes_approval_minutes_id_minutes_id_fk" FOREIGN KEY ("minutes_id") REFERENCES "public"."minutes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "minutes_approval" ADD CONSTRAINT "minutes_approval_resident_id_resident_id_fk" FOREIGN KEY ("resident_id") REFERENCES "public"."resident"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_resident_id_resident_id_fk" FOREIGN KEY ("resident_id") REFERENCES "public"."resident"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resident" ADD CONSTRAINT "resident_household_id_household_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."household"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resident_role" ADD CONSTRAINT "resident_role_resident_id_resident_id_fk" FOREIGN KEY ("resident_id") REFERENCES "public"."resident"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resident_role" ADD CONSTRAINT "resident_role_granted_by_resident_id_fk" FOREIGN KEY ("granted_by") REFERENCES "public"."resident"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "segment" ADD CONSTRAINT "segment_community_id_community_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."community"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "segment" ADD CONSTRAINT "segment_created_by_resident_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."resident"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sub_committee" ADD CONSTRAINT "sub_committee_community_id_community_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."community"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sub_committee" ADD CONSTRAINT "sub_committee_lead_resident_id_resident_id_fk" FOREIGN KEY ("lead_resident_id") REFERENCES "public"."resident"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sub_committee" ADD CONSTRAINT "sub_committee_created_by_resident_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."resident"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unit" ADD CONSTRAINT "unit_community_id_community_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."community"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vote" ADD CONSTRAINT "vote_community_id_community_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."community"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vote" ADD CONSTRAINT "vote_parent_vote_id_vote_id_fk" FOREIGN KEY ("parent_vote_id") REFERENCES "public"."vote"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vote" ADD CONSTRAINT "vote_created_by_resident_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."resident"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vote" ADD CONSTRAINT "vote_approved_by_resident_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."resident"("id") ON DELETE no action ON UPDATE no action;