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
import githubUpdateRouter, { startAutoUpdate, githubWebhookPublicRouter } from "./github-update";
import installRouter from "./install";
import serialRouter from "./serial";
import { licenseRouter, adminRouter } from "./license-admin";
import aiReviewRouter from "./ai-review";
import flowerSuggestionsRouter from "./flower-suggestions";
import deepVerifyRouter from "./deep-verify";
import { requireAuth } from "../middleware/auth";
import { accuracyInterceptor } from "../middleware/accuracy-interceptor";
import systemWatchdogRouter from "./system-watchdog";
import { startWatchdog } from "../lib/system-watchdog";
import rollPassEngineRouter from "./roll-pass-engine";
import geminiKeysRouter from "./gemini-keys";
import autoPipelineRouter from "./auto-pipeline";

const router: IRouter = Router();

router.use(healthRouter);

router.use(authRouter);

// License & Admin routes — own auth, no requireAuth needed
router.use("/license", licenseRouter);
router.use("/admin", adminRouter);

// AI Pre-build review — own token auth (used by PRECHECK.bat)
router.use(aiReviewRouter);

// Public install script — no auth (PowerShell: irm <url>/api/install | iex)
router.use(installRouter);

// GitHub webhook — public (GitHub directly calls this, no user token)
router.use(githubWebhookPublicRouter);

router.use(requireAuth as any);
router.use(accuracyInterceptor as any);
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
router.use(githubUpdateRouter);
router.use(serialRouter);
router.use(systemWatchdogRouter);
router.use(flowerSuggestionsRouter);
router.use(rollPassEngineRouter);
router.use(deepVerifyRouter);
router.use("/gemini-keys", geminiKeysRouter);
router.use(autoPipelineRouter);

startAutoBackup(600);
startAutoUpdate();
startWatchdog();

export default router;
