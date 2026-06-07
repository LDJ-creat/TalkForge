CREATE TYPE "public"."shadowing_item_source" AS ENUM('scenario_target_expression', 'report_recommendation', 'corrected_expression', 'manual');--> statement-breakpoint
CREATE TABLE "shadowing_items" (
	"id" text PRIMARY KEY NOT NULL,
	"session_id" uuid NOT NULL,
	"standard_text" text NOT NULL,
	"original_text" text,
	"reason" text,
	"source" "shadowing_item_source" NOT NULL,
	"turn_id" uuid,
	"sort_order" integer NOT NULL,
	"standard_audio" jsonb,
	"standard_audio_status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "shadowing_items" ADD CONSTRAINT "shadowing_items_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shadowing_items" ADD CONSTRAINT "shadowing_items_turn_id_turns_id_fk" FOREIGN KEY ("turn_id") REFERENCES "public"."turns"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "shadowing_items_session_sort_idx" ON "shadowing_items" USING btree ("session_id","sort_order");