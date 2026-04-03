/**
 * rbac.ts — Role-Based Access Control Backend Middleware
 * Sai Rolotech Smart Engines v2.4.0
 *
 * Token-to-role mapping (offline mode):
 *   offline-sai-rolotech-local  → admin
 *   dev-sai-rolotech-2026       → admin
 *   admin-srtool-1164           → admin
 *   designer-srtool-1164        → designer
 *   checker-srtool-1164         → checker
 *   approver-srtool-1164        → approver
 *   viewer-srtool-1164          → viewer
 *
 * Role permissions:
 *   admin    — full access
 *   designer — edit + export (no release)
 *   checker  — mark checked (no approve)
 *   approver — approve for manufacturing + supersede
 *   viewer   — read only, no export
 *
 * Usage:
 *   router.post("/release", requireRole(["approver","admin"]), handler)
 *   router.post("/export",  requireRole(["designer","checker","approver","admin"]), handler)
 */

import { Request, Response, NextFunction } from "express";

export type UserRole = "admin" | "designer" | "checker" | "approver" | "viewer";

export interface RbacUser {
  uid:   string;
  name:  string;
  role:  UserRole;
  email: string;
}

declare global {
  namespace Express {
    interface Request {
      rbacUser?: RbacUser;
    }
  }
}

// ─── Role token registry ────────────────────────────────────────────────────

const TOKEN_ROLE_MAP: Record<string, RbacUser> = {
  "offline-sai-rolotech-local": {
    uid:   "offline-admin-1164",
    name:  "SAI Admin",
    role:  "admin",
    email: "admin@sairolotech.local",
  },
  "dev-sai-rolotech-2026": {
    uid:   "dev-admin-2026",
    name:  "SAI Dev",
    role:  "admin",
    email: "dev@sairolotech.local",
  },
  "admin-srtool-1164": {
    uid:   "srt-admin-1164",
    name:  "Admin User",
    role:  "admin",
    email: "admin@sairolotech.local",
  },
  "designer-srtool-1164": {
    uid:   "srt-designer-1164",
    name:  "Designer",
    role:  "designer",
    email: "designer@sairolotech.local",
  },
  "checker-srtool-1164": {
    uid:   "srt-checker-1164",
    name:  "Checker",
    role:  "checker",
    email: "checker@sairolotech.local",
  },
  "approver-srtool-1164": {
    uid:   "srt-approver-1164",
    name:  "Approver",
    role:  "approver",
    email: "approver@sairolotech.local",
  },
  "viewer-srtool-1164": {
    uid:   "srt-viewer-1164",
    name:  "Viewer",
    role:  "viewer",
    email: "viewer@sairolotech.local",
  },
};

// ─── Role permissions ───────────────────────────────────────────────────────

export const ROLE_PERMISSIONS: Record<UserRole, {
  canEdit:       boolean;
  canExport:     boolean;
  canCheck:      boolean;
  canApprove:    boolean;
  canSupersede:  boolean;
  canAdmin:      boolean;
  canViewAudit:  boolean;
}> = {
  admin:    { canEdit:true,  canExport:true,  canCheck:true,  canApprove:true,  canSupersede:true,  canAdmin:true,  canViewAudit:true  },
  designer: { canEdit:true,  canExport:true,  canCheck:false, canApprove:false, canSupersede:false, canAdmin:false, canViewAudit:false },
  checker:  { canEdit:false, canExport:true,  canCheck:true,  canApprove:false, canSupersede:false, canAdmin:false, canViewAudit:false },
  approver: { canEdit:false, canExport:true,  canCheck:false, canApprove:true,  canSupersede:true,  canAdmin:false, canViewAudit:true  },
  viewer:   { canEdit:false, canExport:false, canCheck:false, canApprove:false, canSupersede:false, canAdmin:false, canViewAudit:false },
};

// ─── Resolve token to user ──────────────────────────────────────────────────

export function resolveToken(token: string): RbacUser | null {
  return TOKEN_ROLE_MAP[token] ?? null;
}

// ─── Middleware: inject rbacUser (optional, no fail) ───────────────────────

export function injectRbacUser(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const authHeader = req.headers["authorization"] ?? "";
  if (authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice(7).trim();
    const user  = resolveToken(token);
    if (user) req.rbacUser = user;
  }
  // Also support X-User-Role header for frontend role selection
  if (!req.rbacUser) {
    const headerRole = (req.headers["x-user-role"] ?? "") as string;
    const headerName = (req.headers["x-user-name"] ?? "SAI Engineer") as string;
    const validRoles: UserRole[] = ["admin","designer","checker","approver","viewer"];
    if (validRoles.includes(headerRole as UserRole)) {
      req.rbacUser = {
        uid:   `header-${headerRole}`,
        name:  headerName,
        role:  headerRole as UserRole,
        email: `${headerRole}@sairolotech.local`,
      };
    }
  }
  // Default: admin for backward compat with existing endpoints
  if (!req.rbacUser) {
    req.rbacUser = TOKEN_ROLE_MAP["offline-sai-rolotech-local"];
  }
  next();
}

// ─── Middleware: require specific roles ─────────────────────────────────────

export function requireRole(allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = req.rbacUser;
    if (!user || !allowedRoles.includes(user.role)) {
      res.status(403).json({
        error:      "Forbidden",
        reason:     `Role "${user?.role ?? "unknown"}" is not permitted to perform this action.`,
        required:   allowedRoles,
        your_role:  user?.role ?? "unknown",
        code:       "RBAC_DENIED",
      });
      return;
    }
    next();
  };
}

// ─── Middleware: require specific permission ────────────────────────────────

type PermissionKey = keyof typeof ROLE_PERMISSIONS[UserRole];

export function requirePermission(permission: PermissionKey) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = req.rbacUser;
    if (!user || !ROLE_PERMISSIONS[user.role][permission]) {
      res.status(403).json({
        error:      "Forbidden",
        reason:     `Role "${user?.role ?? "unknown"}" does not have permission: ${String(permission)}.`,
        your_role:  user?.role ?? "unknown",
        code:       "RBAC_PERMISSION_DENIED",
      });
      return;
    }
    next();
  };
}

// ─── GET /api/rbac/tokens — list available tokens ──────────────────────────
// (For engineering tool only — not for production internet apps)

export const ROLE_TOKENS_PUBLIC = Object.entries(TOKEN_ROLE_MAP).map(([token, user]) => ({
  token,
  role:  user.role,
  name:  user.name,
  email: user.email,
}));
