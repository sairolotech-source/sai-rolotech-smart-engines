import { useEffect, useRef, useState, useCallback } from "react";
import { useCncStore } from "../store/useCncStore";
import type { MaterialType } from "../store/useCncStore";
import {
  generateFlower,
  generateRollTooling,
  generateGcode,
  aiAdviseFlower,
  aiAnalyzeDesign,
  aiRecommendTools,
  saveJobPackage,
} from "../lib/api";

export type AutoAIStep =
  | "idle"
  | "ai-pre-analysis"
  | "flower"
  | "ai-design-check"
  | "roll-tooling"
  | "ai-tools"
  | "gcode"
  | "saving"
  | "done"
  | "error";

export interface AutoAIStatus {
  step: AutoAIStep;
  message: string;
  error?: string;
  progress: number;
  aiInsight?: string;
  manufacturabilityScore?: number;
  recommendedStations?: number;
}

const STORAGE_KEY = "sai_auto_ai_mode";

const STEP_PROGRESS: Record<AutoAIStep, number> = {
  idle: 0,
  "ai-pre-analysis": 10,
  flower: 28,
  "ai-design-check": 44,
  "roll-tooling": 60,
  "ai-tools": 76,
  gcode: 88,
  saving: 94,
  done: 100,
  // error progress is not read from this table — the catch block always
  // uses the lastProgress variable captured at the failed step instead.
  error: -1,
};

const K_FACTOR_BY_MATERIAL: Partial<Record<MaterialType, number>> = {
  MS: 0.44,
  GI: 0.44,
  CR: 0.44,
  HR: 0.44,
  SS: 0.43,
  AL: 0.40,
  CU: 0.42,
  TI: 0.45,
  PP: 0.44,
  HSLA: 0.44,
};

const SURFACE_FINISH_BY_MATERIAL: Partial<Record<MaterialType, string>> = {
  SS: "Ra 0.4 μm",
  AL: "Ra 0.8 μm",
  CU: "Ra 0.8 μm",
  MS: "Ra 1.6 μm",
  GI: "Ra 1.6 μm",
  CR: "Ra 0.8 μm",
  HR: "Ra 3.2 μm",
  TI: "Ra 0.8 μm",
  PP: "Ra 1.6 μm",
  HSLA: "Ra 1.6 μm",
};

async function retryOnce<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch {
    await new Promise((r) => setTimeout(r, 1000));
    return await fn();
  }
}

