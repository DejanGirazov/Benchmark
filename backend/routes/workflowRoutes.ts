import {protectRoute} from "../middleware/protectRoute";
import express from "express";
import {createWorkflow, deleteWorkflow,getAllWorkflows,getWorkflowById,updateWorkflow} from "../controllers/worklfowController"

const router= express.Router();

router.get("/get", protectRoute, getAllWorkflows);
router.get("/get/:id", protectRoute, getWorkflowById);
router.post("/create", protectRoute, createWorkflow);
router.put("/update/:id", protectRoute, updateWorkflow);
router.delete("/delete/:id", protectRoute, deleteWorkflow);

export default router;


