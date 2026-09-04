import {protectRoute} from "../middleware/protectRoute";
import express from "express";
import {getProjects, createProject, getProjectById, updateProject, deleteProject} from "../controllers/projectController";

const router = express.Router();

router.get("/getAll", protectRoute, getProjects);
router.post("/create", protectRoute, createProject);
router.get("/get/:id", protectRoute, getProjectById);
router.put("/update/:id", protectRoute, updateProject);
router.delete("/delete/:id", protectRoute, deleteProject);

export default router;