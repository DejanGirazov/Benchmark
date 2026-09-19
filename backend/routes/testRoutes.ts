import { Router } from "express";
import { protectRoute } from "../middleware/protectRoute";
import {createTest, getTestById, getTests, cancelTest, startTest,deleteTest} from "../controllers/testController";
const router = Router();

router.post("/create", protectRoute, createTest);
router.get("/get", protectRoute, getTests);
router.get("/get/:id", protectRoute, getTestById);
router.post("/start/:id", protectRoute, startTest);
router.post("/cancel/:id", protectRoute, cancelTest);
router.delete("/delete/:id", protectRoute, deleteTest);

export default router;