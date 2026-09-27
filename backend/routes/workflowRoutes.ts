import {protectRoute} from "../middleware/protectRoute";
import express from "express";
import {createWorkflow, deleteWorkflow,getAllWorkflows,getWorkflowById,updateWorkflow} from "../controllers/worklfowController"

const router= express.Router();

router.get("/:projectId/get", protectRoute, getAllWorkflows);
router.get("/:projectId/get/:id", protectRoute, getWorkflowById);
router.post("/:projectId/create", protectRoute, createWorkflow);
router.put("/:projectId/update/:id", protectRoute, updateWorkflow);
router.delete("/:projectId/delete/:id", protectRoute, deleteWorkflow);

export default router;


