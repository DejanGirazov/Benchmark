import { users, projects } from "../db/schema";
import { db } from "../db/index";
import { eq } from "drizzle-orm";
import { Request, Response } from "express";

export const createProject = async (req: Request, res: Response) => {
    try{
        const { name, description } = req.body;
        const userId = req.user!.id;
        if(!name){
            return res.status(400).json({ message: "Project name is required" });
        }
        const newProjects = await db.insert(projects).values({
            name,
            description: description || null,
            ownerId: userId,
        }).returning();
        res.status(201).json(newProjects[0]);
    }catch(error){
        console.error("Error creating project:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
export const getProjects = async (req: Request, res: Response) => {
    try{
        const userId = req.user!.id;
        const userProjects = await db.select().from(projects).where(eq(projects.ownerId, userId));
        res.status(200).json(userProjects);
    }catch(error){
        console.error("Error fetching projects:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
export const getProjectById = async (req: Request, res: Response) => {
    try{
        const projectId = req.params.id as string;
        const project = await db.select().from(projects).where(eq(projects.id, projectId));
        res.status(200).json(project);
    }catch(error){
        console.error("Error fetching project:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
export const updateProject = async (req: Request, res: Response) => {
    try{
        const projectId = req.params.id as string;
        const { name, description } = req.body;
        const updatedProject = await db.update(projects).set({
            name: name ?? undefined,
            description: description ?? undefined
        }).where(eq(projects.id, projectId)).returning();
        res.status(200).json(updatedProject[0]);
    }catch(error){
        console.error("Error updating project:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
export const deleteProject = async (req: Request, res: Response) => {
    try{
        const projectId = req.params.id as string;
        await db.delete(projects).where(eq(projects.id, projectId));
        res.status(200).json({ message: "Project deleted successfully" });
    }catch(error){
        console.error("Error deleting project:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};