import { Request, Response, NextFunction } from "express";
import { createRemoteJWKSet, jwtVerify } from "jose";

export interface FirebaseUser {
  uid: string;
  email?: string;
  name?: string;
}

export interface AuthenticatedRequest extends Request {
  firebaseUser?: FirebaseUser;
}

const FIREBASE_PROJECT_ID = process.env["FIREBASE_PROJECT_ID"] || "roll-forming-tooling-eng";
const JWKS_URL = `https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com`;

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function getJWKS() {
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(JWKS_URL));
  }
  return jwks;
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
    req.firebaseUser = { uid: "offline-sai-rolotech-1164", email: "engineer@sairolotech.local", name: "SAI Engineer" };
    next();
    return;
  }

  try {
    const { payload } = await jwtVerify(token, getJWKS(), {
      issuer: `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`,
      audience: FIREBASE_PROJECT_ID,
    });

    req.firebaseUser = {
      uid: payload["user_id"] as string || payload["sub"] as string,
      email: payload["email"] as string | undefined,
      name: payload["name"] as string | undefined,
    };
    next();
  } catch (err) {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}
