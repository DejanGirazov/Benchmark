import { Request, Response } from "express";
import { and, eq,desc } from "drizzle-orm";
import { tests, projects, workflows, endpoints , metrics} from "../db/schema";
import { db } from "../db/index";
// You'll create this in your websocket manager module
import { startTestOrchestration, cancelTestOrchestration } from "../ws/orchestrator";
import {
  openStream,
  subscribeToTest,
  sendEvent,
  isEndStatus,
} from "../sse/broadcaster";

async function getOwnedProject(projectId: string, userId: string) {
  const project = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.ownerId, userId)))
    .limit(1);
  return project[0] ?? null;
}

export const createTest = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const projectId = req.params.projectId as string;
    const {
      name,
      workflowId,
      endpointId,
      virtualUsers,
      durationSeconds,
      rampUpSeconds,
      config,
    } = req.body;

    const project = await getOwnedProject(projectId, userId);
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    if (!workflowId || !endpointId || !virtualUsers || !durationSeconds) {
      return res.status(400).json({
        message:
          "workflowId, endpointId, virtualUsers, and durationSeconds are required",
      });
    }

    if (
      !Number.isInteger(virtualUsers) ||
      virtualUsers <= 0 ||
      !Number.isInteger(durationSeconds) ||
      durationSeconds <= 0 ||
      (rampUpSeconds !== undefined &&
        (!Number.isInteger(rampUpSeconds) || rampUpSeconds < 0))
    ) {
      return res.status(400).json({ message: "Invalid numeric parameters" });
    }

    // Make sure workflow and endpoint actually belong to this project
    const workflow = await db
      .select()
      .from(workflows)
      .where(and(eq(workflows.id, workflowId), eq(workflows.projectId, projectId)))
      .limit(1);
    if (workflow.length === 0) {
      return res
        .status(404)
        .json({ message: "Workflow not found in this project" });
    }

    const endpoint = await db
      .select()
      .from(endpoints)
      .where(and(eq(endpoints.id, endpointId), eq(endpoints.projectId, projectId)))
      .limit(1);
    if (endpoint.length === 0) {
      return res
        .status(404)
        .json({ message: "Endpoint not found in this project" });
    }

    const newTest = await db
      .insert(tests)
      .values({
        projectId,
        workflowId,
        endpointId,
        name: name || null,
        virtualUsers,
        durationSeconds,
        rampUpSeconds: rampUpSeconds ?? 0,
        config: config || {},
        status: "pending",
      })
      .returning();

    res.status(201).json(newTest[0]);
  } catch (error) {
    console.error("Error creating test:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const getTests = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const projectId = req.params.projectId as string;

    const project = await getOwnedProject(projectId, userId);
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    const projectTests = await db
      .select()
      .from(tests)
      .where(eq(tests.projectId, projectId));

    res.status(200).json(projectTests);
  } catch (error) {
    console.error("Error fetching tests:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const getTestById = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const projectId = req.params.projectId as string;
    const testId = req.params.id as string;

    const project = await getOwnedProject(projectId, userId);
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    const test = await db
      .select()
      .from(tests)
      .where(and(eq(tests.id, testId), eq(tests.projectId, projectId)))
      .limit(1);

    if (test.length === 0) {
      return res.status(404).json({ message: "Test not found" });
    }

    res.status(200).json(test[0]);
  } catch (error) {
    console.error("Error fetching test:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const startTest = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const projectId = req.params.projectId as string;
    const testId = req.params.id as string;

    const project = await getOwnedProject(projectId, userId);
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    const test = await db
      .select()
      .from(tests)
      .where(and(eq(tests.id, testId), eq(tests.projectId, projectId)))
      .limit(1);

    if (test.length === 0) {
      return res.status(404).json({ message: "Test not found" });
    }

    if (test[0].status !== "pending") {
      return res
        .status(409)
        .json({ message: `Test cannot be started from status "${test[0].status}"` });
    }

    // Orchestration owns: picking generators, writing test_generator_assignments,
    // sending "start_test" over each generator's WebSocket, and flipping status
    // to "running" once generators ack. Keep that logic out of the HTTP layer.
    await startTestOrchestration(test[0].id);

    res.status(202).json({ message: "Test start requested" });
  } catch (error) {
    console.error("Error starting test:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const cancelTest = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const projectId = req.params.projectId as string;
    const testId = req.params.id as string;

    const project = await getOwnedProject(projectId, userId);
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    const test = await db
      .select()
      .from(tests)
      .where(and(eq(tests.id, testId), eq(tests.projectId, projectId)))
      .limit(1);

    if (test.length === 0) {
      return res.status(404).json({ message: "Test not found" });
    }

    if (test[0].status !== "running" && test[0].status !== "pending") {
      return res
        .status(409)
        .json({ message: `Test cannot be cancelled from status "${test[0].status}"` });
    }

    await cancelTestOrchestration(test[0].id);

    res.status(202).json({ message: "Test cancellation requested" });
  } catch (error) {
    console.error("Error cancelling test:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const deleteTest = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const projectId = req.params.projectId as string;
    const testId = req.params.id as string;

    const project = await getOwnedProject(projectId, userId);
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    const test = await db
      .select()
      .from(tests)
      .where(and(eq(tests.id, testId), eq(tests.projectId, projectId)))
      .limit(1);

    if (test.length === 0) {
      return res.status(404).json({ message: "Test not found" });
    }

    if (test[0].status === "running") {
      return res
        .status(409)
        .json({ message: "Cannot delete a running test — cancel it first" });
    }

    const deleted = await db
      .delete(tests)
      .where(and(eq(tests.id, testId), eq(tests.projectId, projectId)))
      .returning();

    res.status(200).json(deleted[0]);
  } catch (error) {
    console.error("Error deleting test:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
export const streamTest = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const projectId = req.params.projectId as string;
    const testId = req.params.id as string;

    // Ownership checks happen BEFORE the stream opens, so errors can still be plain JSON
    const project = await getOwnedProject(projectId, userId);
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    const [test] = await db
      .select()
      .from(tests)
      .where(and(eq(tests.id, testId), eq(tests.projectId, projectId)))
      .limit(1);
    if (!test) {
      return res.status(404).json({ message: "Test not found" });
    }

    openStream(res);

    // Subscribe first (synchronously, right after reading the status) so no
    // live event is missed while the snapshot query runs.
    const terminal = isEndStatus(test.status);
    if (!terminal) subscribeToTest(testId, res);

    const recent = await db
      .select()
      .from(metrics)
      .where(eq(metrics.testId, testId))
      .orderBy(desc(metrics.timestamp))
      .limit(300);

    sendEvent(res, "snapshot", {
      status: test.status,
      startedAt: test.startedAt,
      endedAt: test.endedAt,
      summary: test.summary,
      metrics: recent.reverse(), // oldest -> newest
    });

    // Finished tests get the snapshot and nothing else
    if (terminal) res.end();
  } catch (error) {
    console.error("Error streaming test:", error);
    if (!res.headersSent) {
      res.status(500).json({ message: "Internal server error" });
    } else {
      res.end();
    }
  }
};