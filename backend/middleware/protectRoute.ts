import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";
import { users } from "../db/schema";
import { eq } from "drizzle-orm";
import { db } from "../db/index";

export const protectRoute = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.cookies?.token;
    if (!token) {
      return res.status(401).json({ error: "Unauthorized: No token provided" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
    const user = await db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(eq(users.id, decoded.userId))
      .limit(1);
    if (user.length === 0) {
      return res.status(404).json({ error: "Unauthorized: User not found" });
    }
    req.user = user[0];
    next();
  } catch (error) {
    console.log("Error in protectRoute middleware:", (error as Error).message);
    return res.status(401).json({ error: "Unauthorized: Invalid or expired token" });
  }
};