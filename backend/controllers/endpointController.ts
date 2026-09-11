import { endpoints, projects } from "../db/schema";
import { db } from "../db/index";
import { and, eq } from "drizzle-orm";
import { Request, Response } from "express";

export const getEndpoints = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const projectId = req.params.projectId as string;
    const project = await db
      .select()
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.ownerId, userId)))
      .limit(1);

    if (project.length === 0) {
      return res.status(404).json({ message: "Project not found" });
    }
    const projectEndpoints = await db
      .select()
      .from(endpoints)
      .where(eq(endpoints.projectId, projectId));
    res.status(200).json(projectEndpoints);
  } catch (error) {
    console.error("Error fetching endpoints:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
export const getEndpointById = async (req: Request, res: Response) => {
  try {
    const endpointId = req.params.id as string;
    const projectId = req.params.projectId as string;
    const endpoint = await db
      .select()
      .from(endpoints)
      .where(
        and(eq(endpoints.id, endpointId), eq(endpoints.projectId, projectId)),
      );
    if (endpoint.length === 0) {
      return res.status(404).json({ message: "Endpoint not found" });
    }
    res.status(200).json(endpoint[0]);
  } catch (error) {
    console.error("Error fetching endpoint:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
export const createEndpoint = async (req: Request, res: Response) => {
  try {
    const { name, baseUrl, metaData } = req.body;
    const projectId = req.params.projectId as string;
    if (!name || !baseUrl) {
      return res
        .status(400)
        .json({ message: "Endpoint name and base URL are required" });
    }
    const newEndpoint = await db
      .insert(endpoints)
      .values({
        name,
        baseUrl: baseUrl,
        projectId,
        metadata: metaData || null,
      })
      .returning();
    res.status(201).json(newEndpoint[0]);
  } catch (error) {
    console.error("Error creating endpoint:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
export const updateEndpoint = async (req: Request, res: Response) => {
  try {
    const { name, baseUrl, metaData } = req.body;
    const projectId = req.params.projectId as string;
    const endpointId = req.params.id as string;
    const userId = req.user!.id;

    // Verify project belongs to user
    const project = await db
      .select()
      .from(projects)
      .where(
        and(
          eq(projects.id, projectId),
          eq(projects.ownerId, userId)
        )
      )
      .limit(1);

    if (project.length === 0) {
      return res.status(404).json({ message: "Project not found" });
    }

    const updatedEndpoint = await db
      .update(endpoints)
      .set({
        name: name ?? undefined,
        baseUrl: baseUrl ?? undefined,
        metadata: metaData ?? undefined,
      })
      .where(
        and(
          eq(endpoints.id, endpointId),
          eq(endpoints.projectId, projectId)
        )
      )
      .returning();

    if (updatedEndpoint.length === 0) {
      return res.status(404).json({ message: "Endpoint not found" });
    }

    res.status(200).json(updatedEndpoint[0]);
  } catch (error) {
    console.error("Error updating endpoint:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
export const deleteEndpoint = async (req: Request, res: Response) => {
  try {
    const projectId = req.params.projectId as string;
    const endpointId = req.params.id as string;
    const userId = req.user!.id;

    const project = await db
      .select()
      .from(projects)
      .where(
        and(
          eq(projects.id, projectId),
          eq(projects.ownerId, userId)
        )
      )
      .limit(1);

    if (project.length === 0) {
      return res.status(404).json({ message: "Project not found" });
    }

    const deletedEndpoint = await db
      .delete(endpoints)
      .where(
        and(
          eq(endpoints.id, endpointId),
          eq(endpoints.projectId, projectId)
        )
      )
      .returning();

    if (deletedEndpoint.length === 0) {
      return res.status(404).json({ message: "Endpoint not found" });
    }

    res.status(200).json({ message: "Endpoint deleted successfully" });
  } catch (error) {
    console.error("Error deleting endpoint:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};