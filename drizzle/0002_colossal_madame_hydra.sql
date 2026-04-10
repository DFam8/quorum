CREATE TABLE "thread" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"community_id" uuid NOT NULL,
	"subject" varchar(255) NOT NULL,
	"created_by" uuid NOT NULL,
	"recipient_type" varchar(20) NOT NULL,
	"recipient_id" uuid,
	"last_message_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "resident" ADD COLUMN "allow_direct_messages" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "thread" ADD CONSTRAINT "thread_community_id_community_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."community"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "thread" ADD CONSTRAINT "thread_created_by_resident_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."resident"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message" ADD CONSTRAINT "message_thread_id_thread_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."thread"("id") ON DELETE no action ON UPDATE no action;