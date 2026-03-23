import { Router, type IRouter, type Request, type Response } from "express";
import type { AuthenticatedRequest } from "../middleware/auth";
import { db, rfProjects, rfBends, rfAnalysisResults } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import JSZip from "jszip";
import { CloudConnectors } from "../lib/cloud-connectors";

const router: IRouter = Router();

const FOLDER_NAME = "Roll Form AI Backups";

async function getDriveConnector() {
  const connectors = new CloudConnectors();
  return connectors;
}

async function getOrCreateBackupFolder(connectors: InstanceType<typeof CloudConnectors>): Promise<string> {
  const listRes = await connectors.proxy(
    "google-drive",
    `/drive/v3/files?q=${encodeURIComponent(`mimeType='application/vnd.google-apps.folder' and name='${FOLDER_NAME}' and trashed=false`)}&fields=files(id,name)`,
    { method: "GET" }
  );
  const listData = await listRes.json() as { files?: { id: string; name: string }[] };

  if (listData.files && listData.files.length > 0) {
    return listData.files[0].id;
  }

  const createRes = await connectors.proxy(
    "google-drive",
    "/drive/v3/files",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: FOLDER_NAME,
        mimeType: "application/vnd.google-apps.folder",
      }),
    }
  );
  const createData = await createRes.json() as { id: string };
  return createData.id;
}

async function buildProjectZip(projectId: string, userId: string): Promise<{ zip: JSZip; projectName: string } | null> {
  const [project] = await db.select().from(rfProjects).where(and(eq(rfProjects.id, projectId), eq(rfProjects.userId, userId)));
  if (!project) return null;

  const bends = await db.select().from(rfBends).where(eq(rfBends.projectId, projectId));
  const [analysis] = await db
    .select()
    .from(rfAnalysisResults)
    .where(eq(rfAnalysisResults.projectId, projectId))
    .orderBy(desc(rfAnalysisResults.createdAt));

  const zip = new JSZip();
  zip.file("project.json", JSON.stringify({ project, bends, analysis: analysis || null }, null, 2));
  zip.file("manifest.json", JSON.stringify({
    exportedAt: new Date().toISOString(),
    version: "1.0",
    projectId: project.id,
    projectName: project.projectName,
  }, null, 2));

  return { zip, projectName: project.projectName };
}

router.get("/drive/status", async (_req: Request, res: Response) => {
  try {
    const connectors = await getDriveConnector();
    const testRes = await connectors.proxy("google-drive", "/drive/v3/about?fields=user", { method: "GET" });
    if (!testRes.ok) {
      res.json({ connected: false });
      return;
    }
    const data = await testRes.json() as { user?: { displayName?: string; emailAddress?: string } };
    res.json({
      connected: true,
      user: {
        displayName: data.user?.displayName,
        emailAddress: data.user?.emailAddress,
      },
    });
  } catch {
    res.json({ connected: false });
  }
});

