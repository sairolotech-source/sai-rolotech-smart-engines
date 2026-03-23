import { Router, Response } from "express";
import { db, cncMaterials } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { AuthenticatedRequest } from "../middleware/auth";

const router = Router();

router.get("/materials", async (_req, res) => {
  try {
    const materials = await db.select().from(cncMaterials);
    res.json({ success: true, materials });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get("/materials/:id", async (req, res): Promise<void> => {
  try {
    const [material] = await db.select().from(cncMaterials).where(eq(cncMaterials.id, req.params.id));
    if (!material) { res.status(404).json({ success: false, error: "Material not found" }); return; }
    res.json({ success: true, material });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get("/materials/by-code/:code", async (req, res): Promise<void> => {
  try {
    const [material] = await db.select().from(cncMaterials).where(eq(cncMaterials.code, req.params.code));
    if (!material) { res.status(404).json({ success: false, error: "Material not found" }); return; }
    res.json({ success: true, material });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post("/materials", async (req, res) => {
  try {
    const matData = req.body;
    const [material] = await db.insert(cncMaterials).values(matData).returning();
    res.json({ success: true, material });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put("/materials/:id", async (req, res): Promise<void> => {
  try {
    const matData = req.body;
    const [material] = await db.update(cncMaterials)
      .set({ ...matData, updatedAt: new Date() })
      .where(eq(cncMaterials.id, req.params.id))
      .returning();
    if (!material) { res.status(404).json({ success: false, error: "Material not found" }); return; }
    res.json({ success: true, material });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete("/materials/:id", async (req, res): Promise<void> => {
  try {
    const [material] = await db.delete(cncMaterials)
      .where(eq(cncMaterials.id, req.params.id))
      .returning();
    if (!material) { res.status(404).json({ success: false, error: "Material not found" }); return; }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post("/materials/seed", async (_req, res): Promise<void> => {
  try {
    const existing = await db.select().from(cncMaterials);
    if (existing.length >= 30) {
      res.json({ success: true, message: "Materials already seeded", count: existing.length });
      return;
    }

    const existingCodes = new Set(existing.map((m: { code: string }) => m.code));
    const materials = getDefaultMaterials();
    let inserted = 0;
    for (const mat of materials) {
      if (!existingCodes.has(mat.code)) {
        await db.insert(cncMaterials).values(mat);
        inserted++;
      }
    }

    res.json({ success: true, message: `Seeded ${inserted} new materials`, count: existing.length + inserted });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

function getDefaultMaterials() {
  return [
    { code: "AISI1010", name: "AISI 1010 Low Carbon Steel", category: "Carbon Steel", isoGroup: "Non-alloy steel", isoGroupLetter: "P", hardnessMin: 95, hardnessMax: 137, hardnessScale: "HB", yieldStrength: 180, tensileStrength: 325, elasticModulus: 200000, density: 7870, elongation: 28, thermalExpansion: 12.2, kFactor: 0.42, springbackRatio: 2.5, maxBendAngle: 170, minBendRadius: 0.8, machinability: 55, roughingVc: 180, roughingFeed: 0.30, roughingDoc: 3.0, finishingVc: 220, finishingFeed: 0.08, finishingDoc: 0.30, maxSurfaceSpeed: 220, minSurfaceSpeed: 120, hardnessFactor: 0.9, color: "#9ca3af", isDefault: true },
    { code: "AISI1018", name: "AISI 1018 Mild Steel", category: "Carbon Steel", isoGroup: "Non-alloy steel", isoGroupLetter: "P", hardnessMin: 126, hardnessMax: 167, hardnessScale: "HB", yieldStrength: 300, tensileStrength: 400, elasticModulus: 200000, density: 7850, elongation: 25, thermalExpansion: 12.0, kFactor: 0.44, springbackRatio: 3.0, maxBendAngle: 165, minBendRadius: 1.0, machinability: 70, roughingVc: 160, roughingFeed: 0.30, roughingDoc: 3.0, finishingVc: 200, finishingFeed: 0.08, finishingDoc: 0.30, maxSurfaceSpeed: 200, minSurfaceSpeed: 100, hardnessFactor: 1.0, color: "#a8a29e", isDefault: true },
    { code: "AISI1045", name: "AISI 1045 Medium Carbon Steel", category: "Carbon Steel", isoGroup: "Non-alloy steel", isoGroupLetter: "P", hardnessMin: 170, hardnessMax: 210, hardnessScale: "HB", yieldStrength: 450, tensileStrength: 620, elasticModulus: 200000, density: 7850, elongation: 16, thermalExpansion: 11.5, kFactor: 0.46, springbackRatio: 4.0, maxBendAngle: 150, minBendRadius: 1.5, machinability: 57, roughingVc: 140, roughingFeed: 0.28, roughingDoc: 2.5, finishingVc: 180, finishingFeed: 0.08, finishingDoc: 0.25, maxSurfaceSpeed: 180, minSurfaceSpeed: 80, hardnessFactor: 1.1, color: "#78716c", isDefault: true },
    { code: "AISI4140", name: "AISI 4140 Alloy Steel", category: "Alloy Steel", isoGroup: "Low-alloy steel", isoGroupLetter: "P", hardnessMin: 197, hardnessMax: 285, hardnessScale: "HB", yieldStrength: 655, tensileStrength: 900, elasticModulus: 200000, density: 7850, elongation: 12, thermalExpansion: 11.2, kFactor: 0.48, springbackRatio: 5.0, maxBendAngle: 140, minBendRadius: 2.0, machinability: 50, roughingVc: 120, roughingFeed: 0.25, roughingDoc: 2.0, finishingVc: 160, finishingFeed: 0.07, finishingDoc: 0.25, maxSurfaceSpeed: 160, minSurfaceSpeed: 70, hardnessFactor: 1.2, color: "#57534e", isDefault: true },
    { code: "AISI4340", name: "AISI 4340 Alloy Steel", category: "Alloy Steel", isoGroup: "Low-alloy steel", isoGroupLetter: "P", hardnessMin: 217, hardnessMax: 321, hardnessScale: "HB", yieldStrength: 710, tensileStrength: 1020, elasticModulus: 200000, density: 7850, elongation: 10, thermalExpansion: 11.2, kFactor: 0.50, springbackRatio: 5.5, maxBendAngle: 135, minBendRadius: 2.5, machinability: 45, roughingVc: 100, roughingFeed: 0.22, roughingDoc: 2.0, finishingVc: 140, finishingFeed: 0.06, finishingDoc: 0.20, maxSurfaceSpeed: 140, minSurfaceSpeed: 60, hardnessFactor: 1.3, color: "#44403c", isDefault: true },
    { code: "GI", name: "Galvanized Iron", category: "Coated Steel", isoGroup: "Non-alloy steel", isoGroupLetter: "P", hardnessMin: 110, hardnessMax: 160, hardnessScale: "HB", yieldStrength: 280, tensileStrength: 380, elasticModulus: 200000, density: 7850, elongation: 22, thermalExpansion: 12.0, kFactor: 0.45, springbackRatio: 3.0, maxBendAngle: 160, minBendRadius: 1.0, machinability: 65, roughingVc: 180, roughingFeed: 0.30, roughingDoc: 3.0, finishingVc: 220, finishingFeed: 0.08, finishingDoc: 0.30, maxSurfaceSpeed: 220, minSurfaceSpeed: 120, hardnessFactor: 1.0, color: "#6b7280", isDefault: true },
    { code: "CR", name: "Cold Rolled Steel", category: "Carbon Steel", isoGroup: "Non-alloy steel", isoGroupLetter: "P", hardnessMin: 90, hardnessMax: 130, hardnessScale: "HB", yieldStrength: 250, tensileStrength: 340, elasticModulus: 200000, density: 7850, elongation: 28, thermalExpansion: 12.0, kFactor: 0.42, springbackRatio: 2.5, maxBendAngle: 170, minBendRadius: 0.8, machinability: 72, roughingVc: 200, roughingFeed: 0.28, roughingDoc: 2.5, finishingVc: 240, finishingFeed: 0.07, finishingDoc: 0.25, maxSurfaceSpeed: 240, minSurfaceSpeed: 140, hardnessFactor: 0.95, color: "#9ca3af", isDefault: true },
    { code: "HR", name: "Hot Rolled Steel", category: "Carbon Steel", isoGroup: "Non-alloy steel", isoGroupLetter: "P", hardnessMin: 130, hardnessMax: 190, hardnessScale: "HB", yieldStrength: 350, tensileStrength: 480, elasticModulus: 200000, density: 7850, elongation: 18, thermalExpansion: 12.0, kFactor: 0.48, springbackRatio: 4.0, maxBendAngle: 150, minBendRadius: 1.5, machinability: 50, roughingVc: 120, roughingFeed: 0.25, roughingDoc: 2.5, finishingVc: 160, finishingFeed: 0.07, finishingDoc: 0.25, maxSurfaceSpeed: 160, minSurfaceSpeed: 80, hardnessFactor: 1.1, color: "#78716c", isDefault: true },
    { code: "SS304", name: "Stainless Steel 304", category: "Stainless Steel", isoGroup: "Austenitic stainless", isoGroupLetter: "M", hardnessMin: 150, hardnessMax: 200, hardnessScale: "HB", yieldStrength: 520, tensileStrength: 720, elasticModulus: 193000, density: 7930, elongation: 40, thermalExpansion: 17.3, kFactor: 0.50, springbackRatio: 6.0, maxBendAngle: 140, minBendRadius: 2.0, machinability: 36, roughingVc: 80, roughingFeed: 0.15, roughingDoc: 2.0, finishingVc: 100, finishingFeed: 0.06, finishingDoc: 0.20, maxSurfaceSpeed: 100, minSurfaceSpeed: 50, hardnessFactor: 1.4, color: "#d1d5db", isDefault: true },
    { code: "SS316", name: "Stainless Steel 316", category: "Stainless Steel", isoGroup: "Austenitic stainless", isoGroupLetter: "M", hardnessMin: 150, hardnessMax: 190, hardnessScale: "HB", yieldStrength: 290, tensileStrength: 580, elasticModulus: 193000, density: 8000, elongation: 50, thermalExpansion: 16.0, kFactor: 0.50, springbackRatio: 6.5, maxBendAngle: 135, minBendRadius: 2.0, machinability: 30, roughingVc: 70, roughingFeed: 0.14, roughingDoc: 1.8, finishingVc: 90, finishingFeed: 0.05, finishingDoc: 0.18, maxSurfaceSpeed: 90, minSurfaceSpeed: 45, hardnessFactor: 1.5, color: "#c9cdd5", isDefault: true },
    { code: "SS430", name: "Stainless Steel 430", category: "Stainless Steel", isoGroup: "Ferritic stainless", isoGroupLetter: "M", hardnessMin: 150, hardnessMax: 185, hardnessScale: "HB", yieldStrength: 310, tensileStrength: 520, elasticModulus: 200000, density: 7700, elongation: 22, thermalExpansion: 10.4, kFactor: 0.48, springbackRatio: 5.0, maxBendAngle: 145, minBendRadius: 1.5, machinability: 40, roughingVc: 90, roughingFeed: 0.18, roughingDoc: 2.0, finishingVc: 120, finishingFeed: 0.06, finishingDoc: 0.20, maxSurfaceSpeed: 120, minSurfaceSpeed: 60, hardnessFactor: 1.3, color: "#bcc0c8", isDefault: true },
    { code: "SS2205", name: "Duplex Stainless 2205", category: "Stainless Steel", isoGroup: "Duplex stainless", isoGroupLetter: "M", hardnessMin: 220, hardnessMax: 290, hardnessScale: "HB", yieldStrength: 450, tensileStrength: 680, elasticModulus: 200000, density: 7800, elongation: 25, thermalExpansion: 13.0, kFactor: 0.52, springbackRatio: 7.0, maxBendAngle: 130, minBendRadius: 2.5, machinability: 25, roughingVc: 60, roughingFeed: 0.12, roughingDoc: 1.5, finishingVc: 80, finishingFeed: 0.05, finishingDoc: 0.15, maxSurfaceSpeed: 80, minSurfaceSpeed: 40, hardnessFactor: 1.6, color: "#a3a8b2", isDefault: true },
    { code: "AL6061", name: "Aluminum 6061-T6", category: "Aluminum", isoGroup: "Wrought aluminum", isoGroupLetter: "N", hardnessMin: 85, hardnessMax: 105, hardnessScale: "HB", yieldStrength: 276, tensileStrength: 310, elasticModulus: 69000, density: 2700, elongation: 12, thermalExpansion: 23.6, kFactor: 0.38, springbackRatio: 3.5, maxBendAngle: 130, minBendRadius: 2.0, machinability: 90, roughingVc: 300, roughingFeed: 0.35, roughingDoc: 4.0, finishingVc: 400, finishingFeed: 0.10, finishingDoc: 0.40, maxSurfaceSpeed: 400, minSurfaceSpeed: 200, hardnessFactor: 0.6, color: "#e5e7eb", isDefault: true },
    { code: "AL7075", name: "Aluminum 7075-T6", category: "Aluminum", isoGroup: "Wrought aluminum", isoGroupLetter: "N", hardnessMin: 140, hardnessMax: 160, hardnessScale: "HB", yieldStrength: 503, tensileStrength: 572, elasticModulus: 72000, density: 2810, elongation: 11, thermalExpansion: 23.4, kFactor: 0.40, springbackRatio: 4.0, maxBendAngle: 120, minBendRadius: 2.5, machinability: 85, roughingVc: 280, roughingFeed: 0.30, roughingDoc: 3.5, finishingVc: 380, finishingFeed: 0.08, finishingDoc: 0.35, maxSurfaceSpeed: 380, minSurfaceSpeed: 180, hardnessFactor: 0.65, color: "#d4d8e0", isDefault: true },
    { code: "AL2024", name: "Aluminum 2024-T4", category: "Aluminum", isoGroup: "Wrought aluminum", isoGroupLetter: "N", hardnessMin: 110, hardnessMax: 130, hardnessScale: "HB", yieldStrength: 324, tensileStrength: 469, elasticModulus: 73000, density: 2780, elongation: 20, thermalExpansion: 23.2, kFactor: 0.39, springbackRatio: 3.5, maxBendAngle: 125, minBendRadius: 2.0, machinability: 80, roughingVc: 290, roughingFeed: 0.32, roughingDoc: 3.5, finishingVc: 380, finishingFeed: 0.09, finishingDoc: 0.35, maxSurfaceSpeed: 380, minSurfaceSpeed: 190, hardnessFactor: 0.62, color: "#c8ccd4", isDefault: true },
    { code: "AL5052", name: "Aluminum 5052-H32", category: "Aluminum", isoGroup: "Wrought aluminum", isoGroupLetter: "N", hardnessMin: 60, hardnessMax: 73, hardnessScale: "HB", yieldStrength: 193, tensileStrength: 228, elasticModulus: 70000, density: 2680, elongation: 12, thermalExpansion: 23.8, kFactor: 0.37, springbackRatio: 3.0, maxBendAngle: 135, minBendRadius: 1.5, machinability: 80, roughingVc: 310, roughingFeed: 0.35, roughingDoc: 4.0, finishingVc: 400, finishingFeed: 0.10, finishingDoc: 0.40, maxSurfaceSpeed: 400, minSurfaceSpeed: 200, hardnessFactor: 0.58, color: "#dde0e6", isDefault: true },
    { code: "CU-C11000", name: "Copper C11000 (ETP)", category: "Copper", isoGroup: "Copper alloys", isoGroupLetter: "N", hardnessMin: 40, hardnessMax: 65, hardnessScale: "HB", yieldStrength: 200, tensileStrength: 260, elasticModulus: 117000, density: 8960, elongation: 35, thermalExpansion: 17.0, kFactor: 0.40, springbackRatio: 2.0, maxBendAngle: 170, minBendRadius: 0.5, machinability: 20, roughingVc: 200, roughingFeed: 0.25, roughingDoc: 2.5, finishingVc: 280, finishingFeed: 0.08, finishingDoc: 0.25, maxSurfaceSpeed: 280, minSurfaceSpeed: 120, hardnessFactor: 0.8, color: "#b45309", isDefault: true },
    { code: "CU-C26000", name: "Brass C26000 (Cartridge)", category: "Copper", isoGroup: "Copper alloys", isoGroupLetter: "N", hardnessMin: 55, hardnessMax: 105, hardnessScale: "HB", yieldStrength: 130, tensileStrength: 340, elasticModulus: 110000, density: 8530, elongation: 66, thermalExpansion: 19.9, kFactor: 0.38, springbackRatio: 1.8, maxBendAngle: 175, minBendRadius: 0.5, machinability: 30, roughingVc: 250, roughingFeed: 0.28, roughingDoc: 3.0, finishingVc: 350, finishingFeed: 0.10, finishingDoc: 0.30, maxSurfaceSpeed: 350, minSurfaceSpeed: 150, hardnessFactor: 0.7, color: "#ca8a04", isDefault: true },
    { code: "CU-C36000", name: "Free-Cutting Brass C36000", category: "Copper", isoGroup: "Copper alloys", isoGroupLetter: "N", hardnessMin: 60, hardnessMax: 100, hardnessScale: "HB", yieldStrength: 140, tensileStrength: 370, elasticModulus: 97000, density: 8500, elongation: 53, thermalExpansion: 20.5, kFactor: 0.37, springbackRatio: 1.5, maxBendAngle: 175, minBendRadius: 0.5, machinability: 100, roughingVc: 300, roughingFeed: 0.30, roughingDoc: 3.5, finishingVc: 400, finishingFeed: 0.12, finishingDoc: 0.35, maxSurfaceSpeed: 400, minSurfaceSpeed: 180, hardnessFactor: 0.65, color: "#d4a017", isDefault: true },
    { code: "TI-GR2", name: "Titanium Grade 2 (CP)", category: "Titanium", isoGroup: "Commercially pure Ti", isoGroupLetter: "S", hardnessMin: 145, hardnessMax: 200, hardnessScale: "HB", yieldStrength: 275, tensileStrength: 345, elasticModulus: 105000, density: 4510, elongation: 20, thermalExpansion: 8.6, kFactor: 0.50, springbackRatio: 7.0, maxBendAngle: 130, minBendRadius: 3.0, machinability: 20, roughingVc: 50, roughingFeed: 0.15, roughingDoc: 1.5, finishingVc: 70, finishingFeed: 0.05, finishingDoc: 0.15, maxSurfaceSpeed: 70, minSurfaceSpeed: 30, hardnessFactor: 1.5, color: "#b4b8c0", isDefault: true },
    { code: "TI-6AL4V", name: "Titanium Ti-6Al-4V (Grade 5)", category: "Titanium", isoGroup: "Alpha-beta Ti alloy", isoGroupLetter: "S", hardnessMin: 300, hardnessMax: 380, hardnessScale: "HB", yieldStrength: 880, tensileStrength: 950, elasticModulus: 116000, density: 4430, elongation: 10, thermalExpansion: 8.6, kFactor: 0.52, springbackRatio: 8.0, maxBendAngle: 120, minBendRadius: 4.0, machinability: 15, roughingVc: 40, roughingFeed: 0.12, roughingDoc: 1.0, finishingVc: 60, finishingFeed: 0.04, finishingDoc: 0.10, maxSurfaceSpeed: 60, minSurfaceSpeed: 25, hardnessFactor: 1.8, color: "#a1a5ad", isDefault: true },
    { code: "INCONEL718", name: "Inconel 718", category: "Superalloy", isoGroup: "Nickel-based superalloy", isoGroupLetter: "S", hardnessMin: 330, hardnessMax: 400, hardnessScale: "HB", yieldStrength: 1036, tensileStrength: 1241, elasticModulus: 200000, density: 8190, elongation: 12, thermalExpansion: 13.0, kFactor: 0.55, springbackRatio: 9.0, maxBendAngle: 110, minBendRadius: 5.0, machinability: 10, roughingVc: 25, roughingFeed: 0.10, roughingDoc: 0.8, finishingVc: 35, finishingFeed: 0.04, finishingDoc: 0.10, maxSurfaceSpeed: 35, minSurfaceSpeed: 15, hardnessFactor: 2.2, color: "#7a7e86", isDefault: true },
    { code: "HASTELLOY-C276", name: "Hastelloy C-276", category: "Superalloy", isoGroup: "Nickel-based superalloy", isoGroupLetter: "S", hardnessMin: 160, hardnessMax: 240, hardnessScale: "HB", yieldStrength: 355, tensileStrength: 785, elasticModulus: 205000, density: 8890, elongation: 60, thermalExpansion: 11.2, kFactor: 0.54, springbackRatio: 8.5, maxBendAngle: 115, minBendRadius: 4.5, machinability: 12, roughingVc: 20, roughingFeed: 0.08, roughingDoc: 0.8, finishingVc: 30, finishingFeed: 0.04, finishingDoc: 0.10, maxSurfaceSpeed: 30, minSurfaceSpeed: 12, hardnessFactor: 2.0, color: "#6b6f77", isDefault: true },
    { code: "D2", name: "Tool Steel D2", category: "Tool Steel", isoGroup: "High-carbon chromium", isoGroupLetter: "H", hardnessMin: 55, hardnessMax: 62, hardnessScale: "HRC", yieldStrength: 1600, tensileStrength: 1850, elasticModulus: 210000, density: 7700, elongation: 2, thermalExpansion: 10.4, kFactor: 0.55, springbackRatio: 10.0, maxBendAngle: 90, minBendRadius: 5.0, machinability: 8, roughingVc: 40, roughingFeed: 0.10, roughingDoc: 1.0, finishingVc: 60, finishingFeed: 0.04, finishingDoc: 0.10, maxSurfaceSpeed: 80, minSurfaceSpeed: 40, hardnessFactor: 1.8, color: "#4a4e56", isDefault: true },
    { code: "H13", name: "Tool Steel H13", category: "Tool Steel", isoGroup: "Hot work tool steel", isoGroupLetter: "H", hardnessMin: 44, hardnessMax: 52, hardnessScale: "HRC", yieldStrength: 1200, tensileStrength: 1500, elasticModulus: 210000, density: 7800, elongation: 8, thermalExpansion: 11.5, kFactor: 0.52, springbackRatio: 8.0, maxBendAngle: 100, minBendRadius: 4.0, machinability: 12, roughingVc: 50, roughingFeed: 0.12, roughingDoc: 1.2, finishingVc: 70, finishingFeed: 0.05, finishingDoc: 0.12, maxSurfaceSpeed: 90, minSurfaceSpeed: 45, hardnessFactor: 1.7, color: "#5a5e66", isDefault: true },
    { code: "A2", name: "Tool Steel A2", category: "Tool Steel", isoGroup: "Air-hardening tool steel", isoGroupLetter: "H", hardnessMin: 57, hardnessMax: 62, hardnessScale: "HRC", yieldStrength: 1480, tensileStrength: 1790, elasticModulus: 210000, density: 7860, elongation: 3, thermalExpansion: 10.8, kFactor: 0.54, springbackRatio: 9.5, maxBendAngle: 95, minBendRadius: 5.0, machinability: 9, roughingVc: 35, roughingFeed: 0.10, roughingDoc: 0.8, finishingVc: 55, finishingFeed: 0.04, finishingDoc: 0.10, maxSurfaceSpeed: 70, minSurfaceSpeed: 35, hardnessFactor: 1.85, color: "#50545c", isDefault: true },
    { code: "GGG40", name: "Ductile Iron GGG40", category: "Cast Iron", isoGroup: "Ductile cast iron", isoGroupLetter: "K", hardnessMin: 130, hardnessMax: 175, hardnessScale: "HB", yieldStrength: 250, tensileStrength: 400, elasticModulus: 169000, density: 7100, elongation: 15, thermalExpansion: 12.5, kFactor: 0.46, springbackRatio: 3.0, maxBendAngle: 0, minBendRadius: 0, machinability: 65, roughingVc: 140, roughingFeed: 0.28, roughingDoc: 2.5, finishingVc: 180, finishingFeed: 0.08, finishingDoc: 0.25, maxSurfaceSpeed: 180, minSurfaceSpeed: 80, hardnessFactor: 1.0, color: "#525252", isDefault: true },
    { code: "GG25", name: "Grey Cast Iron GG25", category: "Cast Iron", isoGroup: "Grey cast iron", isoGroupLetter: "K", hardnessMin: 170, hardnessMax: 240, hardnessScale: "HB", yieldStrength: 0, tensileStrength: 250, elasticModulus: 100000, density: 7200, elongation: 0, thermalExpansion: 11.0, kFactor: 0, springbackRatio: 0, maxBendAngle: 0, minBendRadius: 0, machinability: 75, roughingVc: 160, roughingFeed: 0.30, roughingDoc: 3.0, finishingVc: 200, finishingFeed: 0.10, finishingDoc: 0.30, maxSurfaceSpeed: 200, minSurfaceSpeed: 90, hardnessFactor: 0.9, color: "#404040", isDefault: true },
    { code: "HSLA", name: "HSLA Steel", category: "Alloy Steel", isoGroup: "High-strength low-alloy", isoGroupLetter: "P", hardnessMin: 200, hardnessMax: 280, hardnessScale: "HB", yieldStrength: 550, tensileStrength: 650, elasticModulus: 200000, density: 7850, elongation: 15, thermalExpansion: 12.0, kFactor: 0.50, springbackRatio: 5.5, maxBendAngle: 135, minBendRadius: 2.5, machinability: 45, roughingVc: 110, roughingFeed: 0.22, roughingDoc: 2.0, finishingVc: 150, finishingFeed: 0.06, finishingDoc: 0.20, maxSurfaceSpeed: 150, minSurfaceSpeed: 70, hardnessFactor: 1.25, color: "#71717a", isDefault: true },
    { code: "PP", name: "Polypropylene (PP)", category: "Polymer", isoGroup: "Thermoplastic", isoGroupLetter: "N", hardnessMin: 70, hardnessMax: 85, hardnessScale: "Shore D", yieldStrength: 35, tensileStrength: 40, elasticModulus: 1500, density: 946, elongation: 100, thermalExpansion: 150, kFactor: 0.35, springbackRatio: 15.0, maxBendAngle: 180, minBendRadius: 0.3, machinability: 95, roughingVc: 300, roughingFeed: 0.20, roughingDoc: 3.0, finishingVc: 400, finishingFeed: 0.08, finishingDoc: 0.30, maxSurfaceSpeed: 400, minSurfaceSpeed: 150, hardnessFactor: 0.3, color: "#fef3c7", isDefault: true },
    { code: "PEEK", name: "PEEK (Polyether Ether Ketone)", category: "Polymer", isoGroup: "High-performance polymer", isoGroupLetter: "N", hardnessMin: 80, hardnessMax: 90, hardnessScale: "Shore D", yieldStrength: 100, tensileStrength: 170, elasticModulus: 4100, density: 1310, elongation: 30, thermalExpansion: 47, kFactor: 0.38, springbackRatio: 10.0, maxBendAngle: 160, minBendRadius: 1.0, machinability: 70, roughingVc: 200, roughingFeed: 0.15, roughingDoc: 2.0, finishingVc: 300, finishingFeed: 0.06, finishingDoc: 0.20, maxSurfaceSpeed: 300, minSurfaceSpeed: 100, hardnessFactor: 0.4, color: "#e8d5b7", isDefault: true },
    { code: "MS", name: "Mild Steel (General)", category: "Carbon Steel", isoGroup: "Non-alloy steel", isoGroupLetter: "P", hardnessMin: 115, hardnessMax: 155, hardnessScale: "HB", yieldStrength: 300, tensileStrength: 400, elasticModulus: 200000, density: 7850, elongation: 25, thermalExpansion: 12.0, kFactor: 0.44, springbackRatio: 3.0, maxBendAngle: 165, minBendRadius: 1.0, machinability: 70, roughingVc: 160, roughingFeed: 0.30, roughingDoc: 3.0, finishingVc: 200, finishingFeed: 0.08, finishingDoc: 0.30, maxSurfaceSpeed: 200, minSurfaceSpeed: 100, hardnessFactor: 1.0, color: "#a8a29e", isDefault: true },
    { code: "SS17-4PH", name: "17-4 PH Stainless (H900)", category: "Stainless Steel", isoGroup: "Precipitation hardened stainless", isoGroupLetter: "M", hardnessMin: 35, hardnessMax: 44, hardnessScale: "HRC", yieldStrength: 1170, tensileStrength: 1310, elasticModulus: 196000, density: 7810, elongation: 10, thermalExpansion: 10.8, kFactor: 0.52, springbackRatio: 7.5, maxBendAngle: 120, minBendRadius: 3.0, machinability: 25, roughingVc: 60, roughingFeed: 0.12, roughingDoc: 1.5, finishingVc: 85, finishingFeed: 0.05, finishingDoc: 0.15, maxSurfaceSpeed: 85, minSurfaceSpeed: 40, hardnessFactor: 1.55, color: "#a0a4ac", isDefault: true },
  ];
}

export default router;
