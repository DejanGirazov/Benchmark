// ws/orchestrator.ts
import { eq, sql,and } from "drizzle-orm";
import { db } from "../db/index";
import {
  tests,
  workflows,
  endpoints,
  generators,
  testGeneratorAssignments,
  metrics,
  TestSummary,
} from "../db/schema";
import { liveGenerators, sendToGenerator } from "./registry";
import type { InboundMessage } from "./types";
import { broadcastToTestSubscribers } from "../sse/broadcaster";

// ============================================================
// STARTING A TEST
// ============================================================

export async function startTestOrchestration(testId: string) {
  const notified: string[] = [];
  try{
    const [test] = await db.select().from(tests).where(eq(tests.id, testId));
  const [workflow] = await db
    .select()
    .from(workflows)
    .where(eq(workflows.id, test.workflowId));
  const [endpoint] = await db
    .select()
    .from(endpoints)
    .where(eq(endpoints.id, test.endpointId));

  // Only generators the DB thinks are online AND that we actually have
  // a live socket for right now (the two can disagree if one crashed uncleanly)
  const onlineGenerators = await db
    .select()
    .from(generators)
    .where(eq(generators.status, "online"));

  const available = onlineGenerators.filter((g) => liveGenerators.has(g.id));
    if (available.length === 0) {
      await db
        .update(tests)
        .set({ status: "failed", endedAt: new Date() }) // endedAt was missing here
        .where(eq(tests.id, testId));
      broadcastToTestSubscribers(testId, {
        type: "status",
        status: "failed",
        reason: "No generators connected",
      });
      return;

    }
    const assignments = splitUsers(test.virtualUsers, available);

  // Persist the plan BEFORE sending anything — if the process crashes
  // mid-loop below, we still know what was supposed to happen
  await db.insert(testGeneratorAssignments).values(
    assignments.map((a) => ({
      testId,
      generatorId: a.generatorId,
      assignedUsers: a.assignedUsers,
    })),
  );
  for (const a of assignments) {
      const sent = sendToGenerator(a.generatorId, {
        type: "start_test",
        testId,
        baseUrl: endpoint.baseUrl,
        workflow: workflow.definition,
        assignedUsers: a.assignedUsers,
        durationSeconds: test.durationSeconds,
        rampUpSeconds: test.rampUpSeconds,
      });
      if (!sent) {
        throw new Error(`Generator ${a.generatorId} disconnected before start_test`);
      }
      notified.push(a.generatorId);

      await db
        .update(generators)
        .set({ status: "busy" })
        .where(eq(generators.id, a.generatorId));
    }

    await db
      .update(tests)
      .set({ status: "running", startedAt: new Date() })
      .where(eq(tests.id, testId));

    broadcastToTestSubscribers(testId, { type: "status", status: "running" });
  } catch (error) {
    console.error(`[orchestrator] failed to start test ${testId}:`, error);
    await abortFailedStart(testId, notified);
  }
}

async function abortFailedStart(testId: string, notified: string[]) {
  // The cleanup can fail too (DB down, for example). Catch it so it never
  // hides the original error or crashes the request.
  try {
    for (const id of notified) {
      sendToGenerator(id, { type: "cancel_test", testId });
      // Only flip busy -> online, so a generator that went offline isn't resurrected
      await db
        .update(generators)
        .set({ status: "online" })
        .where(and(eq(generators.id, id), eq(generators.status, "busy")));
    }
    await db
      .update(tests)
      .set({ status: "failed", endedAt: new Date() })
      .where(eq(tests.id, testId));
  } catch (cleanupError) {
    console.error(`[orchestrator] cleanup also failed for test ${testId}:`, cleanupError);
  }

  // Generic reason on purpose: the details are in the server log, not the browser
  broadcastToTestSubscribers(testId, {
    type: "status",
    status: "failed",
    reason: "Failed to start test",
  });
}

function splitUsers(
  totalUsers: number,
  gens: { id: string }[],
): { generatorId: string; assignedUsers: number }[] {
  const base = Math.floor(totalUsers / gens.length);
  const remainder = totalUsers % gens.length;
  return gens.map((g, i) => ({
    generatorId: g.id,
    assignedUsers: base + (i < remainder ? 1 : 0), // spread the leftover users
  }));
}

// ============================================================
// CANCELLING A TEST
// ============================================================

