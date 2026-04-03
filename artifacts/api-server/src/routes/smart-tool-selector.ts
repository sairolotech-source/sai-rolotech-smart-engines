import { Router } from "express";
import { selectToolsForDelta2X } from "../lib/smart-tool-selector.js";
import type { FlowerStation } from "../lib/power-pattern.js";
import type { ProfileGeometry } from "../lib/dxf-parser-util.js";

const router = Router();

router.post("/api/smart-tool-selector", (req, res) => {
  try {
    const { stations, geometry, materialType } = req.body as {
      stations: FlowerStation[];
      geometry: ProfileGeometry;
      materialType?: string;
    };

    if (!stations || !Array.isArray(stations) || stations.length === 0) {
      return res.status(400).json({ error: "stations array required" });
    }

    const geo: ProfileGeometry = geometry ?? {
      bends: [],
      segments: [],
      profileType: "unknown",
      totalAngle: 0,
      stripWidth: stations[0]?.stripWidth ?? 200,
    };

    const result = selectToolsForDelta2X(geo, stations, materialType ?? "GI");
    return res.json({ success: true, result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Tool selection failed";
    return res.status(400).json({ error: message });
  }
});

export default router;
