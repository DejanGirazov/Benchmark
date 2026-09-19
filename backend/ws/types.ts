import type { WorkflowDefinition, TestSummary } from "../db/schema";

// ---------- Backend → Generator ----------

export interface StartTestMessage {
  type: "start_test";
  testId: string;
  baseUrl: string;
  workflow: WorkflowDefinition;
  assignedUsers: number;
  durationSeconds: number;
  rampUpSeconds: number;
}

export interface CancelTestMessage {
  type: "cancel_test";
  testId: string;
}

export interface RegisteredMessage {
  type: "registered";
  generatorId: string;
}

// ---------- Generator → Backend ----------

export interface RegisterMessage {
  type: "register";
  name: string;
  capacity: { maxVirtualUsers: number; cpuCores: number; label?: string };
}

export interface MetricsBatchMessage {
  type: "metrics_batch";
  testId: string;
  timestamp: string;
  activeUsers: number;
  requestCount: number;
  errorCount: number;
  rps: number;
  p50LatencyMs?: number;
  p95LatencyMs?: number;
  p99LatencyMs?: number;
  raw?: Record<string, unknown>;
}

export interface TestStartedMessage {
  type: "test_started";
  testId: string;
}

export interface TestCompletedMessage {
  type: "test_completed";
  testId: string;
  summary: TestSummary;
}

export interface TestFailedMessage {
  type: "test_failed";
  testId: string;
  error: string;
}

export type InboundMessage =
  | RegisterMessage
  | MetricsBatchMessage
  | TestStartedMessage
  | TestCompletedMessage
  | TestFailedMessage;