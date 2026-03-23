import { Router, Response } from "express";
import { db, cncTools, cncToolCuttingData } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import type { AuthenticatedRequest } from "../middleware/auth";

const router = Router();

router.get("/tools", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.authUser!.uid;
    const { category, search, subType } = req.query;

    let conditions = [eq(cncTools.userId, userId), eq(cncTools.isActive, true)];
    if (category && category !== "all") {
      conditions.push(eq(cncTools.category, category as string));
    }
    if (subType) {
      conditions.push(eq(cncTools.subType, subType as string));
    }

    let tools = await db.select().from(cncTools).where(and(...conditions));

    if (search) {
      const s = (search as string).toLowerCase();
      tools = tools.filter(t =>
        t.name.toLowerCase().includes(s) ||
        (t.isoDesignation && t.isoDesignation.toLowerCase().includes(s)) ||
        t.subType.toLowerCase().includes(s)
      );
    }

    res.json({ success: true, tools });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get("/tools/:id", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.authUser!.uid;
    const [tool] = await db.select().from(cncTools)
      .where(and(eq(cncTools.id, req.params.id), eq(cncTools.userId, userId)));
    if (!tool) return res.status(404).json({ success: false, error: "Tool not found" });

    const cuttingData = await db.select().from(cncToolCuttingData)
      .where(eq(cncToolCuttingData.toolId, tool.id));

    res.json({ success: true, tool, cuttingData });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post("/tools", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.authUser!.uid;
    const { cuttingData, ...toolData } = req.body;

    const [tool] = await db.insert(cncTools).values({ ...toolData, userId }).returning();

    if (cuttingData && Array.isArray(cuttingData)) {
      for (const cd of cuttingData) {
        await db.insert(cncToolCuttingData).values({ ...cd, toolId: tool.id });
      }
    }

    res.json({ success: true, tool });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put("/tools/:id", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.authUser!.uid;
    const { cuttingData, ...toolData } = req.body;

    const [tool] = await db.update(cncTools)
      .set({ ...toolData, updatedAt: new Date() })
      .where(and(eq(cncTools.id, req.params.id), eq(cncTools.userId, userId)))
      .returning();

    if (!tool) return res.status(404).json({ success: false, error: "Tool not found" });

    if (cuttingData && Array.isArray(cuttingData)) {
      await db.delete(cncToolCuttingData).where(eq(cncToolCuttingData.toolId, tool.id));
      for (const cd of cuttingData) {
        await db.insert(cncToolCuttingData).values({ ...cd, toolId: tool.id });
      }
    }

    res.json({ success: true, tool });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete("/tools/:id", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.authUser!.uid;
    const [tool] = await db.update(cncTools)
      .set({ isActive: false, updatedAt: new Date() })
      .where(and(eq(cncTools.id, req.params.id), eq(cncTools.userId, userId)))
      .returning();

    if (!tool) return res.status(404).json({ success: false, error: "Tool not found" });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get("/tools/:id/cutting-data", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.authUser!.uid;
    const [tool] = await db.select().from(cncTools)
      .where(and(eq(cncTools.id, req.params.id), eq(cncTools.userId, userId)));
    if (!tool) return res.status(404).json({ success: false, error: "Tool not found" });

    const data = await db.select().from(cncToolCuttingData)
      .where(eq(cncToolCuttingData.toolId, tool.id));
    res.json({ success: true, cuttingData: data });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post("/tools/:id/cutting-data", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.authUser!.uid;
    const [tool] = await db.select().from(cncTools)
      .where(and(eq(cncTools.id, req.params.id), eq(cncTools.userId, userId)));
    if (!tool) return res.status(404).json({ success: false, error: "Tool not found" });

    const [entry] = await db.insert(cncToolCuttingData)
      .values({ ...req.body, toolId: tool.id })
      .returning();
    res.json({ success: true, cuttingData: entry });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put("/tools/:id/cutting-data/:cdId", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.authUser!.uid;
    const [tool] = await db.select().from(cncTools)
      .where(and(eq(cncTools.id, req.params.id), eq(cncTools.userId, userId)));
    if (!tool) return res.status(404).json({ success: false, error: "Tool not found" });

    const [entry] = await db.update(cncToolCuttingData)
      .set(req.body)
      .where(and(eq(cncToolCuttingData.id, req.params.cdId), eq(cncToolCuttingData.toolId, tool.id)))
      .returning();
    if (!entry) return res.status(404).json({ success: false, error: "Cutting data entry not found" });
    res.json({ success: true, cuttingData: entry });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete("/tools/:id/cutting-data/:cdId", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.authUser!.uid;
    const [tool] = await db.select().from(cncTools)
      .where(and(eq(cncTools.id, req.params.id), eq(cncTools.userId, userId)));
    if (!tool) return res.status(404).json({ success: false, error: "Tool not found" });

    const [entry] = await db.delete(cncToolCuttingData)
      .where(and(eq(cncToolCuttingData.id, req.params.cdId), eq(cncToolCuttingData.toolId, tool.id)))
      .returning();
    if (!entry) return res.status(404).json({ success: false, error: "Cutting data entry not found" });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post("/tools/seed-defaults", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.authUser!.uid;

    const existing = await db.select().from(cncTools)
      .where(and(eq(cncTools.userId, userId), eq(cncTools.isActive, true)));
    if (existing.length > 0) {
      return res.json({ success: true, message: "Tools already exist", count: existing.length });
    }

    const defaultTools = getDefaultTools(userId);
    for (const tool of defaultTools) {
      await db.insert(cncTools).values(tool);
    }

    res.json({ success: true, message: `Seeded ${defaultTools.length} default tools` });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

function getDefaultTools(userId: string) {
  return [
    { userId, name: "CNMG 120404-PR", category: "turning", subType: "od_roughing", isoDesignation: "CNMG 120404", noseRadius: 0.4, noseAngle: 80, reliefAngle: 0, icDiameter: 12.7, chipBreaker: "PR", coatingType: "CVD TiCN+Al2O3", gradeCode: "P25", holderCode: "MCLNR 2020K-12", holderReach: 100, holderOverhang: 30, insertThickness: 4.76, cuttingEdgeCount: 4 },
    { userId, name: "CNMG 120408-PR", category: "turning", subType: "od_roughing", isoDesignation: "CNMG 120408", noseRadius: 0.8, noseAngle: 80, reliefAngle: 0, icDiameter: 12.7, chipBreaker: "PR", coatingType: "CVD TiCN+Al2O3", gradeCode: "P25", holderCode: "MCLNR 2020K-12", holderReach: 100, holderOverhang: 30, insertThickness: 4.76, cuttingEdgeCount: 4 },
    { userId, name: "CNMG 160608-PR", category: "turning", subType: "od_roughing", isoDesignation: "CNMG 160608", noseRadius: 0.8, noseAngle: 80, reliefAngle: 0, icDiameter: 16, chipBreaker: "PR", coatingType: "CVD TiCN+Al2O3", gradeCode: "P30", holderCode: "MCLNR 2525M-16", holderReach: 130, holderOverhang: 40, insertThickness: 6.35, cuttingEdgeCount: 4 },
    { userId, name: "CNMG 120404-MF", category: "turning", subType: "od_finishing", isoDesignation: "CNMG 120404", noseRadius: 0.4, noseAngle: 80, reliefAngle: 0, icDiameter: 12.7, chipBreaker: "MF", coatingType: "PVD TiAlN", gradeCode: "M20", holderCode: "MCLNR 2020K-12", holderReach: 100, holderOverhang: 30, insertThickness: 4.76, cuttingEdgeCount: 4 },
    { userId, name: "DNMG 150604-PF", category: "turning", subType: "od_finishing", isoDesignation: "DNMG 150604", noseRadius: 0.4, noseAngle: 55, reliefAngle: 0, icDiameter: 12.7, chipBreaker: "PF", coatingType: "CVD TiCN+Al2O3", gradeCode: "P15", holderCode: "MDJNR 2020K-15", holderReach: 100, holderOverhang: 30, insertThickness: 6.35, cuttingEdgeCount: 2 },
    { userId, name: "VNMG 160404-PF", category: "turning", subType: "profiling", isoDesignation: "VNMG 160404", noseRadius: 0.4, noseAngle: 35, reliefAngle: 0, icDiameter: 9.525, chipBreaker: "PF", coatingType: "CVD TiCN+Al2O3", gradeCode: "P20", holderCode: "MVJNR 2020K-16", holderReach: 100, holderOverhang: 30, insertThickness: 4.76, cuttingEdgeCount: 2 },
    { userId, name: "VNMG 110302-PF", category: "turning", subType: "profiling", isoDesignation: "VNMG 110302", noseRadius: 0.2, noseAngle: 35, reliefAngle: 0, icDiameter: 6.35, chipBreaker: "PF", coatingType: "PVD TiAlN", gradeCode: "P20", holderCode: "MVJNR 2020K-11", holderReach: 85, holderOverhang: 25, insertThickness: 3.18, cuttingEdgeCount: 2 },
    { userId, name: "WNMG 080408-MR", category: "turning", subType: "od_roughing", isoDesignation: "WNMG 080408", noseRadius: 0.8, noseAngle: 80, reliefAngle: 0, icDiameter: 12.7, chipBreaker: "MR", coatingType: "Uncoated K10", gradeCode: "K10", holderCode: "MWLNR 2020K-08", holderReach: 100, holderOverhang: 30, insertThickness: 4.76, cuttingEdgeCount: 6 },
    { userId, name: "VCMT 110302-AK", category: "turning", subType: "od_finishing", isoDesignation: "VCMT 110302", noseRadius: 0.2, noseAngle: 35, reliefAngle: 7, icDiameter: 6.35, chipBreaker: "AK", coatingType: "Uncoated", gradeCode: "K10", holderCode: "MVJNR 2020K-11", holderReach: 85, holderOverhang: 25, insertThickness: 3.18, cuttingEdgeCount: 2, notes: "For aluminium - sharp edge prevents BUE" },
    { userId, name: "CCMT 060204-MF", category: "turning", subType: "boring", isoDesignation: "CCMT 060204", noseRadius: 0.4, noseAngle: 80, reliefAngle: 7, icDiameter: 6.35, chipBreaker: "MF", coatingType: "PVD TiAlN", gradeCode: "M20", holderCode: "Boring bar Ø16", holderReach: 60, holderOverhang: 50, insertThickness: 2.38, cuttingEdgeCount: 2 },
    { userId, name: "MGMN 250-G (2.5mm)", category: "turning", subType: "grooving", isoDesignation: "MGMN 250", noseRadius: 0, noseAngle: 0, reliefAngle: 0, icDiameter: 0, chipBreaker: "G", coatingType: "CVD TiCN", gradeCode: "P25", holderCode: "MGEHR 2020-3", holderReach: 70, holderOverhang: 25, insertThickness: 3.18, cuttingEdgeCount: 2, diameter: 2.5 },
    { userId, name: "MGMN 400-G Cutoff (4mm)", category: "turning", subType: "cutoff", isoDesignation: "MGMN 400", noseRadius: 0, noseAngle: 0, reliefAngle: 0, icDiameter: 0, chipBreaker: "G", coatingType: "CVD TiCN", gradeCode: "P30", holderCode: "MGEHR 2525-4", holderReach: 80, holderOverhang: 30, insertThickness: 4.76, cuttingEdgeCount: 2, diameter: 4.0 },
    { userId, name: "16ER 2.0 ISO", category: "turning", subType: "threading", isoDesignation: "16ER 2.0 ISO", noseRadius: 0, noseAngle: 60, reliefAngle: 0, icDiameter: 9.525, coatingType: "PVD TiN", gradeCode: "P20", holderCode: "SER 2020K-16", holderReach: 80, holderOverhang: 25, insertThickness: 3.5, cuttingEdgeCount: 2 },
    { userId, name: "Ø25 HSS-Co Drill", category: "drilling", subType: "twist_drill", diameter: 25, fluteCount: 2, helixAngle: 30, fluteLength: 120, overallLength: 200, coatingType: "TiN", notes: "HSS-Co for general purpose drilling" },
    { userId, name: "Ø20 Carbide Drill", category: "drilling", subType: "carbide_drill", diameter: 20, fluteCount: 2, helixAngle: 30, fluteLength: 100, overallLength: 180, coatingType: "TiAlN", notes: "Solid carbide for high-speed drilling" },
    { userId, name: "M8×1.25 Tap HSS", category: "drilling", subType: "tap", diameter: 8, fluteCount: 3, overallLength: 80, notes: "HSS spiral flute tap M8×1.25" },
    { userId, name: "Ø10 4F End Mill", category: "milling", subType: "end_mill", diameter: 10, fluteCount: 4, helixAngle: 35, fluteLength: 25, overallLength: 75, cornerRadius: 0, coatingType: "TiAlN", gradeCode: "Carbide" },
    { userId, name: "Ø16 2F End Mill", category: "milling", subType: "end_mill", diameter: 16, fluteCount: 2, helixAngle: 30, fluteLength: 40, overallLength: 100, cornerRadius: 0, coatingType: "TiCN", gradeCode: "Carbide" },
    { userId, name: "Ø50 Face Mill", category: "milling", subType: "face_mill", diameter: 50, fluteCount: 5, overallLength: 40, coatingType: "CVD", notes: "Indexable face mill with 5 inserts" },
    { userId, name: "Ø8 Ball Nose", category: "milling", subType: "ball_nose", diameter: 8, fluteCount: 2, helixAngle: 30, fluteLength: 16, overallLength: 60, cornerRadius: 4, coatingType: "TiAlN", gradeCode: "Carbide" },
    { userId, name: "45° Chamfer Mill", category: "milling", subType: "chamfer_mill", diameter: 12, fluteCount: 4, overallLength: 60, coatingType: "TiN", notes: "45° included angle chamfer mill" },
    { userId, name: "Ø8 H7 Reamer", category: "drilling", subType: "reamer", diameter: 8, fluteCount: 6, overallLength: 100, coatingType: "TiN", notes: "H7 tolerance precision reamer" },
    { userId, name: "FreeTurn FT XNMU", category: "turning", subType: "freeturn", isoDesignation: "FT XNMU", noseRadius: 0.4, noseAngle: 0, reliefAngle: 0, coatingType: "PVD TiAlN", gradeCode: "P25", holderCode: "Ceratizit HDT Holder", holderReach: 120, holderOverhang: 35, cuttingEdgeCount: 1, notes: "All-directional single tool turning" },
    { userId, name: "35° Chamfer Insert", category: "turning", subType: "chamfering", noseRadius: 0.2, noseAngle: 35, reliefAngle: 7, coatingType: "PVD TiN", gradeCode: "P20", holderCode: "Chamfer holder", holderReach: 80, holderOverhang: 25, cuttingEdgeCount: 2 },
  ];
}

export default router;
