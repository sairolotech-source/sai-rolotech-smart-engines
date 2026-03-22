import { Router } from "express";

const router = Router();

router.get("/auth/status", (_req, res) => {
  const envProjectId = process.env["FIREBASE_PROJECT_ID"];
  const projectId = envProjectId || "roll-forming-tooling-eng";
  res.json({
    provider: "firebase",
    projectId,
    configured: !!projectId,
    source: envProjectId ? "env" : "default",
  });
});

export default router;
