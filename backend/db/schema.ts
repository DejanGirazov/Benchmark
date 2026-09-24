import {
  pgTable,
  uuid,
  text,
  varchar,
  timestamp,
  integer,
  real,
  jsonb,
  pgEnum,
  unique,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ---------- Enums ----------

export const testStatusEnum = pgEnum("test_status", [
  "pending",
  "running",
  "completed",
  "failed",
  "cancelled",
]);

export const generatorStatusEnum = pgEnum("generator_status", [
  "online",
  "offline",
  "busy",
]);

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: varchar("email", { length: 200 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ---------- Projects ----------

export const projects = pgTable("projects", {
  id: uuid("id").defaultRandom().primaryKey(),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 200 }).notNull(),
  description: text("description"),
  baseUrl: varchar("base_url", { length: 200 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ---------- Workflows ----------

export const workflows = pgTable("workflows", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 200 }).notNull(),
  description: text("description"),
  definition: jsonb("definition").notNull().$type<WorkflowDefinition>(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export interface WorkflowStep {
  id: string;
  name: string;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  headers?: Record<string, string>;
  body?: unknown;
  extract?: Record<string, string>;
  delayMsRange?: [number, number];
}

export interface WorkflowDefinition {
  steps: WorkflowStep[];
}

// ---------- Test configs / runs ----------

export const tests = pgTable("tests", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 200 }),
  status: testStatusEnum("status").default("pending").notNull(),
  targetUrl:varchar("target_url", { length: 200 }).notNull(),

  virtualUsers: integer("virtual_users").notNull(),
  durationSeconds: integer("duration_seconds").notNull(),
  rampUpSeconds: integer("ramp_up_seconds").notNull().default(0),

  config: jsonb("config").$type<Record<string, unknown>>().default({}),

  scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
  startedAt: timestamp("started_at", { withTimezone: true }),
  endedAt: timestamp("ended_at", { withTimezone: true }),

  summary: jsonb("summary").$type<TestSummary | null>(),

  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export interface TestSummary {
  totalRequests: number;
  totalErrors: number;
  avgRps: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  errorRate: number;
}

export const testWorkflows = pgTable(
  "test_workflows",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    testId: uuid("test_id")
      .notNull()
      .references(() => tests.id, { onDelete: "cascade" }),

    workflowId: uuid("workflow_id")
      .notNull()
      .references(() => workflows.id, { onDelete: "restrict" }),

    weight: integer("weight").notNull(),
  },
  (table) => [unique().on(table.testId, table.workflowId)],
);

// ---------- Generators ----------

export const generators = pgTable("generators", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  status: generatorStatusEnum("status").default("offline").notNull(),
  capacity: jsonb("capacity").$type<GeneratorCapacity>(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export interface GeneratorCapacity {
  maxVirtualUsers: number;
  cpuCores: number;
  label?: string;
}

// ---------- Test <-> Generator assignment ----------

export const testGeneratorAssignments = pgTable("test_generator_assignments", {
  id: uuid("id").defaultRandom().primaryKey(),
  testId: uuid("test_id")
    .notNull()
    .references(() => tests.id, { onDelete: "cascade" }),
  generatorId: uuid("generator_id")
    .notNull()
    .references(() => generators.id, { onDelete: "restrict" }),
  assignedUsers: integer("assigned_users").notNull(),
});

// ---------- Metrics (time series) ----------

export const metrics = pgTable("metrics", {
  id: uuid("id").defaultRandom().primaryKey(),
  testId: uuid("test_id")
    .notNull()
    .references(() => tests.id, { onDelete: "cascade" }),
  generatorId: uuid("generator_id")
    .notNull()
    .references(() => generators.id, { onDelete: "cascade" }),
  timestamp: timestamp("timestamp", { withTimezone: true }).notNull(),

  activeUsers: integer("active_users").notNull(),
  requestCount: integer("request_count").notNull(),
  errorCount: integer("error_count").notNull(),
  rps: real("rps").notNull(),
  p50LatencyMs: real("p50_latency_ms"),
  p95LatencyMs: real("p95_latency_ms"),
  p99LatencyMs: real("p99_latency_ms"),

  raw: jsonb("raw").$type<Record<string, unknown>>(),
});

// ---------- Relations ----------

export const projectsRelations = relations(projects, ({ many }) => ({
  workflows: many(workflows),
  tests: many(tests),
}));

export const testsRelations = relations(tests, ({ one, many }) => ({
  project: one(projects, {
    fields: [tests.projectId],
    references: [projects.id],
  }),
  workflows: many(testWorkflows),
  assignments: many(testGeneratorAssignments),
  metrics: many(metrics),
}));

export const generatorsRelations = relations(generators, ({ many }) => ({
  assignments: many(testGeneratorAssignments),
  metrics: many(metrics),
}));

export const workflowsRelations = relations(
  workflows,
  ({ one, many }) => ({
    project: one(projects, {
      fields: [workflows.projectId],
      references: [projects.id],
    }),
    testWorkflows: many(testWorkflows),
  })
);

export const testWorkflowsRelations = relations(
  testWorkflows,
  ({ one }) => ({
    test: one(tests, {
      fields: [testWorkflows.testId],
      references: [tests.id],
    }),
    workflow: one(workflows, {
      fields: [testWorkflows.workflowId],
      references: [workflows.id],
    }),
  })
);
