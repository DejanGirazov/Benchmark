import {login, signup,  getme, logout} from "../controllers/authController";
import {protectRoute} from "../middleware/protectRoute";
import express from "express";

const router = express.Router();

router.post("/login", login);
router.post("/signup", signup);
router.get("/me", protectRoute, getme);
router.post("/logout", protectRoute, logout);


export default router;