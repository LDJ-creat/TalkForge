import { relations } from "drizzle-orm";
import {
  boolean,
  doublePrecision,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import {
  AUDIO_CODECS,
  AUDIO_FORMATS,
  CEFR_LEVELS,
  CORRECTION_TYPES,
  EVALUATION_STATUSES,
  PRONUNCIATION_MODES,
  SESSION_STATUSES,
  TURN_ROLES,
} from "@/domain/enums";

export const cefrLevelEnum = pgEnum("cefr_level", CEFR_LEVELS);
export const sessionStatusEnum = pgEnum("session_status", SESSION_STATUSES);
export const turnRoleEnum = pgEnum("turn_role", TURN_ROLES);
export const evaluationStatusEnum = pgEnum(
  "evaluation_status",
  EVALUATION_STATUSES,
);
export const audioFormatEnum = pgEnum("audio_format", AUDIO_FORMATS);
export const audioCodecEnum = pgEnum("audio_codec", AUDIO_CODECS);
export const correctionTypeEnum = pgEnum("correction_type", CORRECTION_TYPES);
export const pronunciationModeEnum = pgEnum(
  "pronunciation_mode",
  PRONUNCIATION_MODES,
);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
    .notNull()
    .defaultNow(),
});

export const scenarios = pgTable("scenarios", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  level: cefrLevelEnum("level").notNull(),
  userRole: text("user_role").notNull(),
  aiRole: text("ai_role").notNull(),
  situation: text("situation").notNull(),
  mission: text("mission").notNull(),
  goals: jsonb("goals").notNull(),
  stages: jsonb("stages").notNull(),
  vocabulary: jsonb("vocabulary").notNull(),
  targetExpressions: jsonb("target_expressions").notNull(),
  constraints: jsonb("constraints").notNull(),
  exitPolicy: jsonb("exit_policy").notNull(),
  evaluationRubric: jsonb("evaluation_rubric").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
    .notNull()
    .defaultNow(),
});

export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  scenarioId: text("scenario_id")
    .notNull()
    .references(() => scenarios.id, { onDelete: "restrict" }),
  realtimeProvider: text("realtime_provider").notNull(),
  realtimeProviderSessionId: text("realtime_provider_session_id"),
  status: sessionStatusEnum("status").notNull().default("active"),
  startedAt: timestamp("started_at", { withTimezone: true, mode: "string" })
    .notNull()
    .defaultNow(),
  endedAt: timestamp("ended_at", { withTimezone: true, mode: "string" }),
});

export const scenarioProgress = pgTable("scenario_progress", {
  sessionId: uuid("session_id")
    .primaryKey()
    .references(() => sessions.id, { onDelete: "cascade" }),
  currentStageId: text("current_stage_id").notNull(),
  completedGoalIds: jsonb("completed_goal_ids").notNull().default([]),
  missingGoalIds: jsonb("missing_goal_ids").notNull().default([]),
  shouldSuggestEnding: boolean("should_suggest_ending").notNull().default(false),
  offTopic: boolean("off_topic").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
    .notNull()
    .defaultNow(),
});

export const turns = pgTable("turns", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id")
    .notNull()
    .references(() => sessions.id, { onDelete: "cascade" }),
  role: turnRoleEnum("role").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true, mode: "string" }).notNull(),
  endedAt: timestamp("ended_at", { withTimezone: true, mode: "string" }).notNull(),
  transcriptText: text("transcript_text"),
  audioSegmentId: uuid("audio_segment_id"),
  evaluationStatus: evaluationStatusEnum("evaluation_status")
    .notNull()
    .default("none"),
});

export const audioSegments = pgTable("audio_segments", {
  id: uuid("id").primaryKey().defaultRandom(),
  turnId: uuid("turn_id")
    .notNull()
    .references(() => turns.id, { onDelete: "cascade" }),
  objectKey: text("object_key").notNull(),
  format: audioFormatEnum("format").notNull(),
  codec: audioCodecEnum("codec"),
  sampleRate: integer("sample_rate"),
  durationMs: integer("duration_ms").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
    .notNull()
    .defaultNow(),
});

export const transcripts = pgTable("transcripts", {
  id: uuid("id").primaryKey().defaultRandom(),
  turnId: uuid("turn_id")
    .notNull()
    .unique()
    .references(() => turns.id, { onDelete: "cascade" }),
  provider: text("provider").notNull(),
  text: text("text").notNull(),
  confidence: doublePrecision("confidence"),
  segments: jsonb("segments").notNull(),
});

export const corrections = pgTable("corrections", {
  id: uuid("id").primaryKey().defaultRandom(),
  turnId: uuid("turn_id")
    .notNull()
    .references(() => turns.id, { onDelete: "cascade" }),
  type: correctionTypeEnum("type").notNull(),
  originalText: text("original_text").notNull(),
  correctedText: text("corrected_text"),
  explanation: text("explanation").notNull(),
  confidence: doublePrecision("confidence").notNull(),
});

