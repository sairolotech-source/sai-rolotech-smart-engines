import { Router, type IRouter, type Request, type Response } from "express";
import fs from "fs";
import path from "path";
import os from "os";
import multer from "multer";
import { buildJobFolderPaths, sanitizeFolderName, rollFileName, cncFileName, describeFolderTree } from "../lib/job-folder-structure";

const router: IRouter = Router();

const ALLOWED_ROOTS = [
  path.join(os.homedir(), "workspace"),
  process.cwd(),
].map((r) => path.resolve(r));

function isPathAllowed(p: string): boolean {
  const resolved = path.resolve(p);
  return ALLOWED_ROOTS.some((root) => resolved === root || resolved.startsWith(root + path.sep));
}

router.get("/files/list", (req: Request, res: Response) => {
  try {
    const dir = (req.query["dir"] as string) || os.homedir();
    const resolved = path.resolve(dir);

    if (!isPathAllowed(resolved)) {
      res.status(403).json({ error: "Access denied: path outside allowed directories" });
      return;
    }

    if (!fs.existsSync(resolved)) {
      res.status(404).json({ error: "Directory not found" });
      return;
    }

    const stat = fs.statSync(resolved);
    if (!stat.isDirectory()) {
      res.status(400).json({ error: "Not a directory" });
      return;
    }

    const entries = fs.readdirSync(resolved, { withFileTypes: true });
    const items = entries.map((entry) => {
      let size = 0;
      let mtime = "";
      try {
        const s = fs.statSync(path.join(resolved, entry.name));
        size = s.size;
        mtime = s.mtime.toISOString();
      } catch { /* skip inaccessible */ }

      return {
        name: entry.name,
        isDirectory: entry.isDirectory(),
        isFile: entry.isFile(),
        size,
        mtime,
        path: path.join(resolved, entry.name),
      };
    });

    items.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return a.name.localeCompare(b.name);
    });

    const parentResolved = path.dirname(resolved);
    const parentAllowed = isPathAllowed(parentResolved) && parentResolved !== resolved;

    res.json({
      current: resolved,
      parent: parentAllowed ? parentResolved : null,
      items,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "File list failed";
    res.status(500).json({ error: msg });
  }
});

router.get("/files/read", (req: Request, res: Response) => {
  try {
    const filePath = req.query["path"] as string;
    if (!filePath) {
      res.status(400).json({ error: "path required" });
      return;
    }

    const resolved = path.resolve(filePath);

    if (!isPathAllowed(resolved)) {
      res.status(403).json({ error: "Access denied: path outside allowed directories" });
      return;
    }

    if (!fs.existsSync(resolved)) {
      res.status(404).json({ error: "File not found" });
      return;
    }

    const stat = fs.statSync(resolved);
    if (!stat.isFile()) {
      res.status(400).json({ error: "Not a file" });
      return;
    }

    if (stat.size > 1024 * 1024) {
      res.json({ content: "[File too large to display — max 1 MB]", truncated: true });
      return;
    }

    const TEXT_EXTS = [".txt", ".md", ".json", ".yaml", ".yml", ".js", ".ts", ".tsx", ".jsx",
      ".css", ".html", ".xml", ".csv", ".log", ".sh", ".py", ".go", ".rs", ".toml",
      ".ini", ".cfg", ".conf", ".env", ".gitignore", ".nc"];
    const ext = path.extname(resolved).toLowerCase();

    if (!TEXT_EXTS.includes(ext)) {
      res.json({ content: "[Binary or unsupported file type]", truncated: false });
      return;
    }

    const content = fs.readFileSync(resolved, "utf-8");
    res.json({ content, truncated: false, size: stat.size, mtime: stat.mtime.toISOString() });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "File read failed";
    res.status(500).json({ error: msg });
  }
});

router.post("/files/open", (req: Request, res: Response) => {
  try {
    const { filePath } = req.body as { filePath: string };
    if (!filePath) {
      res.status(400).json({ error: "filePath required" });
      return;
    }

    const resolved = path.resolve(filePath);

    if (!isPathAllowed(resolved)) {
      res.status(403).json({ error: "Access denied: path outside allowed directories" });
      return;
    }

    if (!fs.existsSync(resolved)) {
      res.status(404).json({ error: "File not found" });
      return;
    }

    res.json({ success: true, path: resolved, message: "File path verified and accessible." });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Open failed";
    res.status(500).json({ error: msg });
  }
});

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, _file, cb) => {
      const dir = (req.query["dir"] as string) || os.homedir();
      const resolved = path.resolve(dir);
      if (!isPathAllowed(resolved)) {
        cb(new Error("Access denied: path outside allowed directories"), "");
        return;
      }
      cb(null, resolved);
    },
    filename: (_req, file, cb) => {
      cb(null, file.originalname);
    },
  }),
  limits: { fileSize: 50 * 1024 * 1024 },
});

