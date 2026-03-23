import { Request, Response, NextFunction } from "express";

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

export async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers["authorization"];
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing or invalid Authorization header" });
    return;
  }

  const token = authHeader.slice(7);

  if (OFFLINE_TOKENS.includes(token)) {
    req.authUser = { uid: "offline-sai-rolotech-1164", email: "engineer@sairolotech.local", name: "SAI Engineer" };
    next();
    return;
  }

  res.status(401).json({ error: "Invalid or expired token" });
}
