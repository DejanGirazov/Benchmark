import { Request, Response } from "express";
import { and, eq } from "drizzle-orm";
import { projects, workflows } from "../db/schema";
import { db } from "../db/index";

export const createWorkflow = async (req: Request, res: Response) => {
  try {
    const { name, description, definition } = req.body;
    const projectId = req.params.projectId as string;
    const userId = req.user!.id;
    if (!name || !definition) {
      return res
        .status(400)
        .json({ message: "Workflow name and definition are required" });
    }
    const project = await db
      .select()
      .from(projects)
      .where(and(eq(projects.ownerId, userId), eq(projects.id, projectId))).limit(1);
    if (project.length === 0) {
      return res.status(404).json({ message: "Project not found" });
    }
    const newWorkflow = await db
      .insert(workflows)
      .values({ projectId, name, description, definition })
      .returning();
    res.status(201).json(newWorkflow[0]);
  } catch (error) {
    console.error("Error creating workflow:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
export const getAllWorkflows = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const projectId = req.params.projectId as string;
    const project = await db
      .select()
      .from(projects)
      .where(and(eq(projects.ownerId, userId), eq(projects.id, projectId))).limit(1);
    if (project.length === 0) {
      return res.status(404).json({ message: "Project not found" });
    }
    const workflow = await db
      .select()
      .from(workflows)
      .where(eq(workflows.projectId, projectId));
    res.status(200).json(workflow);
  } catch (error) {
    console.error("Error fetching workflows:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
export const getWorkflowById = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const projectId = req.params.projectId as string;
    const project = await db
      .select()
      .from(projects)
      .where(and(eq(projects.ownerId, userId), eq(projects.id, projectId))).limit(1);
    if (project.length === 0) {
      return res.status(404).json({ message: "Project not found" });
    }
    const workflowId = req.params.id as string;
    const workflow = await db
      .select()
      .from(workflows)
       .where(and(
        eq(workflows.id, workflowId),
        eq(workflows.projectId, projectId)
      ));
    if (workflow.length === 0) {
      return res.status(404).json({ message: "Workflow not found" });
    }
    res.status(200).json(workflow[0]);
  } catch (error) {
    console.error("Error fetching workflow:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
export const updateWorkflow = async (req: Request, res: Response) => {
  try {
    const { name, description, definition } = req.body;
    const userId = req.user!.id;
    const projectId = req.params.projectId as string;
    const project = await db
      .select()
      .from(projects)
      .where(and(eq(projects.ownerId, userId), eq(projects.id, projectId))).limit(1);
    if (project.length === 0) {
      return res.status(404).json({ message: "Project not found" });
    }
    const workflowId = req.params.id as string;
    const workflow = await db
      .select()
      .from(workflows)
      .where(and(
        eq(workflows.id, workflowId),
        eq(workflows.projectId, projectId)
      ));
    if (workflow.length === 0) {
      return res.status(404).json({ message: "Workflow not found" });
    }
    const updatedWorkflow = await db
      .update(workflows)
      .set({ name, description, definition })
      .where(and(
        eq(workflows.id, workflowId),
        eq(workflows.projectId, projectId)
      ))
      .returning();
    res.status(200).json(updatedWorkflow[0]);
  } catch (error) {
    console.error("Error updating workflow:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
export const deleteWorkflow = async (req: Request, res: Response) => {
    try{
        const userId = req.user!.id;
        const projectId = req.params.projectId as string;   
        const workflowId = req.params.id as string;
        const project = await db
        .select()
        .from(projects)
        .where(and(eq(projects.ownerId, userId), eq(projects.id, projectId))).limit(1);
        const workflow = await db
        .select()
        .from(workflows)
        .where(and(
            eq(workflows.id, workflowId),
            eq(workflows.projectId, projectId)
            ));
        if (project.length === 0) {
            return res.status(404).json({ message: "Project not found" });
        }
        if (workflow.length === 0) {
            return res.status(404).json({ message: "Workflow not found" });
        }
        const deletedWorkflow = await db
        .delete(workflows)
        .where(and(
            eq(workflows.id, workflowId),
            eq(workflows.projectId, projectId)
        ))
        .returning();
        res.status(200).json(deletedWorkflow[0]);
    }catch(error){
        console.error("Error deleting workflow:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