export function useAutoAIMode() {
  const [enabled, setEnabledRaw] = useState<boolean>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  });

  const [status, setStatus] = useState<AutoAIStatus>({
    step: "idle",
    message: "",
    progress: 0,
  });

  const runningRef = useRef(false);
  const lastKeyRef = useRef<string | null>(null);
  /**
   * Per-run token. Incremented each time a new run starts OR when AI mode is
   * disabled. Any in-flight run captures the token value at start and checks it
   * before every store mutation — if the current token has moved on, the run
   * silently exits without writing anything.
   */
  const runTokenRef = useRef(0);

  const toggle = useCallback(() => {
    setEnabledRaw((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, String(next));
      } catch {}
      if (!next) {
        runTokenRef.current += 1;
        setStatus({ step: "idle", message: "", progress: 0 });
        runningRef.current = false;
        lastKeyRef.current = null;
      }
      return next;
    });
  }, []);

  const step = useCallback((s: AutoAIStep, message: string, extra?: Partial<AutoAIStatus>) => {
    setStatus({ step: s, message, progress: STEP_PROGRESS[s], ...extra });
  }, []);

  const runAutoCalculations = useCallback(async () => {
    if (runningRef.current) return;

    const liveStore = useCncStore.getState();
    if (!liveStore.geometry) return;

    const geometry = liveStore.geometry;
    const totalBends = geometry.bendPoints.length;
    const key =
      JSON.stringify(geometry.boundingBox) +
      "|" + liveStore.numStations +
      "|" + liveStore.materialType +
      "|" + liveStore.materialThickness +
      "|" + liveStore.rollDiameter +
      "|" + liveStore.shaftDiameter +
      "|" + liveStore.lineSpeed +
      "|" + liveStore.clearance +
      "|" + liveStore.stationPrefix +
      "|" + liveStore.openSectionType +
      "|" + (liveStore.machineProfile ? JSON.stringify(liveStore.machineProfile) : "null") +
      "|" + JSON.stringify(liveStore.gcodeConfig);

    if (key === lastKeyRef.current) return;
    lastKeyRef.current = key;
    runningRef.current = true;

    const myToken = ++runTokenRef.current;
    const isCurrent = () => runTokenRef.current === myToken;

    const store = { ...liveStore, geometry };

    const bendAngles = geometry.bendPoints.map((b) => b.angle);
    const profileWidth = geometry.boundingBox.maxX - geometry.boundingBox.minX;
    const profileComplexity = totalBends <= 2 ? "simple" : totalBends <= 5 ? "moderate" : "complex";

    const kFactor = store.kFactor !== null && store.kFactor !== undefined
      ? store.kFactor
      : K_FACTOR_BY_MATERIAL[store.materialType] ?? 0.44;

    const surfaceFinish = store.surfaceFinish
      ? store.surfaceFinish
      : SURFACE_FINISH_BY_MATERIAL[store.materialType] ?? "Ra 1.6 μm";

    const postProcessorId = store.machineProfile?.controllerType ?? "delta_2x";

    let lastProgress = 0;

    try {
      // ── Step 1: AI Pre-Analysis (Flower Advisor) ─────────────────────────
      if (!isCurrent()) return;
      step("ai-pre-analysis", "AI — Optimal forming strategy analyse kar raha hai...");
      lastProgress = STEP_PROGRESS["ai-pre-analysis"];
      let recommendedStations = store.numStations;
      try {
        const adviceRes = await retryOnce(() => aiAdviseFlower({
          materialType: store.materialType,
          thickness: store.materialThickness,
          totalBends,
          bendAngles,
          profileWidth,
          profileComplexity,
        }));
        if (!isCurrent()) return;
        const advice = adviceRes.advice;
        if (advice.recommendedStations && typeof advice.recommendedStations === "number") {
          recommendedStations = advice.recommendedStations as number;
        }
        const aiInsight = typeof advice.summary === "string"
          ? advice.summary
          : `Strategy: ${typeof advice.stationStrategy === "string" ? advice.stationStrategy : ""}`;

        useCncStore.getState().setAiPipelineResults({
          flowerAdvice: advice,
          modes: { ...useCncStore.getState().aiPipelineResults.modes, flowerAdvice: adviceRes.mode },
        });
        if (!isCurrent()) return;
        step("ai-pre-analysis", "AI Pre-Analysis complete", {
          progress: STEP_PROGRESS["ai-pre-analysis"],
          aiInsight,
          recommendedStations,
        });
      } catch (e) {
        console.warn("[AutoAI] AI Pre-Analysis step failed, skipping:", e instanceof Error ? e.message : e);
        if (!isCurrent()) return;
        step("ai-pre-analysis", "AI Pre-Analysis — offline mode (skipping)");
      }

      // Use AI-recommended stations if meaningfully different (within ±3 of user setting)
      const effectiveStations = Math.abs(recommendedStations - store.numStations) <= 3
        ? store.numStations
        : recommendedStations;

      // ── Step 2: Generate Power Pattern ──────────────────────────────────
      if (!isCurrent()) return;
      step("flower", "Power Pattern generate ho raha hai...");
      lastProgress = STEP_PROGRESS["flower"];
      useCncStore.getState().setActiveTab("flower");

      const flowerData = await generateFlower(
        geometry,
        effectiveStations,
        store.stationPrefix,
        store.materialType,
        store.materialThickness,
        store.openSectionType
      );
      if (!isCurrent()) return;
      useCncStore.getState().setStations(flowerData.stations || []);
      step("flower", `Flower complete — ${effectiveStations} stations`);

      // ── Step 3: AI Design Manufacturability Check ─────────────────────────
      if (!isCurrent()) return;
      step("ai-design-check", "AI — Design manufacturability check kar raha hai...");
      lastProgress = STEP_PROGRESS["ai-design-check"];
      let mfgScore: number | undefined;
      try {
        const analysisRes = await retryOnce(() => aiAnalyzeDesign({
          materialType: store.materialType,
          thickness: store.materialThickness,
          numStations: effectiveStations,
          totalBends,
          bendAngles,
          rollDiameter: store.rollDiameter,
          shaftDiameter: store.shaftDiameter,
          lineSpeed: store.lineSpeed,
          profileComplexity,
          kFactor,
        }));
        if (!isCurrent()) return;
        const analysis = analysisRes.analysis;
        mfgScore = typeof analysis.manufacturabilityScore === "number"
          ? analysis.manufacturabilityScore as number
          : undefined;

        const criticalCount = Array.isArray(analysis.issues)
          ? (analysis.issues as { severity: string }[]).filter((i) => i.severity === "critical").length
          : 0;

        useCncStore.getState().setAiPipelineResults({
          designAnalysis: analysis,
          modes: { ...useCncStore.getState().aiPipelineResults.modes, designAnalysis: analysisRes.mode },
        });

        if (!isCurrent()) return;
        step("ai-design-check", `Design Score: ${mfgScore ?? "N/A"}/100${criticalCount > 0 ? ` — ${criticalCount} critical issue(s)` : " — OK"}`, {
          progress: STEP_PROGRESS["ai-design-check"],
          manufacturabilityScore: mfgScore,
        });
      } catch (e) {
        console.warn("[AutoAI] AI Design Check step failed, skipping:", e instanceof Error ? e.message : e);
        if (!isCurrent()) return;
        step("ai-design-check", "AI Design Check — offline (skipping)");
      }

      // ── Step 4: Generate Roll Tooling ─────────────────────────────────────
      if (!isCurrent()) return;
      step("roll-tooling", "Roll Tooling calculate ho rahi hai...");
      lastProgress = STEP_PROGRESS["roll-tooling"];
      useCncStore.getState().setActiveTab("roll");

      const rollData = await generateRollTooling(
        geometry,
        effectiveStations,
        store.stationPrefix,
        store.materialThickness,
        store.rollDiameter,
        store.shaftDiameter,
        store.clearance,
        store.materialType,
        postProcessorId,
        store.openSectionType
      );
      if (!isCurrent()) return;
      useCncStore.getState().setRollTooling(rollData.rolls || []);
      step("roll-tooling", `Roll Tooling complete — ${(rollData.rolls || []).length} stations`);

      // ── Step 5: AI Tool & Insert Recommendation ───────────────────────────
      if (!isCurrent()) return;
      step("ai-tools", "AI — Tool selection aur insert codes recommend kar raha hai...");
      lastProgress = STEP_PROGRESS["ai-tools"];
      try {
        const toolRes = await retryOnce(() => aiRecommendTools({
          materialType: store.materialType,
          thickness: store.materialThickness,
          rollDiameter: store.rollDiameter,
          shaftDiameter: store.shaftDiameter,
          profileComplexity,
          totalBends,
          surfaceFinishRequired: surfaceFinish,
        }));
        if (!isCurrent()) return;
        const rec = toolRes.recommendation;
        const grade = typeof rec.materialRecommendation === "object" && rec.materialRecommendation !== null
          ? (rec.materialRecommendation as Record<string, unknown>).grade
          : null;
        const toolCount = Array.isArray(rec.toolRecommendations) ? (rec.toolRecommendations as unknown[]).length : 0;

        useCncStore.getState().setAiPipelineResults({
          toolRecommendation: rec,
          modes: { ...useCncStore.getState().aiPipelineResults.modes, toolRecommendation: toolRes.mode },
        });

        if (!isCurrent()) return;
        step("ai-tools", `Tools: ${grade ?? store.materialType} — ${toolCount} operations`, {
          progress: STEP_PROGRESS["ai-tools"],
          aiInsight: typeof rec.summary === "string" ? rec.summary : undefined,
        });
      } catch (e) {
        console.warn("[AutoAI] AI Tool Recommendation step failed, skipping:", e instanceof Error ? e.message : e);
        if (!isCurrent()) return;
        step("ai-tools", "AI Tool Recommendation — offline (skipping)");
      }

      // ── Step 6: Generate G-Code ───────────────────────────────────────────
      if (!isCurrent()) return;
      step("gcode", "CNC G-Code generate ho raha hai...");
      lastProgress = STEP_PROGRESS["gcode"];
      useCncStore.getState().setActiveTab("gcode");

      const gcodeData = await generateGcode(
        geometry,
        effectiveStations,
        store.stationPrefix,
        store.gcodeConfig,
        store.machineProfile
      );
      const gcodeOutputs = gcodeData.outputs || [];
      if (!isCurrent()) return;
      useCncStore.getState().setGcodeOutputs(gcodeOutputs);
      step("gcode", "G-Code complete");

      // ── Step 7: Auto-save structured job package to disk ─────────────────
      step("saving", "Job files organized folder mein save ho rahi hain...");
      const storeState = useCncStore.getState();
      try {
        await saveJobPackage({
          profileName: storeState.profileName || `job_${effectiveStations}stn_${storeState.materialType}`,
          geometry: storeState.geometry ?? undefined,
          stations: (flowerData.stations || []) as unknown[],
          rollTooling: (rollData.rolls || []) as unknown as import("../lib/api").RollToolingPayload[],
          gcodeOutputs,
        });
        step("saving", "Auto-save complete — files organized by folder");
      } catch {
        step("saving", "Auto-save skipped (server not available)");
      }

      // ── Done ─────────────────────────────────────────────────────────────
      if (!isCurrent()) return;
      setStatus({
        step: "done",
        message: `Sab complete! Score: ${mfgScore !== undefined ? mfgScore + "/100" : "N/A"} | ${effectiveStations} stations`,
        progress: 100,
        manufacturabilityScore: mfgScore,
        recommendedStations: recommendedStations !== store.numStations ? recommendedStations : undefined,
      });
    } catch (err: unknown) {
      if (!isCurrent()) return;
      const msg = err instanceof Error ? err.message : "Unknown error";
      setStatus({ step: "error", message: "Calculation mein error aaya", error: msg, progress: lastProgress });
      lastKeyRef.current = null;
    } finally {
      if (isCurrent()) {
        runningRef.current = false;
      }
    }
  }, [step]);

  useEffect(() => {
    if (!enabled) return;

    const checkAndRun = () => {
      const store = useCncStore.getState();
      if (store.geometry) {
        runAutoCalculations();
      }
    };

    checkAndRun();

    const unsub = useCncStore.subscribe((state, prev) => {
      const geoChanged = state.geometry !== prev.geometry;
      const stationsChanged = state.numStations !== prev.numStations;
      const materialChanged =
        state.materialType !== prev.materialType ||
        state.materialThickness !== prev.materialThickness;
      const rollParamsChanged =
        state.rollDiameter !== prev.rollDiameter ||
        state.shaftDiameter !== prev.shaftDiameter ||
        state.lineSpeed !== prev.lineSpeed ||
        state.clearance !== prev.clearance;
      const prefixChanged = state.stationPrefix !== prev.stationPrefix;
      const sectionChanged = state.openSectionType !== prev.openSectionType;
      const machineChanged = state.machineProfile !== prev.machineProfile;
      const gcodeConfigChanged = state.gcodeConfig !== prev.gcodeConfig;

      if (
        (geoChanged || stationsChanged || materialChanged || rollParamsChanged ||
          prefixChanged || sectionChanged || machineChanged || gcodeConfigChanged) &&
        state.geometry
      ) {
        lastKeyRef.current = null;
        runAutoCalculations();
      }
    });

    return () => unsub();
  }, [enabled, runAutoCalculations]);

  return { enabled, toggle, status };
}