router.post("/drive/backup/:projectId", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const projectId = String(req.params.projectId);
    const userId = req.authUser!.uid;
    const result = await buildProjectZip(projectId, userId);
    if (!result) {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    const { zip, projectName } = result;

    const connectors = await getDriveConnector();
    const folderId = await getOrCreateBackupFolder(connectors);

    const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });
    const fileName = `${projectName.replace(/[^a-zA-Z0-9_-]/g, "_")}_${new Date().toISOString().slice(0, 19).replace(/[:.]/g, "-")}.zip`;

    const boundary = "boundary_" + Date.now().toString(16);
    const metadata = JSON.stringify({
      name: fileName,
      parents: [folderId],
      description: `Roll Form AI backup of project: ${projectName}`,
    });

    const metaPart = Buffer.from(
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: application/zip\r\n\r\n`,
      "utf8"
    );
    const closePart = Buffer.from(`\r\n--${boundary}--`, "utf8");
    const body = Buffer.concat([metaPart, zipBuffer, closePart]);

    const uploadRes = await connectors.proxy(
      "google-drive",
      "/upload/drive/v3/files?uploadType=multipart&fields=id,name,createdTime,size",
      {
        method: "POST",
        headers: {
          "Content-Type": `multipart/related; boundary=${boundary}`,
          "Content-Length": String(body.length),
        },
        body,
      }
    );

    if (!uploadRes.ok) {
      const errText = await uploadRes.text();
      res.status(500).json({ error: "Upload failed", details: errText });
      return;
    }

    const fileData = await uploadRes.json() as { id: string; name: string; createdTime: string; size: string };
    res.json({ success: true, file: fileData });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Backup failed";
    res.status(500).json({ error: message });
  }
});

router.get("/drive/backups", async (_req: Request, res: Response) => {
  try {
    const connectors = await getDriveConnector();
    const folderId = await getOrCreateBackupFolder(connectors);

    const listRes = await connectors.proxy(
      "google-drive",
      `/drive/v3/files?q=${encodeURIComponent(`'${folderId}' in parents and trashed=false`)}&fields=files(id,name,createdTime,size,description)&orderBy=createdTime+desc&pageSize=50`,
      { method: "GET" }
    );

    if (!listRes.ok) {
      res.status(500).json({ error: "Failed to list backups" });
      return;
    }

    const data = await listRes.json() as {
      files?: { id: string; name: string; createdTime: string; size: string; description?: string }[]
    };
    res.json({ success: true, backups: data.files || [] });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to list backups";
    res.status(500).json({ error: message });
  }
});

router.post("/drive/restore/:fileId", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const fileId = String(req.params.fileId);

    const connectors = await getDriveConnector();
    const downloadRes = await connectors.proxy(
      "google-drive",
      `/drive/v3/files/${fileId}?alt=media`,
      { method: "GET" }
    );

    if (!downloadRes.ok) {
      res.status(404).json({ error: "Backup file not found on Drive" });
      return;
    }

    const arrayBuffer = await downloadRes.arrayBuffer();
    const zipBuffer = Buffer.from(arrayBuffer);

    const zip = await JSZip.loadAsync(zipBuffer);
    const projectFile = zip.file("project.json");
    if (!projectFile) {
      res.status(400).json({ error: "Invalid backup: project.json not found" });
      return;
    }

    const projectJson = await projectFile.async("string");
    const { project, bends, analysis } = JSON.parse(projectJson) as {
      project: {
        userId: string; projectName: string; material: string; thickness: string;
        numStations: number; stationPrefix: string; lineSpeed: string | null;
        rollDiameter: string | null; shaftDiameter: string | null; clearance: string | null;
        profileName: string | null; fileName: string | null;
      };
      bends: { bendOrder: number; bendAngle: string | null; bendRadius: string | null; flangeLength: string | null; side: string | null }[];
      analysis: {
        bendCount: number | null; suggestedPasses: number | null; riskLevel: string | null;
        totalBendAngle: string | null; notes: object | null;
      } | null;
    };

    const [newProject] = await db
      .insert(rfProjects)
      .values({
        userId: req.authUser!.uid,
        projectName: `${project.projectName} (restored)`,
        material: project.material,
        thickness: project.thickness,
        numStations: project.numStations,
        stationPrefix: project.stationPrefix,
        lineSpeed: project.lineSpeed ?? "20",
        rollDiameter: project.rollDiameter ?? "150",
        shaftDiameter: project.shaftDiameter ?? "40",
        clearance: project.clearance ?? "0.05",
        profileName: project.profileName ?? "",
        fileName: project.fileName ?? "",
      })
      .returning();

    if (bends && bends.length > 0) {
      await db.insert(rfBends).values(
        bends.map((b) => ({
          projectId: newProject.id,
          bendOrder: b.bendOrder,
          bendAngle: b.bendAngle,
          bendRadius: b.bendRadius,
          flangeLength: b.flangeLength,
          side: b.side ?? "left",
        }))
      );
    }

    if (analysis) {
      await db.insert(rfAnalysisResults).values({
        projectId: newProject.id,
        bendCount: analysis.bendCount ?? 0,
        suggestedPasses: analysis.suggestedPasses ?? 0,
        riskLevel: analysis.riskLevel ?? "low",
        totalBendAngle: analysis.totalBendAngle,
        notes: analysis.notes ?? {},
      });
    }

    res.json({ success: true, project: newProject });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Restore failed";
    res.status(500).json({ error: message });
  }
});

router.post("/drive/disconnect", async (_req: Request, res: Response) => {
  res.json({ success: true, message: "Disconnected from Google Drive" });
});

router.post("/drive/auto-backup/:projectId", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const projectId = String(req.params.projectId);
    const result = await buildProjectZip(projectId, req.authUser!.uid);
    if (!result) {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    const { zip, projectName } = result;

    const connectors = await getDriveConnector();
    const folderId = await getOrCreateBackupFolder(connectors);

    const existingRes = await connectors.proxy(
      "google-drive",
      `/drive/v3/files?q=${encodeURIComponent(`'${folderId}' in parents and name contains '${projectName.replace(/[^a-zA-Z0-9_-]/g, "_")}_auto_' and trashed=false`)}&fields=files(id,name,createdTime)&orderBy=createdTime+desc&pageSize=5`,
      { method: "GET" }
    );
    const existingData = await existingRes.json() as { files?: { id: string; name: string; createdTime: string }[] };
    const existingFiles = existingData.files || [];

    if (existingFiles.length >= 5) {
      for (let i = 4; i < existingFiles.length; i++) {
        await connectors.proxy("google-drive", `/drive/v3/files/${existingFiles[i].id}`, { method: "DELETE" });
      }
    }

    const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });
    const fileName = `${projectName.replace(/[^a-zA-Z0-9_-]/g, "_")}_auto_${new Date().toISOString().slice(0, 19).replace(/[:.]/g, "-")}.zip`;

    const boundary = "boundary_" + Date.now().toString(16);
    const metadata = JSON.stringify({
      name: fileName,
      parents: [folderId],
      description: `Auto-backup of project: ${projectName}`,
    });

    const metaPart = Buffer.from(
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: application/zip\r\n\r\n`,
      "utf8"
    );
    const closePart = Buffer.from(`\r\n--${boundary}--`, "utf8");
    const body = Buffer.concat([metaPart, zipBuffer, closePart]);

    const uploadRes = await connectors.proxy(
      "google-drive",
      "/upload/drive/v3/files?uploadType=multipart&fields=id,name,createdTime,size",
      {
        method: "POST",
        headers: {
          "Content-Type": `multipart/related; boundary=${boundary}`,
          "Content-Length": String(body.length),
        },
        body,
      }
    );

    if (!uploadRes.ok) {
      const errText = await uploadRes.text();
      res.status(500).json({ error: "Auto-backup upload failed", details: errText });
      return;
    }

    const fileData = await uploadRes.json() as { id: string; name: string; createdTime: string; size: string };
    res.json({ success: true, file: fileData, isAutoBackup: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Auto-backup failed";
    res.status(500).json({ error: message });
  }
});

