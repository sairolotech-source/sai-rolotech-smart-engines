import { Router } from "express";

const router = Router();

router.get("/auth/status", (_req, res) => {
  res.json({
    provider: "offline",
    configured: true,
    source: "local",
  });
});

export default router;