router.post("/files/upload", upload.array("files"), (req: Request, res: Response) => {
  try {
    const files = req.files as Express.Multer.File[] | undefined;
    if (!files || files.length === 0) {
      res.status(400).json({ error: "No files uploaded" });
      return;
    }
    const uploaded = files.map((f) => ({ name: f.originalname, size: f.size, path: f.path }));
    res.json({ success: true, uploaded, count: uploaded.length });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Upload failed";
    res.status(500).json({ error: msg });
  }
});

interface GcodeOutput {
  label: string;
  gcode: string;
  stationNumber?: number;
  lineCount?: number;
}

interface RollToolingEntry {
  stationNumber: number;
  label: string;
  rollProfile: {
    upperRoll: unknown[];
    lowerRoll: unknown[];
    upperLatheGcode?: string;
    lowerLatheGcode?: string;
    [key: string]: unknown;
  };
}

interface SaveJobPackageBody {
  baseDir?: string;
  profileName: string;
  geometry?: unknown;
  stations?: unknown[];
  rollTooling?: RollToolingEntry[];
  gcodeOutputs?: GcodeOutput[];
  bomText?: string;
  setupSheetText?: string;
  qualityChecklistText?: string;
  coverPageHtml?: string;
  readmeText?: string;
}

/**
 * POST /files/save-job-package
 *
 * Saves a complete job package to the filesystem using the canonical
 * folder structure:
 *   <baseDir>/<profileName>/
 *     power-pattern/flower-stations.json, flower-progression.csv
 *     rolls/top/top_stnN_roll.json
 *     rolls/bottom/bottom_stnN_roll.json
 *     cnc-code/top_stnN_roll.nc, bottom_stnN_roll.nc
 *     profile-geometry.json
 *     materials-tooling-bom.txt
 *     setup-sheet.txt
 *     quality-checklist.txt
 *     cover-page.html
 *     README.txt
 */