router.get("/drive/backup-versions/:projectName", async (req: Request, res: Response) => {
  try {
    const projectName = String(req.params.projectName).replace(/[^a-zA-Z0-9_-]/g, "_");
    const connectors = await getDriveConnector();
    const folderId = await getOrCreateBackupFolder(connectors);

    const listRes = await connectors.proxy(
      "google-drive",
      `/drive/v3/files?q=${encodeURIComponent(`'${folderId}' in parents and name contains '${projectName}' and trashed=false`)}&fields=files(id,name,createdTime,size,description)&orderBy=createdTime+desc&pageSize=20`,
      { method: "GET" }
    );

    if (!listRes.ok) {
      res.status(500).json({ error: "Failed to list backup versions" });
      return;
    }

    const data = await listRes.json() as {
      files?: { id: string; name: string; createdTime: string; size: string; description?: string }[]
    };
    res.json({ success: true, versions: data.files || [] });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to list versions";
    res.status(500).json({ error: message });
  }
});

router.post("/drive/export-sheets/:projectId", async (req: Request, res: Response) => {
  try {
    const projectId = String(req.params.projectId);
    const [project] = await db.select().from(rfProjects).where(eq(rfProjects.id, projectId));
    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    const bends: { bendOrder: number; bendAngle: string | null; bendRadius: string | null; flangeLength: string | null; side: string | null }[] = await db.select().from(rfBends).where(eq(rfBends.projectId, projectId));
    const [analysis] = await db
      .select()
      .from(rfAnalysisResults)
      .where(eq(rfAnalysisResults.projectId, projectId))
      .orderBy(desc(rfAnalysisResults.createdAt));

    const connectors = await getDriveConnector();
    const folderId = await getOrCreateBackupFolder(connectors);

    const sheetTitle = `${project.projectName} - Report ${new Date().toISOString().slice(0, 10)}`;

    const createSheetRes = await connectors.proxy(
      "google-drive",
      "/drive/v3/files",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: sheetTitle,
          mimeType: "application/vnd.google-apps.spreadsheet",
          parents: [folderId],
        }),
      }
    );

    if (!createSheetRes.ok) {
      const errText = await createSheetRes.text();
      res.status(500).json({ error: "Failed to create spreadsheet", details: errText });
      return;
    }

    const sheetFile = await createSheetRes.json() as { id: string; name: string };
    const spreadsheetId = sheetFile.id;

    const projectRow = [
      ["Project Name", project.projectName],
      ["Material", project.material],
      ["Thickness (mm)", project.thickness],
      ["Number of Stations", String(project.numStations)],
      ["Station Prefix", project.stationPrefix],
      ["Line Speed", project.lineSpeed ?? "N/A"],
      ["Roll Diameter", project.rollDiameter ?? "N/A"],
      ["Shaft Diameter", project.shaftDiameter ?? "N/A"],
      ["Clearance", project.clearance ?? "N/A"],
      ["Profile Name", project.profileName ?? "N/A"],
      ["Created", project.createdAt ? new Date(project.createdAt).toLocaleString() : "N/A"],
    ];

    const bomHeaders = ["Bend #", "Angle (°)", "Radius (mm)", "Flange Length (mm)", "Side"];
    const bomRows = bends.map((b) => [
      String(b.bendOrder),
      b.bendAngle ?? "N/A",
      b.bendRadius ?? "N/A",
      b.flangeLength ?? "N/A",
      b.side ?? "N/A",
    ]);

    const analysisRows = analysis ? [
      ["Bend Count", String(analysis.bendCount ?? "N/A")],
      ["Suggested Passes", String(analysis.suggestedPasses ?? "N/A")],
      ["Risk Level", analysis.riskLevel ?? "N/A"],
      ["Total Bend Angle", analysis.totalBendAngle ?? "N/A"],
    ] : [];

    const updateBody = {
      requests: [
        {
          updateSheetProperties: {
            properties: { sheetId: 0, title: "Project Overview" },
            fields: "title",
          },
        },
        {
          updateCells: {
            start: { sheetId: 0, rowIndex: 0, columnIndex: 0 },
            rows: [
              { values: [{ userEnteredValue: { stringValue: "PROJECT DETAILS" } }] },
              ...projectRow.map(([key, val]) => ({
                values: [
                  { userEnteredValue: { stringValue: key } },
                  { userEnteredValue: { stringValue: val } },
                ],
              })),
              { values: [] },
              { values: [{ userEnteredValue: { stringValue: "BEND DATA (BOM)" } }] },
              {
                values: bomHeaders.map((h) => ({
                  userEnteredValue: { stringValue: h },
                })),
              },
              ...bomRows.map((row: string[]) => ({
                values: row.map((val: string) => ({
                  userEnteredValue: { stringValue: val },
                })),
              })),
              ...(analysisRows.length > 0 ? [
                { values: [] },
                { values: [{ userEnteredValue: { stringValue: "ANALYSIS RESULTS" } }] },
                ...analysisRows.map(([key, val]) => ({
                  values: [
                    { userEnteredValue: { stringValue: key } },
                    { userEnteredValue: { stringValue: val } },
                  ],
                })),
              ] : []),
            ],
            fields: "userEnteredValue",
          },
        },
      ],
    };

    const updateRes = await connectors.proxy(
      "google-drive",
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updateBody),
      }
    );

    if (!updateRes.ok) {
      res.json({
        success: true,
        spreadsheetId,
        spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}`,
        name: sheetTitle,
        note: "Spreadsheet created but data population may require Sheets API scope",
      });
      return;
    }

    res.json({
      success: true,
      spreadsheetId,
      spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}`,
      name: sheetTitle,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Export to Sheets failed";
    res.status(500).json({ error: message });
  }
});

export default router;

