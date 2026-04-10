CREATE TYPE "public"."poll_eligibility" AS ENUM('all', 'owners_only');--> statement-breakpoint
CREATE TYPE "public"."poll_status" AS ENUM('draft', 'open', 'closed');--> statement-breakpoint
CREATE TABLE "poll" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"community_id" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"status" "poll_status" DEFAULT 'draft' NOT NULL,
	"eligibility" "poll_eligibility" DEFAULT 'all' NOT NULL,
	"anonymous" boolean DEFAULT false NOT NULL,
	"closes_at" timestamp,
	"opened_at" timestamp,
	"closed_at" timestamp,
	"created_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "poll_option" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"poll_id" uuid NOT NULL,
	"label" varchar(255) NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "poll_response" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"poll_id" uuid NOT NULL,
	"resident_id" uuid NOT NULL,
	"option_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "poll_response_poll_id_resident_id_unique" UNIQUE("poll_id","resident_id")
);
--> statement-breakpoint
ALTER TABLE "poll" ADD CONSTRAINT "poll_community_id_community_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."community"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poll" ADD CONSTRAINT "poll_created_by_resident_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."resident"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poll_option" ADD CONSTRAINT "poll_option_poll_id_poll_id_fk" FOREIGN KEY ("poll_id") REFERENCES "public"."poll"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poll_response" ADD CONSTRAINT "poll_response_poll_id_poll_id_fk" FOREIGN KEY ("poll_id") REFERENCES "public"."poll"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poll_response" ADD CONSTRAINT "poll_response_resident_id_resident_id_fk" FOREIGN KEY ("resident_id") REFERENCES "public"."resident"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poll_response" ADD CONSTRAINT "poll_response_option_id_poll_option_id_fk" FOREIGN KEY ("option_id") REFERENCES "public"."poll_option"("id") ON DELETE no action ON UPDATE no action;