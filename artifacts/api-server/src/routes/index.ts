import { Router, type IRouter } from "express";
import healthRouter from "./health";
import dxfRouter from "./dxf";
import flowerRouter from "./flower";
import gcodeRouter from "./gcode";
import rollToolingRouter from "./roll-tooling";
import authRouter from "./auth";
import projectsRouter from "./projects";
import aiDiagnoseRouter from "./ai-diagnose";
import systemInfoRouter from "./system-info";
import aiChatRouter from "./ai-chat";
import fileManagerRouter from "./file-manager";
import backupRouter from "./backup";
import { startAutoBackup } from "./backup";
import driveRouter from "./drive";
import accuracyRouter from "./accuracy";
import aiAnalysisRouter from "./ai-analysis";
import aiChatbotsRouter from "./ai-chatbots";
import toolLibraryRouter from "./tool-library";
import materialsRouter from "./materials";
import drawingVisionRouter from "./drawing-vision";
import smartToolSelectorRouter from "./smart-tool-selector";
import gcodeSafetyRouter from "./gcode-safety";
import { requireAuth } from "../middleware/auth";

const router: IRouter = Router();

router.use(healthRouter);

router.use(authRouter);

router.use(requireAuth as any);
router.use(dxfRouter);
router.use(flowerRouter);
router.use(gcodeRouter);
router.use(rollToolingRouter);
router.use(projectsRouter);
router.use(aiDiagnoseRouter);
router.use(systemInfoRouter);
router.use(aiChatRouter);
router.use(fileManagerRouter);
router.use(backupRouter);
router.use(driveRouter);
router.use(accuracyRouter);
router.use(aiAnalysisRouter);
router.use(aiChatbotsRouter);
router.use(toolLibraryRouter);
router.use(materialsRouter);
router.use(drawingVisionRouter);
router.use(smartToolSelectorRouter);
router.use(gcodeSafetyRouter);

startAutoBackup(600);

export default router;
