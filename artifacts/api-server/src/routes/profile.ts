import { Router, type IRouter, type Request, type Response } from "express";
import type { ProfileGeometry } from "../lib/dxf-parser-util";
import {
  normalizeProfileGeometryInput,
  normalizeProfileInput,
  type ProfileSchemaInput,
} from "../lib/profile-engine.js";

const router: IRouter = Router();

interface NormalizeProfileBody {
  profile?: ProfileSchemaInput;
  geometry?: ProfileGeometry;
  thickness?: number;
}

router.post("/profile/normalize", (req: Request<unknown, unknown, NormalizeProfileBody>, res: Response) => {
  try {
    const { profile, geometry } = req.body;
    const thickness = Number(req.body.thickness ?? profile?.thickness ?? 1.0);

    if (profile) {
      const result = normalizeProfileInput(profile);
      res.json({ success: true, ...result });
      return;
    }

    if (geometry) {
      const result = normalizeProfileGeometryInput(geometry, thickness);
      res.json({ success: true, ...result });
      return;
    }

    res.status(400).json({
      error: "Either profile{thickness,segments[]} or geometry is required",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Profile normalization failed";
    res.status(400).json({ error: message });
  }
});

export default router;
