import {protectRoute} from "../middleware/protectRoute";
import express from "express";
import {getEndpoints, createEndpoint, getEndpointById, updateEndpoint, deleteEndpoint} from "../controllers/endpointController";

const router = express.Router();

router.get("/:projectId/get",protectRoute, getEndpoints);
router.get("/:projectId/get/:id", protectRoute, getEndpointById);
router.post("/:projectId/create", protectRoute, createEndpoint);
router.put("/:projectId/update/:id", protectRoute, updateEndpoint);
router.delete("/:projectId/delete/:id", protectRoute, deleteEndpoint);

export default router;