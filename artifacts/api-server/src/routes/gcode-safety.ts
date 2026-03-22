import { Router } from "express";
import { checkGcodeSafety } from "../lib/gcode-safety-checker.js";

const router = Router();

router.post("/api/gcode-safety-check", (req, res) => {
  try {
    const { gcode } = req.body as { gcode: string };
    if (!gcode || typeof gcode !== "string") {
      return res.status(400).json({ error: "gcode string required" });
    }
    if (gcode.length > 2_000_000) {
      return res.status(400).json({ error: "G-code too large (max 2MB)" });
    }
    const result = checkGcodeSafety(gcode);
    return res.json({ success: true, result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Safety check failed";
    return res.status(400).json({ error: message });
  }
});

export default router;
