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

    const baseConfig = config?.controllerType === "delta_2x" ? getDelta2XConfig() : getDefaultConfig();
    let gcodeConfig: GcodeConfig = { ...baseConfig };

    if (config) {
      gcodeConfig = {
        ...gcodeConfig,
        feedRate: config.feedRate ?? gcodeConfig.feedRate,
        feedUnit: config.feedUnit ?? gcodeConfig.feedUnit,
        spindleSpeed: config.spindleSpeed ?? gcodeConfig.spindleSpeed,
        spindleMode: config.spindleMode ?? gcodeConfig.spindleMode,
        maxSpindleSpeed: config.maxSpindleSpeed ?? gcodeConfig.maxSpindleSpeed,
        spindleDirection: config.spindleDirection ?? gcodeConfig.spindleDirection,
        workOffset: config.workOffset ?? gcodeConfig.workOffset,
        safeZ: config.safeZ ?? gcodeConfig.safeZ,
        safeX: config.safeX ?? gcodeConfig.safeX,
        cutDepth: config.cutDepth ?? gcodeConfig.cutDepth,
        coordinateFormat: config.coordinateFormat ?? gcodeConfig.coordinateFormat,
        decimalPrecision: config.decimalPrecision ?? gcodeConfig.decimalPrecision,
        coolant: config.coolant ?? gcodeConfig.coolant,
        xDiameterMode: config.xDiameterMode ?? gcodeConfig.xDiameterMode,
        programNumber: config.programNumber ?? gcodeConfig.programNumber,
        useG28: config.useG28 ?? gcodeConfig.useG28,
      };

      if (config.tools && Array.isArray(config.tools) && config.tools.length > 0) {
        gcodeConfig.tools = config.tools;
      }
      if (config.customHeader) gcodeConfig.customHeader = config.customHeader;
      if (config.customFooter) gcodeConfig.customFooter = config.customFooter;
      if (config.arcFormat) gcodeConfig.arcFormat = config.arcFormat;
      if (config.endOfBlockChar !== undefined) gcodeConfig.endOfBlockChar = config.endOfBlockChar;
      if (config.safetyBlock !== undefined) gcodeConfig.safetyBlock = config.safetyBlock;
      if (config.toolFormat) gcodeConfig.toolFormat = config.toolFormat;
      if (config.lineNumberFormat !== undefined) gcodeConfig.lineNumberFormat = config.lineNumberFormat;
      if (config.programNumberFormat !== undefined) gcodeConfig.programNumberFormat = config.programNumberFormat;
      if (config.toolChangeSequence) gcodeConfig.toolChangeSequence = config.toolChangeSequence;
      if (config.arcChordError !== undefined) gcodeConfig.arcChordError = config.arcChordError;
      if (config.arcSubSegments !== undefined) gcodeConfig.arcSubSegments = config.arcSubSegments;
      if (config.verifyNoseRadiusComp !== undefined) gcodeConfig.verifyNoseRadiusComp = config.verifyNoseRadiusComp;
      if (config.controllerType) gcodeConfig.controllerType = config.controllerType;
      if (config.materialType) gcodeConfig.materialType = config.materialType;
      if (config.operationType) gcodeConfig.operationType = config.operationType;
      if (config.enableFeedRamping !== undefined) gcodeConfig.enableFeedRamping = config.enableFeedRamping;
      if (config.feedRampAngleThreshold !== undefined) gcodeConfig.feedRampAngleThreshold = config.feedRampAngleThreshold;
      if (config.feedRampFactor !== undefined) gcodeConfig.feedRampFactor = config.feedRampFactor;
      if (config.enableDwellInsertion !== undefined) gcodeConfig.enableDwellInsertion = config.enableDwellInsertion;
      if (config.dwellTime !== undefined) gcodeConfig.dwellTime = config.dwellTime;
      if (config.enableRestMachining !== undefined) gcodeConfig.enableRestMachining = config.enableRestMachining;
      if (config.roughingStockAllowance !== undefined) gcodeConfig.roughingStockAllowance = config.roughingStockAllowance;
      if (config.enableGrooveCycle !== undefined) gcodeConfig.enableGrooveCycle = config.enableGrooveCycle;
      if (config.grooveDepth !== undefined) gcodeConfig.grooveDepth = config.grooveDepth;
      if (config.grooveWidth !== undefined) gcodeConfig.grooveWidth = config.grooveWidth;
      if (config.groovePeckDepth !== undefined) gcodeConfig.groovePeckDepth = config.groovePeckDepth;
      if (config.enableG71Cycle !== undefined) gcodeConfig.enableG71Cycle = config.enableG71Cycle;
      if (config.g71DepthOfCut !== undefined) gcodeConfig.g71DepthOfCut = config.g71DepthOfCut;
      if (config.g71RetractAmount !== undefined) gcodeConfig.g71RetractAmount = config.g71RetractAmount;
      if (config.enableToolpathOptimization !== undefined) gcodeConfig.enableToolpathOptimization = config.enableToolpathOptimization;
      if (config.rapidTraverseRate !== undefined) gcodeConfig.rapidTraverseRate = config.rapidTraverseRate;
      if (config.accelerationRate !== undefined) gcodeConfig.accelerationRate = config.accelerationRate;
      if (config.maxAcceleration !== undefined) gcodeConfig.maxAcceleration = config.maxAcceleration;
      if (config.exactStopMode !== undefined) gcodeConfig.exactStopMode = config.exactStopMode;
      if (config.toolChangeTime !== undefined) gcodeConfig.toolChangeTime = config.toolChangeTime;
      if (config.workpieceDiameter !== undefined) gcodeConfig.workpieceDiameter = config.workpieceDiameter;
    }

    if (machineProfile) {
      gcodeConfig.coordinateFormat = machineProfile.coordinateFormat ?? gcodeConfig.coordinateFormat;
      gcodeConfig.decimalPrecision = machineProfile.decimalPrecision ?? gcodeConfig.decimalPrecision;
      gcodeConfig.feedRate = machineProfile.feedRate ?? gcodeConfig.feedRate;
      gcodeConfig.feedUnit = machineProfile.feedUnit ?? gcodeConfig.feedUnit;
      gcodeConfig.spindleSpeed = machineProfile.spindleSpeed ?? gcodeConfig.spindleSpeed;
      gcodeConfig.maxSpindleSpeed = machineProfile.maxSpindleSpeed ?? gcodeConfig.maxSpindleSpeed;
      gcodeConfig.spindleMode = machineProfile.spindleMode ?? gcodeConfig.spindleMode;
      gcodeConfig.spindleDirection = machineProfile.spindleDirection ?? gcodeConfig.spindleDirection;
      gcodeConfig.workOffset = machineProfile.workOffset ?? gcodeConfig.workOffset;
      gcodeConfig.coolant = machineProfile.coolant ?? gcodeConfig.coolant;
      gcodeConfig.xDiameterMode = machineProfile.xDiameterMode ?? gcodeConfig.xDiameterMode;
      gcodeConfig.useG28 = machineProfile.useG28 ?? gcodeConfig.useG28;
      if (machineProfile.maxAcceleration !== undefined) gcodeConfig.maxAcceleration = machineProfile.maxAcceleration;
      if (machineProfile.exactStopMode !== undefined) gcodeConfig.exactStopMode = machineProfile.exactStopMode;
      if (machineProfile.headerLines && machineProfile.headerLines.length > 0) {
        gcodeConfig.customHeader = machineProfile.headerLines;
      }
      if (machineProfile.footerLines && machineProfile.footerLines.length > 0) {
        gcodeConfig.customFooter = machineProfile.footerLines;
      }
      if (machineProfile.arcFormat) {
        gcodeConfig.arcFormat = machineProfile.arcFormat;
      }
      if (machineProfile.endOfBlockChar) {
        gcodeConfig.endOfBlockChar = machineProfile.endOfBlockChar;
      }
      if (machineProfile.safetyBlock) {
        gcodeConfig.safetyBlock = machineProfile.safetyBlock;
      }
      if (machineProfile.toolFormat) {
        gcodeConfig.toolFormat = machineProfile.toolFormat;
      }
      if (machineProfile.lineNumberFormat) {
        gcodeConfig.lineNumberFormat = machineProfile.lineNumberFormat;
      }
      if (machineProfile.programNumberFormat) {
        gcodeConfig.programNumberFormat = machineProfile.programNumberFormat;
      }
      if (machineProfile.toolChangeSequence && machineProfile.toolChangeSequence.length > 0) {
        gcodeConfig.toolChangeSequence = machineProfile.toolChangeSequence;
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
