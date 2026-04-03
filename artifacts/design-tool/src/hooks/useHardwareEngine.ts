import { useState, useEffect, useCallback, useRef } from "react";
import {
  getHardwareCapabilities,
  ensureWorkerPool,
  getWorkerStats,
  getMemorySnapshot,
  type HardwareCapabilities,
} from "../lib/hardware-engine";

export interface HardwareEngineState {
  capabilities: HardwareCapabilities | null;
  initialized: boolean;
  workerPoolSize: number;
  activeWorkers: number;
  queuedTasks: number;
  totalProcessed: number;
  avgComputeMs: number;
  memoryUsedMB: number;
  memoryPercent: number;
}

export function useHardwareEngine() {
  const [state, setState] = useState<HardwareEngineState>({
    capabilities: null,
    initialized: false,
    workerPoolSize: 0,
    activeWorkers: 0,
    queuedTasks: 0,
    totalProcessed: 0,
    avgComputeMs: 0,
    memoryUsedMB: 0,
    memoryPercent: 0,
  });

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const initialize = useCallback(() => {
    const caps = getHardwareCapabilities();
    ensureWorkerPool();
    const stats = getWorkerStats();
    const mem = getMemorySnapshot();
    setState({
      capabilities: caps,
      initialized: true,
      workerPoolSize: stats.poolSize,
      activeWorkers: stats.active,
      queuedTasks: stats.queued,
      totalProcessed: stats.totalProcessed,
      avgComputeMs: stats.avgComputeMs,
      memoryUsedMB: mem.usedMB,
      memoryPercent: mem.percent,
    });
  }, []);

  useEffect(() => {
    initialize();

    intervalRef.current = setInterval(() => {
      const stats = getWorkerStats();
      const mem = getMemorySnapshot();
      setState((prev) => ({
        ...prev,
        activeWorkers: stats.active,
        queuedTasks: stats.queued,
        totalProcessed: stats.totalProcessed,
        avgComputeMs: stats.avgComputeMs,
        workerPoolSize: stats.poolSize,
        memoryUsedMB: mem.usedMB,
        memoryPercent: mem.percent,
      }));
    }, 2000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [initialize]);

  return state;
}