export async function cancelTestOrchestration(testId: string) {
  const assignments = await db
    .select()
    .from(testGeneratorAssignments)
    .where(eq(testGeneratorAssignments.testId, testId));

  for (const a of assignments) {
    sendToGenerator(a.generatorId, { type: "cancel_test", testId });
    await db
      .update(generators)
      .set({ status: "online" })
      .where(eq(generators.id, a.generatorId));
  }

  await db
    .update(tests)
    .set({ status: "cancelled", endedAt: new Date() })
    .where(eq(tests.id, testId));

  broadcastToTestSubscribers(testId, { type: "status", status: "cancelled" });
}

// ============================================================
// HANDLING MESSAGES *FROM* GENERATORS
// (called by server.ts's ws.on("message", ...) handler)
// ============================================================

const completedGeneratorsByTest = new Map<string, Set<string>>();

export async function handleInboundMessage(
  generatorId: string,
  msg: InboundMessage,
) {
  await db
    .update(generators)
    .set({ lastSeenAt: new Date() })
    .where(eq(generators.id, generatorId));

  switch (msg.type) {
    case "test_started":
      break;

    case "metrics_batch":
      await db.insert(metrics).values({
        testId: msg.testId,
        generatorId,
        timestamp: new Date(msg.timestamp),
        activeUsers: msg.activeUsers,
        requestCount: msg.requestCount,
        errorCount: msg.errorCount,
        rps: msg.rps,
        p50LatencyMs: msg.p50LatencyMs,
        p95LatencyMs: msg.p95LatencyMs,
        p99LatencyMs: msg.p99LatencyMs,
        raw: msg.raw,
      });
      broadcastToTestSubscribers(msg.testId, {
        type: "metrics",
        data: { ...msg, generatorId },
      });
      break;

    case "test_completed":
      await maybeFinalizeTest(msg.testId, generatorId, msg.summary);
      await db
        .update(generators)
        .set({ status: "online" })
        .where(eq(generators.id, generatorId));
      break;

    case "test_failed":
      await db
        .update(tests)
        .set({ status: "failed", endedAt: new Date() })
        .where(eq(tests.id, msg.testId));
      await db
        .update(generators)
        .set({ status: "online" })
        .where(eq(generators.id, generatorId));
      broadcastToTestSubscribers(msg.testId, {
        type: "status",
        status: "failed",
        reason: msg.error,
      });
      break;
  }
}

async function maybeFinalizeTest(
  testId: string,
  generatorId: string,
  _partialSummary: unknown,
) {
  const assignments = await db
    .select()
    .from(testGeneratorAssignments)
    .where(eq(testGeneratorAssignments.testId, testId));

  const done = completedGeneratorsByTest.get(testId) ?? new Set<string>();
  done.add(generatorId);
  completedGeneratorsByTest.set(testId, done);

  if (done.size < assignments.length) return; // still waiting on others

  const finalSummary = await aggregateTestSummary(testId);

  await db
    .update(tests)
    .set({ status: "completed", endedAt: new Date(), summary: finalSummary })
    .where(eq(tests.id, testId));

  completedGeneratorsByTest.delete(testId);
  broadcastToTestSubscribers(testId, {
    type: "status",
    status: "completed",
    summary: finalSummary,
  });
}

async function aggregateTestSummary(testId: string): Promise<TestSummary> {
  const [row] = await db
    .select({
      totalRequests: sql<number>`coalesce(sum(${metrics.requestCount}), 0)`,
      totalErrors: sql<number>`coalesce(sum(${metrics.errorCount}), 0)`,
      avgRps: sql<number>`coalesce(avg(${metrics.rps}), 0)`,
      p50LatencyMs: sql<number>`coalesce(avg(${metrics.p50LatencyMs}), 0)`,
      p95LatencyMs: sql<number>`coalesce(max(${metrics.p95LatencyMs}), 0)`,
      p99LatencyMs: sql<number>`coalesce(max(${metrics.p99LatencyMs}), 0)`,
    })
    .from(metrics)
    .where(eq(metrics.testId, testId));

  const totalRequests = Number(row.totalRequests);
  const totalErrors = Number(row.totalErrors);

  return {
    totalRequests,
    totalErrors,
    avgRps: Number(row.avgRps),
    p50LatencyMs: Number(row.p50LatencyMs),
    p95LatencyMs: Number(row.p95LatencyMs),
    p99LatencyMs: Number(row.p99LatencyMs),
    errorRate: totalRequests > 0 ? totalErrors / totalRequests : 0,
  };
}
