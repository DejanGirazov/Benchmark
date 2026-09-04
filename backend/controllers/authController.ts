import { Request, Response } from "express";
import { eq } from "drizzle-orm";
import bcrypt from "bcrypt";
import { db } from "../db";
import { users, projects } from "../db/schema";
import { setAuthCookie, clearAuthCookie } from "../utils/cookies";

interface LoginBody {
  email: string;
  password: string;
}

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body as LoginBody;

    if (!email || !password) {
      return res.status(400).json({
        error: "Email and password are required",
      });
    }
    const user = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (user.length === 0) {
      return res.status(401).json({
        error: "Invalid email or password",
      });
    }

    const passwordMatches = await bcrypt.compare(
      password,
      user[0].passwordHash,
    );

    if (!passwordMatches) {
      return res.status(401).json({
        error: "Invalid email or password",
      });
    }

    setAuthCookie(res, user[0].id);

    res.status(200).json({
      message: "User logged in successfully",
      user: {
        id: user[0].id,
        email: user[0].email,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({
      error: "Internal server error",
    });
  }
};

export const signup = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body as LoginBody;
    if (!email || !password) {
      return res.status(400).json({
        error: "Email and password are required",
      });
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        error: "Invalid email format",
      });
    }
    if (password.length < 8) {
      return res.status(400).json({
        error: "Password must be at least 8 characters long",
      });
    }
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    if (existingUser.length > 0) {
      return res.status(400).json({
        error: "Email already exists",
      });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const [user] = await db
      .insert(users)
      .values({
        email,
        passwordHash: hashedPassword,
      })
      .returning({
        id: users.id,
        email: users.email,
      });

    setAuthCookie(res, user.id);

    res.status(201).json({
      message: "User created successfully",
      user: {
        id: user.id,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("Signup error:", error);
    return res.status(500).json({
      error: "Internal server error",
    });
  }
};

export const getme = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const user = await db
      .select({
        id: users.id,
        email: users.email,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (user.length === 0) {
      return res.status(404).json({
        error: "User not found",
      });
    }
     const userProjects = await db
      .select({
        id: projects.id,
        name: projects.name,
        description: projects.description,
        createdAt: projects.createdAt,
        updatedAt: projects.updatedAt,
      })
      .from(projects)
      .where(eq(projects.ownerId, userId));
    res.status(200).json({
      user: {
        id: user[0].id,
        email: user[0].email,
      },
      projects: userProjects,
    });
  } catch (error) {
    console.error("GetMe error:", error);
    return res.status(500).json({
      error: "Internal server error",
    });
  }
};

export const logout = async (req: Request, res: Response) => {
  clearAuthCookie(res);
  res.status(200).json({ message: "Logged out successfully" });
};