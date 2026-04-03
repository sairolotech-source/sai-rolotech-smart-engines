import { Request, Response, NextFunction } from "express";
import crypto from "crypto";

export interface AuthUser {
  uid: string;
  email?: string;
  name?: string;
}

export interface AuthenticatedRequest extends Request {
  authUser?: AuthUser;
}

const OFFLINE_TOKENS = [
  "dev-sai-rolotech-2026",
  "offline-sai-rolotech-local",
];

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"));
}

function isValidToken(token: string): boolean {
  return OFFLINE_TOKENS.some((t) => timingSafeEqual(token, t));
}

export async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const rawHeader = req.headers["authorization"];
  // Express may return string | string[] — normalise to string
  const authHeader = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing or invalid Authorization header" });
    return;
  }

  const token = authHeader.slice(7);

  if (isValidToken(token)) {
    req.authUser = {
      uid: "offline-sai-rolotech-1164",
      email: "engineer@sairolotech.local",
      name: "SAI Engineer",
    };
    next();
    return;
  }

  res.status(401).json({ error: "Invalid or expired token" });
}
