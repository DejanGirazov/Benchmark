import type { Response } from "express";
import jwt from "jsonwebtoken";

const COOKIE_NAME = "token";
const COOKIE_MAX_AGE_MS = 15 * 24 * 60 * 60 * 1000; // 15 days, matches JWT expiry

const baseCookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: "none" as const,
};

export const setAuthCookie = (res: Response, userId: string) => {
  const token = jwt.sign({ userId }, process.env.JWT_SECRET!, {
    expiresIn: "15d",
  });
  res.cookie(COOKIE_NAME, token, {
    ...baseCookieOptions,
    maxAge: COOKIE_MAX_AGE_MS,
  });
};

export const clearAuthCookie = (res: Response) => {
  res.clearCookie(COOKIE_NAME, baseCookieOptions);
};