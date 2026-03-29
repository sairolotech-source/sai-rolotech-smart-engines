/**
 * rbac-info.ts — RBAC Role Information Endpoint
 * Sai Rolotech Smart Engines v2.4.0
 * Returns role capabilities and available role tokens for offline setup.
 */

import { Router, type Request, type Response } from "express";
import { ROLE_PERMISSIONS, ROLE_TOKENS_PUBLIC, resolveToken } from "../middleware/rbac";

const router = Router();

// GET /api/rbac/info — role capabilities
router.get("/info", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    roles:  ROLE_PERMISSIONS,
    tokens: ROLE_TOKENS_PUBLIC,
  });
});

// GET /api/rbac/me — who am I?
router.get("/me", (req: Request, res: Response) => {
  const user = req.rbacUser;
  res.json({
    status: "ok",
    user:   user ?? null,
    permissions: user ? ROLE_PERMISSIONS[user.role] : null,
  });
});

// POST /api/rbac/verify — verify a specific token
router.post("/verify", (req: Request, res: Response) => {
  const { token } = req.body as { token?: string };
  if (!token) {
    res.status(400).json({ status: "fail", reason: "No token provided" });
    return;
  }
  const user = resolveToken(token);
  if (!user) {
    res.status(403).json({ status: "fail", reason: "Invalid token" });
    return;
  }
  res.json({
    status: "ok",
    user,
    permissions: ROLE_PERMISSIONS[user.role],
  });
});

export default router;
