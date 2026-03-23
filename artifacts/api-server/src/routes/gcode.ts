import { Router, type IRouter, type Request, type Response } from "express";
import { generateGcode, getDefaultConfig, getDelta2XConfig, type GcodeConfig } from "../lib/gcode-generator";
import { parseReferenceGcode, type MachineProfile } from "../lib/reference-parser";
import { generateFlowerPattern } from "../lib/power-pattern";
import type { ProfileGeometry } from "../lib/dxf-parser-util";
import multer from "multer";

const router: IRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

interface MulterRequest extends Request {
  file?: Express.Multer.File;
}

interface GenerateGcodeBody {
  geometry: ProfileGeometry;
  numStations: number | string;
  stationPrefix?: string;
  config?: Partial<GcodeConfig>;
  machineProfile?: MachineProfile;
}

router.post("/generate-gcode", (req: Request<unknown, unknown, GenerateGcodeBody>, res: Response) => {
  try {
    const { geometry, numStations, stationPrefix, config, machineProfile } = req.body;

    if (!geometry || !geometry.segments || geometry.segments.length === 0) {
      res.status(400).json({ error: "No geometry provided" });
      return;
    }

    const stations = Math.max(1, Math.min(30, parseInt(String(numStations)) || 5));
    const prefix = stationPrefix || "S";

    const flowerResult = generateFlowerPattern(geometry, stations, prefix);

    const baseConfig = (config as Record<string, unknown>)?.controller === "Delta 2X" ||
      (config as Record<string, unknown>)?.controllerType === "delta_2x"
      ? getDelta2XConfig() : getDefaultConfig();
    let gcodeConfig: GcodeConfig = { ...baseConfig };

    if (config) {
      const c = config as Record<string, unknown>;
      gcodeConfig = {
        ...gcodeConfig,
        controller: (c.controller as string) ?? gcodeConfig.controller,
        spindleDirection: (c.spindleDirection as GcodeConfig["spindleDirection"]) ?? gcodeConfig.spindleDirection,
        useCSS: (c.useCSS as boolean) ?? gcodeConfig.useCSS,
        useDwell: (c.useDwell as boolean) ?? gcodeConfig.useDwell,
        useCoolant: (c.useCoolant as boolean) ?? gcodeConfig.useCoolant,
        roughingRpm: (c.roughingRpm as number) ?? (c.spindleSpeed as number) ?? gcodeConfig.roughingRpm,
        finishingRpm: (c.finishingRpm as number) ?? (c.maxSpindleSpeed as number) ?? gcodeConfig.finishingRpm,
        roughingSpeed: (c.roughingSpeed as number) ?? gcodeConfig.roughingSpeed,
        finishingSpeed: (c.finishingSpeed as number) ?? gcodeConfig.finishingSpeed,
        roughingFeed: (c.roughingFeed as number) ?? (c.feedRate as number) ?? gcodeConfig.roughingFeed,
        finishingFeed: (c.finishingFeed as number) ?? gcodeConfig.finishingFeed,
        roughingDepth: (c.roughingDepth as number) ?? (c.cutDepth as number) ?? gcodeConfig.roughingDepth,
        finishingDepth: (c.finishingDepth as number) ?? gcodeConfig.finishingDepth,
        safeZ: (c.safeZ as number) ?? gcodeConfig.safeZ,
        toolNumber: (c.toolNumber as number) ?? gcodeConfig.toolNumber,
        material: (c.material as string) ?? gcodeConfig.material,
        maxRpm: (c.maxRpm as number) ?? gcodeConfig.maxRpm,
        programNumber: (c.programNumber as number) ?? gcodeConfig.programNumber,
      };

      const extra = c as Record<string, unknown>;
      for (const key of Object.keys(extra)) {
        if (key in gcodeConfig) continue;
        (gcodeConfig as unknown as Record<string, unknown>)[key] = extra[key];
      }
    }

    if (machineProfile) {
      const mp = machineProfile as unknown as Record<string, unknown>;
      if (mp.spindleDirection) gcodeConfig.spindleDirection = mp.spindleDirection as GcodeConfig["spindleDirection"];
      if (typeof mp.maxRpm === "number") gcodeConfig.maxRpm = mp.maxRpm;
      if (typeof mp.safeZ === "number") gcodeConfig.safeZ = mp.safeZ;
      if (typeof mp.programNumber === "number") gcodeConfig.programNumber = mp.programNumber;
      for (const key of Object.keys(mp)) {
        if (!(key in gcodeConfig)) {
          (gcodeConfig as unknown as Record<string, unknown>)[key] = mp[key];
        }
      }
    }

    // generateGcode takes ALL stations + geometry at once — not per-station
    const gcodeOutput = generateGcode(flowerResult.stations, geometry, gcodeConfig);

    res.json({
      success: true,
      gcodeOutputs: [gcodeOutput],
      gcodeOutput,
      stationCount: flowerResult.stations.length,
      config: gcodeConfig,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to generate G-code";
    res.status(400).json({ error: message });
  }
});

interface MulterFilesRequest extends Request {
  files?: Express.Multer.File[];
}

router.post("/upload-reference", upload.single("file"), (req: MulterRequest, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }

    const content = req.file.buffer.toString("utf-8");
    const machineProfile = parseReferenceGcode(content);

    res.json({
      success: true,
      machineProfile,
      fileName: req.file.originalname,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to parse reference G-code";
    res.status(400).json({ error: message });
  }
});

router.post("/upload-references", upload.array("files", 10), (req: MulterFilesRequest, res: Response) => {
  try {
    const files = req.files;
    if (!files || files.length === 0) {
      res.status(400).json({ error: "No files uploaded" });
      return;
    }

    let mergedProfile: MachineProfile | null = null;

    for (const file of files) {
      const content = file.buffer.toString("utf-8");
      const profile = parseReferenceGcode(content);

      if (!mergedProfile) {
        mergedProfile = profile;
      } else {
        if (profile.detectedTools.length > 0) {
          for (const tool of profile.detectedTools) {
            const exists = mergedProfile.detectedTools.some(
              (t) => t.toolNumber === tool.toolNumber && t.offsetNumber === tool.offsetNumber
            );
            if (!exists) {
              mergedProfile.detectedTools.push(tool);
            }
          }
        }
        if (profile.headerLines.length > 0 && mergedProfile.headerLines.length === 0) {
          mergedProfile.headerLines = profile.headerLines;
        }
        if (profile.footerLines.length > 0 && mergedProfile.footerLines.length === 0) {
          mergedProfile.footerLines = profile.footerLines;
        }
        if (profile.customCodes.length > 0) {
          for (const code of profile.customCodes) {
            if (!mergedProfile.customCodes.includes(code)) {
              mergedProfile.customCodes.push(code);
            }
          }
        }
        if (profile.arcFormat && profile.arcFormat !== "R") {
          mergedProfile.arcFormat = profile.arcFormat;
        }
        if (profile.safetyBlock && !mergedProfile.safetyBlock) {
          mergedProfile.safetyBlock = profile.safetyBlock;
        }
        if (profile.endOfBlockChar && !mergedProfile.endOfBlockChar) {
          mergedProfile.endOfBlockChar = profile.endOfBlockChar;
        }
        if (profile.programNumberFormat && !mergedProfile.programNumberFormat) {
          mergedProfile.programNumberFormat = profile.programNumberFormat;
        }
        if (profile.lineNumberFormat && !mergedProfile.lineNumberFormat) {
          mergedProfile.lineNumberFormat = profile.lineNumberFormat;
        }
        if (profile.toolChangeSequence.length > 0 && mergedProfile.toolChangeSequence.length === 0) {
          mergedProfile.toolChangeSequence = profile.toolChangeSequence;
        }
        const mg = mergedProfile.modalGroups;
        const pg = profile.modalGroups;
        for (const code of pg.motionCodes) {
          if (!mg.motionCodes.includes(code)) mg.motionCodes.push(code);
        }
        for (const code of pg.feedCodes) {
          if (!mg.feedCodes.includes(code)) mg.feedCodes.push(code);
        }
        for (const code of pg.unitCodes) {
          if (!mg.unitCodes.includes(code)) mg.unitCodes.push(code);
        }
        for (const code of pg.planeCodes) {
          if (!mg.planeCodes.includes(code)) mg.planeCodes.push(code);
        }
        for (const code of pg.coolantCodes) {
          if (!mg.coolantCodes.includes(code)) mg.coolantCodes.push(code);
        }
        for (const code of pg.spindleCodes) {
          if (!mg.spindleCodes.includes(code)) mg.spindleCodes.push(code);
        }
        for (const code of pg.compensationCodes) {
          if (!mg.compensationCodes.includes(code)) mg.compensationCodes.push(code);
        }
      }
    }

    res.json({
      success: true,
      machineProfile: mergedProfile,
      fileCount: files.length,
      fileNames: files.map((f) => f.originalname),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to parse reference G-code files";
    res.status(400).json({ error: message });
  }
});

export default router;
