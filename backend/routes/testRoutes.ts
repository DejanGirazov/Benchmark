import { Router } from "express";
import { protectRoute } from "../middleware/protectRoute";
import {createTest, getTestById, getTests, cancelTest, startTest,deleteTest, streamTest} from "../controllers/testController";
const router = Router();

router.post("/:projectId/create", protectRoute, createTest);
router.get("/:projectId/get", protectRoute, getTests);
router.get("/:projectId/get/:id", protectRoute, getTestById);
router.post("/:projectId/start/:testId", protectRoute, startTest);
router.post("/:projectId/cancel/:id", protectRoute, cancelTest);
router.delete("/:projectId/delete/:id", protectRoute, deleteTest);
router.get("/:projectId/stream/:id", protectRoute, streamTest);

export default router;