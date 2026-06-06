CREATE TYPE "public"."audio_codec" AS ENUM('opus', 'pcm_s16le');--> statement-breakpoint
CREATE TYPE "public"."audio_format" AS ENUM('webm', 'wav', 'pcm');--> statement-breakpoint
CREATE TYPE "public"."cefr_level" AS ENUM('A1', 'A2', 'B1', 'B2', 'C1');--> statement-breakpoint
CREATE TYPE "public"."correction_type" AS ENUM('grammar', 'expression', 'vocabulary', 'clarity', 'asr_uncertain');--> statement-breakpoint
CREATE TYPE "public"."evaluation_status" AS ENUM('none', 'pending', 'processing', 'done', 'failed');--> statement-breakpoint
CREATE TYPE "public"."pronunciation_mode" AS ENUM('free_speech', 'shadowing');--> statement-breakpoint
CREATE TYPE "public"."session_status" AS ENUM('active', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."turn_role" AS ENUM('user', 'assistant');--> statement-breakpoint
CREATE TABLE "audio_segments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"turn_id" uuid NOT NULL,
	"object_key" text NOT NULL,
	"format" "audio_format" NOT NULL,
	"codec" "audio_codec",
	"sample_rate" integer,
	"duration_ms" integer NOT NULL,
	"size_bytes" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "corrections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"turn_id" uuid NOT NULL,
	"type" "correction_type" NOT NULL,
	"original_text" text NOT NULL,
	"corrected_text" text,
	"explanation" text NOT NULL,
	"confidence" double precision NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pronunciation_evaluations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"turn_id" uuid NOT NULL,
	"mode" "pronunciation_mode" NOT NULL,
	"overall_score" double precision,
	"fluency_score" double precision,
	"accuracy_score" double precision,
	"completeness_score" double precision,
	"prosody_score" double precision,
	"details" jsonb
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"summary" text NOT NULL,
	"task_completion" jsonb NOT NULL,
	"key_corrections" jsonb NOT NULL,
	"alternative_expressions" jsonb NOT NULL,
	"shadowing_recommendations" jsonb NOT NULL,
	"next_practice_suggestion" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reports_session_id_unique" UNIQUE("session_id")
);
--> statement-breakpoint
CREATE TABLE "scenario_progress" (
	"session_id" uuid PRIMARY KEY NOT NULL,
	"current_stage_id" text NOT NULL,
	"completed_goal_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"missing_goal_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"should_suggest_ending" boolean DEFAULT false NOT NULL,
	"off_topic" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scenarios" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"level" "cefr_level" NOT NULL,
	"user_role" text NOT NULL,
	"ai_role" text NOT NULL,
	"situation" text NOT NULL,
	"mission" text NOT NULL,
	"goals" jsonb NOT NULL,
	"stages" jsonb NOT NULL,
	"vocabulary" jsonb NOT NULL,
	"target_expressions" jsonb NOT NULL,
	"constraints" jsonb NOT NULL,
	"exit_policy" jsonb NOT NULL,
	"evaluation_rubric" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"scenario_id" text NOT NULL,
	"realtime_provider" text NOT NULL,
	"realtime_provider_session_id" text,
	"status" "session_status" DEFAULT 'active' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "transcripts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"turn_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"text" text NOT NULL,
	"confidence" double precision,
	"segments" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "turns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"role" "turn_role" NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone NOT NULL,
	"transcript_text" text,
	"audio_segment_id" uuid,
	"evaluation_status" "evaluation_status" DEFAULT 'none' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audio_segments" ADD CONSTRAINT "audio_segments_turn_id_turns_id_fk" FOREIGN KEY ("turn_id") REFERENCES "public"."turns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "corrections" ADD CONSTRAINT "corrections_turn_id_turns_id_fk" FOREIGN KEY ("turn_id") REFERENCES "public"."turns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pronunciation_evaluations" ADD CONSTRAINT "pronunciation_evaluations_turn_id_turns_id_fk" FOREIGN KEY ("turn_id") REFERENCES "public"."turns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenario_progress" ADD CONSTRAINT "scenario_progress_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_scenario_id_scenarios_id_fk" FOREIGN KEY ("scenario_id") REFERENCES "public"."scenarios"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transcripts" ADD CONSTRAINT "transcripts_turn_id_turns_id_fk" FOREIGN KEY ("turn_id") REFERENCES "public"."turns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "turns" ADD CONSTRAINT "turns_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;