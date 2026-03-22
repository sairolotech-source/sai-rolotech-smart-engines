import { useCallback } from "react";
import { useCncStore, type DesignScore } from "../store/useCncStore";
import { authFetch } from "../lib/auth-fetch";
import { toast } from "../lib/toast";

const BASE_URL = window.location.origin;

export type TaskType = "flower" | "tooling" | "gcode" | "ai-diagnosis" | "design-score";

interface AccuracyApiResponse {
  success: boolean;
  taskType: TaskType;
  overallScore: number;
  subScores: { dimension: string; score: number; weight?: number; value?: string | number; warning?: string; tips?: string[] }[];
  warnings: string[];
  timestamp: string;
  grade?: "A" | "B" | "C" | "D" | "F";
  improvementTips?: string[];
}

function validatePayload(payload: Record<string, unknown>): { valid: boolean; error?: string } {
  if (!payload || typeof payload !== "object") {
    return { valid: false, error: "Invalid payload: must be an object" };
  }
  if (Object.keys(payload).length === 0) {
    return { valid: false, error: "Invalid payload: empty object" };
  }
  for (const [key, value] of Object.entries(payload)) {
    if (value === undefined) {
      return { valid: false, error: `Invalid payload: field "${key}" is undefined` };
    }
    if (typeof value === "number" && !isFinite(value)) {
      return { valid: false, error: `Invalid payload: field "${key}" is not a finite number` };
    }
  }
  return { valid: true };
}

export function useAccuracyScoring() {
  const { addAccuracyEntry, setDesignScore, setDesignScoreLoading } = useCncStore();

  const scoreTask = useCallback(async (
    taskType: TaskType,
    taskLabel: string,
    payload: Record<string, unknown>,
  ) => {
    const validation = validatePayload(payload);
    if (!validation.valid) {
      toast.error(`Accuracy check skipped: ${validation.error}`);
      return null;
    }

    try {
      const res = await authFetch(`${BASE_URL}/api/accuracy/${taskType}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        toast.error(`Accuracy server error (${res.status}): could not score ${taskLabel}`);
        return null;
      }
      const data: AccuracyApiResponse = await res.json();
      if (!data.success) {
        toast.error(`Accuracy check failed for ${taskLabel}`);
        return null;
      }

      addAccuracyEntry({
        taskType,
        taskLabel,
        overallScore: data.overallScore,
        subScores: data.subScores,
        warnings: data.warnings,
        timestamp: data.timestamp,
      });

      return data;
    } catch {
      toast.error(`Accuracy server unreachable — ${taskLabel} score not recorded`);
      return null;
    }
  }, [addAccuracyEntry]);

  const scoreDesign = useCallback(async (payload: Record<string, unknown>) => {
    const validation = validatePayload(payload);
    if (!validation.valid) {
      toast.error(`Design score skipped: ${validation.error}`);
      setDesignScoreLoading(false);
      return null;
    }

    setDesignScoreLoading(true);
    try {
      const res = await authFetch(`${BASE_URL}/api/accuracy/design-score`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        toast.error(`Accuracy server error (${res.status}): design score unavailable`);
        setDesignScoreLoading(false);
        return null;
      }
      const data: AccuracyApiResponse = await res.json();
      if (!data.success) {
        toast.error("Design score check failed — server returned unsuccessful response");
        setDesignScoreLoading(false);
        return null;
      }

      const ds: DesignScore = {
        overallScore: data.overallScore,
        grade: data.grade ?? "C",
        subScores: data.subScores,
        warnings: data.warnings,
        improvementTips: data.improvementTips ?? [],
        timestamp: data.timestamp,
        isLoading: false,
      };
      setDesignScore(ds);

      addAccuracyEntry({
        taskType: "design-score",
        taskLabel: "AI Design Score",
        overallScore: data.overallScore,
        subScores: data.subScores,
        warnings: data.warnings,
        timestamp: data.timestamp,
      });

      return ds;
    } catch {
      toast.error("Accuracy server unreachable — design score could not be calculated");
      setDesignScoreLoading(false);
      return null;
    }
  }, [addAccuracyEntry, setDesignScore, setDesignScoreLoading]);

  return { scoreTask, scoreDesign };
}
