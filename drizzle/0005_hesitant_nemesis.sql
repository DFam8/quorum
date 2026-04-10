CREATE TABLE "passkey_credential" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"community_id" uuid NOT NULL,
	"resident_id" uuid NOT NULL,
	"credential_id" varchar(1024) NOT NULL,
	"public_key" text NOT NULL,
	"counter" integer DEFAULT 0 NOT NULL,
	"device_type" varchar(32) NOT NULL,
	"backed_up" boolean DEFAULT false NOT NULL,
	"transports" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"last_used_at" timestamp,
	CONSTRAINT "passkey_credential_credential_id_unique" UNIQUE("credential_id")
);
--> statement-breakpoint
ALTER TABLE "passkey_credential" ADD CONSTRAINT "passkey_credential_community_id_community_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."community"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "passkey_credential" ADD CONSTRAINT "passkey_credential_resident_id_resident_id_fk" FOREIGN KEY ("resident_id") REFERENCES "public"."resident"("id") ON DELETE cascade ON UPDATE no action;