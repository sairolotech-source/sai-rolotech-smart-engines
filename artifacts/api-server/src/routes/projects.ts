import { Router, type IRouter, type Response } from "express";
import type { AuthenticatedRequest } from "../middleware/auth";
import { db, rfProjects, rfBends, rfAnalysisResults } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";

const router: IRouter = Router();

router.get("/projects", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.authUser!.uid;
    const projects = await db
      .select()
      .from(rfProjects)
      .where(eq(rfProjects.userId, userId))
      .orderBy(desc(rfProjects.updatedAt));
    res.json({ success: true, projects });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to fetch projects";
    res.status(500).json({ error: message });
  }
});

router.get("/projects/:id", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = String(req.params.id);
    const userId = req.authUser!.uid;
    const [project] = await db.select().from(rfProjects).where(and(eq(rfProjects.id, id), eq(rfProjects.userId, userId)));
    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    const bends = await db.select().from(rfBends).where(eq(rfBends.projectId, id));
    const [analysis] = await db
      .select()
      .from(rfAnalysisResults)
      .where(eq(rfAnalysisResults.projectId, id))
      .orderBy(desc(rfAnalysisResults.createdAt));
    res.json({ success: true, project, bends, analysis: analysis || null });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to fetch project";
    res.status(500).json({ error: message });
  }
});

router.post("/projects", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.authUser!.uid;
    const {
      projectName,
      material = "GI",
      thickness = 1.0,
      numStations = 5,
      stationPrefix = "S",
      lineSpeed = 20,
      rollDiameter = 150,
      shaftDiameter = 40,
      clearance = 0.05,
      profileName = "",
      fileName = "",
      bends = [],
      analysis = null,
    } = req.body;

    if (!projectName) {
      res.status(400).json({ error: "projectName is required" });
      return;
    }

    const [project] = await db
      .insert(rfProjects)
      .values({
        userId,
        projectName,
        material,
        thickness: String(thickness),
        numStations,
        stationPrefix,
        lineSpeed: String(lineSpeed),
        rollDiameter: String(rollDiameter),
        shaftDiameter: String(shaftDiameter),
        clearance: String(clearance),
        profileName,
        fileName,
      })
      .returning();

    if (bends && bends.length > 0) {
      await db.insert(rfBends).values(
        bends.map((b: { bend_angle?: number; bend_radius?: number; flange_length?: number; side?: string }, i: number) => ({
          projectId: project.id,
          bendOrder: i + 1,
          bendAngle: b.bend_angle != null ? String(b.bend_angle) : null,
          bendRadius: b.bend_radius != null ? String(b.bend_radius) : null,
          flangeLength: b.flange_length != null ? String(b.flange_length) : null,
          side: b.side || "left",
        }))
      );
    }

    if (analysis) {
      await db.insert(rfAnalysisResults).values({
        projectId: project.id,
        bendCount: analysis.bendCount ?? 0,
        suggestedPasses: analysis.suggestedPasses ?? 0,
        riskLevel: analysis.riskLevel ?? "low",
        totalBendAngle: analysis.totalBendAngle != null ? String(analysis.totalBendAngle) : null,
        notes: analysis.notes ?? {},
      });
    }

    res.json({ success: true, project });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to save project";
    res.status(500).json({ error: message });
  }
});

router.delete("/projects/:id", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = String(req.params.id);
    const userId = req.authUser!.uid;
    await db.delete(rfProjects).where(and(eq(rfProjects.id, id), eq(rfProjects.userId, userId)));
    res.json({ success: true, message: "Project deleted" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to delete project";
    res.status(500).json({ error: message });
  }
});

export default router;
