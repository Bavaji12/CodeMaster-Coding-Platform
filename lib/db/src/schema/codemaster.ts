import { createInsertSchema } from "drizzle-zod";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export type ProblemExample = {
  input: string;
  output: string;
  explanation: string | null;
};

export type ProblemTestCase = {
  input: string;
  output: string;
};

export const usersTable = pgTable(
  "codemaster_users",
  {
    id: serial("id").primaryKey(),
    username: varchar("username", { length: 24 }).notNull(),
    name: varchar("name", { length: 80 }).notNull(),
    email: varchar("email", { length: 254 }).notNull(),
    passwordHash: text("password_hash").notNull(),
    role: varchar("role", { length: 16 }).notNull().default("user"),
    avatar: text("avatar"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("codemaster_users_username_unique").on(table.username),
    uniqueIndex("codemaster_users_email_unique").on(table.email),
  ],
);

export const problemsTable = pgTable(
  "codemaster_problems",
  {
    id: serial("id").primaryKey(),
    slug: varchar("slug", { length: 200 }).notNull(),
    title: varchar("title", { length: 180 }).notNull(),
    description: text("description").notNull(),
    difficulty: varchar("difficulty", { length: 12 }).notNull(),
    topics: text("topics").array().notNull().default([]),
    constraints: jsonb("constraints").$type<string[]>().notNull().default([]),
    examples: jsonb("examples")
      .$type<ProblemExample[]>()
      .notNull()
      .default([]),
    starterCode: jsonb("starter_code")
      .$type<Record<string, string>>()
      .notNull()
      .default({}),
    supportedLanguages: text("supported_languages")
      .array()
      .notNull()
      .default(["javascript", "python", "java", "cpp"]),
    testCases: jsonb("test_cases")
      .$type<ProblemTestCase[]>()
      .notNull()
      .default([]),
    hiddenTestCases: jsonb("hidden_test_cases")
      .$type<ProblemTestCase[]>()
      .notNull()
      .default([]),
    active: boolean("active").notNull().default(true),
    createdBy: integer("created_by").references(() => usersTable.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("codemaster_problems_slug_unique").on(table.slug),
    index("codemaster_problems_difficulty_idx").on(table.difficulty),
    index("codemaster_problems_active_idx").on(table.active),
  ],
);

export const submissionsTable = pgTable(
  "codemaster_submissions",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    problemId: integer("problem_id")
      .notNull()
      .references(() => problemsTable.id, { onDelete: "cascade" }),
    language: varchar("language", { length: 16 }).notNull(),
    code: text("code").notNull(),
    status: varchar("status", { length: 40 }).notNull(),
    runtime: integer("runtime"),
    memory: integer("memory"),
    testCasesPassed: integer("test_cases_passed").notNull().default(0),
    totalTestCases: integer("total_test_cases").notNull().default(0),
    errorMessage: text("error_message"),
    submittedAt: timestamp("submitted_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("codemaster_submissions_user_date_idx").on(
      table.userId,
      table.submittedAt,
    ),
    index("codemaster_submissions_problem_status_idx").on(
      table.problemId,
      table.status,
    ),
  ],
);

export const insertUserSchema = createInsertSchema(usersTable).omit({
  id: true,
  createdAt: true,
});
export const insertProblemSchema = createInsertSchema(problemsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertSubmissionSchema = createInsertSchema(
  submissionsTable,
).omit({ id: true, submittedAt: true });

export type User = typeof usersTable.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Problem = typeof problemsTable.$inferSelect;
export type InsertProblem = z.infer<typeof insertProblemSchema>;
export type Submission = typeof submissionsTable.$inferSelect;
export type InsertSubmission = z.infer<typeof insertSubmissionSchema>;