export const pronunciationEvaluations = pgTable("pronunciation_evaluations", {
  id: uuid("id").primaryKey().defaultRandom(),
  turnId: uuid("turn_id")
    .notNull()
    .references(() => turns.id, { onDelete: "cascade" }),
  mode: pronunciationModeEnum("mode").notNull(),
  overallScore: doublePrecision("overall_score"),
  fluencyScore: doublePrecision("fluency_score"),
  accuracyScore: doublePrecision("accuracy_score"),
  completenessScore: doublePrecision("completeness_score"),
  prosodyScore: doublePrecision("prosody_score"),
  details: jsonb("details"),
});

export const reports = pgTable("reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id")
    .notNull()
    .unique()
    .references(() => sessions.id, { onDelete: "cascade" }),
  summary: text("summary").notNull(),
  taskCompletion: jsonb("task_completion").notNull(),
  keyCorrections: jsonb("key_corrections").notNull(),
  alternativeExpressions: jsonb("alternative_expressions").notNull(),
  shadowingRecommendations: jsonb("shadowing_recommendations").notNull(),
  nextPracticeSuggestion: text("next_practice_suggestion").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
    .notNull()
    .defaultNow(),
});

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
}));

export const scenariosRelations = relations(scenarios, ({ many }) => ({
  sessions: many(sessions),
}));

export const sessionsRelations = relations(sessions, ({ one, many }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
  scenario: one(scenarios, {
    fields: [sessions.scenarioId],
    references: [scenarios.id],
  }),
  progress: one(scenarioProgress, {
    fields: [sessions.id],
    references: [scenarioProgress.sessionId],
  }),
  turns: many(turns),
  report: one(reports, {
    fields: [sessions.id],
    references: [reports.sessionId],
  }),
}));

export const scenarioProgressRelations = relations(scenarioProgress, ({ one }) => ({
  session: one(sessions, {
    fields: [scenarioProgress.sessionId],
    references: [sessions.id],
  }),
}));

export const turnsRelations = relations(turns, ({ one, many }) => ({
  session: one(sessions, {
    fields: [turns.sessionId],
    references: [sessions.id],
  }),
  audioSegment: one(audioSegments, {
    fields: [turns.audioSegmentId],
    references: [audioSegments.id],
  }),
  transcripts: many(transcripts),
  corrections: many(corrections),
  pronunciationEvaluations: many(pronunciationEvaluations),
}));

export const audioSegmentsRelations = relations(audioSegments, ({ one }) => ({
  turn: one(turns, {
    fields: [audioSegments.turnId],
    references: [turns.id],
  }),
}));

export const transcriptsRelations = relations(transcripts, ({ one }) => ({
  turn: one(turns, {
    fields: [transcripts.turnId],
    references: [turns.id],
  }),
}));

export const correctionsRelations = relations(corrections, ({ one }) => ({
  turn: one(turns, {
    fields: [corrections.turnId],
    references: [turns.id],
  }),
}));

export const pronunciationEvaluationsRelations = relations(
  pronunciationEvaluations,
  ({ one }) => ({
    turn: one(turns, {
      fields: [pronunciationEvaluations.turnId],
      references: [turns.id],
    }),
  }),
);

export const reportsRelations = relations(reports, ({ one }) => ({
  session: one(sessions, {
    fields: [reports.sessionId],
    references: [sessions.id],
  }),
}));

export type DbUser = typeof users.$inferSelect;
export type DbScenario = typeof scenarios.$inferSelect;
export type DbSession = typeof sessions.$inferSelect;
export type DbScenarioProgress = typeof scenarioProgress.$inferSelect;
export type DbTurn = typeof turns.$inferSelect;
export type DbAudioSegment = typeof audioSegments.$inferSelect;
export type DbTranscript = typeof transcripts.$inferSelect;
export type DbCorrection = typeof corrections.$inferSelect;
export type DbPronunciationEvaluation =
  typeof pronunciationEvaluations.$inferSelect;
export type DbReport = typeof reports.$inferSelect;

export type NewDbScenario = typeof scenarios.$inferInsert;
export type NewDbSession = typeof sessions.$inferInsert;
export type NewDbTurn = typeof turns.$inferInsert;
export type NewDbAudioSegment = typeof audioSegments.$inferInsert;
export type NewDbTranscript = typeof transcripts.$inferInsert;
export type NewDbCorrection = typeof corrections.$inferInsert;
export type NewDbPronunciationEvaluation =
  typeof pronunciationEvaluations.$inferInsert;
export type NewDbReport = typeof reports.$inferInsert;

export const schema = {
  users,
  scenarios,
  sessions,
  scenarioProgress,
  turns,
  audioSegments,
  transcripts,
  corrections,
  pronunciationEvaluations,
  reports,
  usersRelations,
  scenariosRelations,
  sessionsRelations,
  scenarioProgressRelations,
  turnsRelations,
  audioSegmentsRelations,
  transcriptsRelations,
  correctionsRelations,
  pronunciationEvaluationsRelations,
  reportsRelations,
};