router.post("/files/save-job-package", (req: Request, res: Response) => {
  try {
    const body = req.body as SaveJobPackageBody;
    const {
      profileName,
      geometry,
      stations,
      rollTooling,
      gcodeOutputs,
      bomText,
      setupSheetText,
      qualityChecklistText,
      coverPageHtml,
      readmeText,
    } = body;

    if (!profileName || !profileName.trim()) {
      res.status(400).json({ error: "profileName is required" });
      return;
    }

    const baseDir = path.resolve(body.baseDir || path.join(os.homedir(), "workspace", "job-outputs"));

    if (!isPathAllowed(baseDir)) {
      res.status(403).json({ error: "Access denied: baseDir outside allowed directories" });
      return;
    }

    const paths = buildJobFolderPaths(baseDir, profileName);

    fs.mkdirSync(paths.flowerPattern, { recursive: true });
    fs.mkdirSync(paths.rollsTop, { recursive: true });
    fs.mkdirSync(paths.rollsBottom, { recursive: true });
    fs.mkdirSync(paths.cncCode, { recursive: true });

    const savedFiles: string[] = [];

    if (stations && stations.length > 0) {
      const stationsPath = path.join(paths.flowerPattern, "flower-stations.json");
      fs.writeFileSync(stationsPath, JSON.stringify(stations, null, 2), "utf-8");
      savedFiles.push(stationsPath);

      if (Array.isArray(stations)) {
        const csvRows: string[] = ["station_number,label,total_angle_deg,flat_strip_width_mm,pass_zone"];
        for (const s of stations as Array<{
          stationNumber?: number;
          label?: string;
          totalAngle?: number;
          flatStripWidth?: number;
          passZone?: string;
        }>) {
          csvRows.push([
            s.stationNumber ?? "",
            `"${(s.label ?? "").replace(/"/g, '""')}"`,
            typeof s.totalAngle === "number" ? s.totalAngle.toFixed(4) : "",
            typeof s.flatStripWidth === "number" ? s.flatStripWidth.toFixed(4) : "",
            `"${(s.passZone ?? "").replace(/"/g, '""')}"`,
          ].join(","));
        }
        const csvPath = path.join(paths.flowerPattern, "flower-progression.csv");
        fs.writeFileSync(csvPath, csvRows.join("\n"), "utf-8");
        savedFiles.push(csvPath);
      }
    }

    if (rollTooling && rollTooling.length > 0) {
      for (const rt of rollTooling) {
        const stn = rt.stationNumber;
        const topFile = path.join(paths.rollsTop, rollFileName("top", stn));
        const bottomFile = path.join(paths.rollsBottom, rollFileName("bottom", stn));
        fs.writeFileSync(topFile, JSON.stringify({ stationNumber: stn, label: rt.label, roll: rt.rollProfile.upperRoll, rollProfile: rt.rollProfile }, null, 2), "utf-8");
        fs.writeFileSync(bottomFile, JSON.stringify({ stationNumber: stn, label: rt.label, roll: rt.rollProfile.lowerRoll, rollProfile: rt.rollProfile }, null, 2), "utf-8");
        savedFiles.push(topFile, bottomFile);

        if (rt.rollProfile.upperLatheGcode) {
          const topNcFile = path.join(paths.cncCode, cncFileName("top", stn));
          fs.writeFileSync(topNcFile, rt.rollProfile.upperLatheGcode, "utf-8");
          savedFiles.push(topNcFile);
        }
        if (rt.rollProfile.lowerLatheGcode) {
          const bottomNcFile = path.join(paths.cncCode, cncFileName("bottom", stn));
          fs.writeFileSync(bottomNcFile, rt.rollProfile.lowerLatheGcode, "utf-8");
          savedFiles.push(bottomNcFile);
        }
      }
    }

    if (gcodeOutputs && gcodeOutputs.length > 0) {
      for (const go of gcodeOutputs) {
        const stationNum = go.stationNumber ?? 0;
        const label = (go.label || "").toLowerCase();
        let position: "top" | "bottom" = "top";
        if (label.includes("bottom") || label.includes("lower")) {
          position = "bottom";
        }

        let ncName: string;
        if (stationNum > 0) {
          ncName = cncFileName(position, stationNum);
        } else {
          ncName = sanitizeFolderName(go.label || `program_${gcodeOutputs.indexOf(go) + 1}`) + ".nc";
        }

        const ncPath = path.join(paths.cncCode, ncName);
        if (!fs.existsSync(ncPath)) {
          fs.writeFileSync(ncPath, go.gcode, "utf-8");
          savedFiles.push(ncPath);
        }
      }
    }

    if (geometry) {
      const geoPath = path.join(paths.root, "profile-geometry.json");
      fs.writeFileSync(geoPath, JSON.stringify(geometry, null, 2), "utf-8");
      savedFiles.push(geoPath);
    }

    if (bomText) {
      const bomPath = path.join(paths.root, "materials-tooling-bom.txt");
      fs.writeFileSync(bomPath, bomText, "utf-8");
      savedFiles.push(bomPath);
    }

    if (setupSheetText) {
      const ssPath = path.join(paths.root, "setup-sheet.txt");
      fs.writeFileSync(ssPath, setupSheetText, "utf-8");
      savedFiles.push(ssPath);
    }

    if (qualityChecklistText) {
      const qcPath = path.join(paths.root, "quality-checklist.txt");
      fs.writeFileSync(qcPath, qualityChecklistText, "utf-8");
      savedFiles.push(qcPath);
    }

    if (coverPageHtml) {
      const cpPath = path.join(paths.root, "cover-page.html");
      fs.writeFileSync(cpPath, coverPageHtml, "utf-8");
      savedFiles.push(cpPath);
    }

    const numStations = rollTooling?.length ?? stations?.length ?? 0;
    const readme = readmeText || `Sai Rolotech Smart Engines — Job Package\nProfile: ${profileName}\nGenerated: ${new Date().toISOString()}\n\nFolder Structure:\n${describeFolderTree(profileName, numStations)}`;
    const readmePath = path.join(paths.root, "README.txt");
    fs.writeFileSync(readmePath, readme, "utf-8");
    savedFiles.push(readmePath);

    res.json({
      success: true,
      projectRoot: paths.root,
      paths,
      savedFiles,
      fileCount: savedFiles.length,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Save job package failed";
    res.status(500).json({ error: msg });
  }
});

export default router;
