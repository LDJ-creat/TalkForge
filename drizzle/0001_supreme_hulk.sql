CREATE TYPE "public"."ai_invocation_operation" AS ENUM('realtime.session.create', 'asr.transcribe', 'llm.correction', 'llm.report', 'llm.scenarioJudge', 'tts.generate', 'pronunciation.evaluate');--> statement-breakpoint
CREATE TYPE "public"."ai_invocation_status" AS ENUM('success', 'failed', 'timeout', 'rate_limited');--> statement-breakpoint
CREATE TABLE "ai_invocation_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid,
	"turn_id" uuid,
	"job_id" text,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"operation" "ai_invocation_operation" NOT NULL,
	"prompt_version" text,
	"input_object_key" text,
	"output_object_key" text,
	"request_summary" jsonb,
	"response_summary" jsonb,
	"raw_request_object_key" text,
	"raw_response_object_key" text,
	"status" "ai_invocation_status" NOT NULL,
	"latency_ms" integer NOT NULL,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"input_tokens" integer,
	"output_tokens" integer,
	"audio_duration_ms" integer,
	"cost_estimate" double precision,
	"error_code" text,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_invocation_logs" ADD CONSTRAINT "ai_invocation_logs_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_invocation_logs" ADD CONSTRAINT "ai_invocation_logs_turn_id_turns_id_fk" FOREIGN KEY ("turn_id") REFERENCES "public"."turns"("id") ON DELETE set null ON UPDATE no action;
