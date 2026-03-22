import { Router, type IRouter, type Request, type Response } from "express";
import multer from "multer";
import { parseDxfContent } from "../lib/dxf-parser-util";
import { execSync, execFileSync } from "child_process";
import { writeFileSync, readFileSync, mkdirSync, existsSync, readdirSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

const router: IRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

interface MulterRequest extends Request {
  file?: Express.Multer.File;
}

const NIX_DWG2DXF_PATHS = [
  "/nix/store/qlsrrnhdij42y9a8js3088dk4fz59sqk-libredwg-0.13.3/bin/dwg2dxf",
  "/nix/store/0dqdk5y8qyj0nv4jpv01f2wx8j0rmdb9-libredwg-0.13.3/bin/dwg2dxf",
  "/nix/store/1vylg5ciz6s4n0nn6bwv6bms8n257dy5-libredwg-0.12.5.6313/bin/dwg2dxf",
  "/nix/store/0hwpb5bkw820w7w6qppbk5gg85avhjlz-libredwg-0.12.4/bin/dwg2dxf",
];

function findDwg2DxfBinary(): string | null {
  for (const p of NIX_DWG2DXF_PATHS) {
    if (existsSync(p)) return p;
  }
  try {
    const fromWhich = execSync("which dwg2dxf 2>/dev/null", { timeout: 3000 }).toString().trim();
    if (fromWhich && existsSync(fromWhich)) return fromWhich;
  } catch { /* ignore */ }
  return null;
}

const dwg2dxfBinary = findDwg2DxfBinary();
console.log("[DWG] Converter binary:", dwg2dxfBinary ?? "NOT FOUND");

function convertDwgToDxf(buffer: Buffer): string | null {
  const binary = dwg2dxfBinary;
  if (!binary) return null;

  const tempDir = join(tmpdir(), `dwg-convert-${Date.now()}`);
  try {
    mkdirSync(tempDir, { recursive: true });
    const inputFile = join(tempDir, "drawing.dwg");
    const outputFile = join(tempDir, "drawing.dxf");
    writeFileSync(inputFile, buffer);

    execFileSync(binary, ["-y", "-o", outputFile, inputFile], {
      timeout: 30000,
      cwd: tempDir,
    });

    if (existsSync(outputFile)) {
      return readFileSync(outputFile, "utf-8");
    }

    const files = readdirSync(tempDir).filter((f) => f.toLowerCase().endsWith(".dxf"));
    if (files.length === 0) return null;
    return readFileSync(join(tempDir, files[0]), "utf-8");
  } catch (err) {
    console.error("[DWG] conversion error:", err instanceof Error ? err.message : err);
    return null;
  } finally {
    try { execSync(`rm -rf "${tempDir}"`, { timeout: 5000 }); } catch { /* ignore */ }
  }
}

router.post("/upload-dxf", upload.single("file"), (req: MulterRequest, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }

    const originalName = req.file.originalname || "";
    const ext = originalName.toLowerCase().split(".").pop();

    if (ext === "dwg") {
      if (dwg2dxfBinary) {
        const dxfContent = convertDwgToDxf(req.file.buffer);
        if (dxfContent) {
          const geometry = parseDxfContent(dxfContent);
          res.json({
            success: true,
            geometry,
            fileName: originalName,
            segmentCount: geometry.segments.length,
            bendCount: geometry.bends.length,
            convertedFrom: "dwg",
            message: "DWG file successfully converted to DXF and parsed.",
          });
          return;
        }
        res.status(400).json({
          error: "DWG conversion failed. The file may be corrupted or an unsupported DWG version. Please save as DXF from AutoCAD (File → Save As → DXF R2018) and try again.",
          formatHint: "dwg_conversion_failed",
        });
        return;
      }

      res.status(400).json({
        error: "DWG converter not available on this server. Please open your DWG file in AutoCAD and export as DXF: File → Save As → select DXF format.",
        formatHint: "dwg_unsupported",
      });
      return;
    }

    const content = req.file.buffer.toString("utf-8");
    const geometry = parseDxfContent(content);

    res.json({
      success: true,
      geometry,
      fileName: originalName,
      segmentCount: geometry.segments.length,
      bendCount: geometry.bends.length,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to parse DXF file";
    res.status(400).json({ error: message });
  }
});

export default router;
