import { useCallback } from "react";
import type { RollToolingResult, RollGapInfo, StationProfile } from "../store/useCncStore";

export interface SavedDesign {
  id: string;
  name: string;
  date: string;
  materialType: string;
  materialThickness: number;
  numStations: number;
  stationPrefix: string;
  profileName: string;
  rollDiameter: number;
  shaftDiameter: number;
  clearance: number;
  rollTooling: RollToolingResult[];
  stations: StationProfile[];
  rollGaps: RollGapInfo[];
}

const STORAGE_KEY = "roll_form_ai_designs";

function loadDesigns(): SavedDesign[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as SavedDesign[];
  } catch {
    return [];
  }
}

function saveDesigns(designs: SavedDesign[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(designs));
  } catch {
    // Storage full or unavailable
  }
}

export function useDesignHistory() {
  const getAll = useCallback((): SavedDesign[] => {
    return loadDesigns();
  }, []);

  const save = useCallback((design: Omit<SavedDesign, "id" | "date">): SavedDesign => {
    const designs = loadDesigns();
    const newDesign: SavedDesign = {
      ...design,
      id: `design_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      date: new Date().toISOString(),
    };
    // Keep max 50 designs
    const updated = [newDesign, ...designs].slice(0, 50);
    saveDesigns(updated);
    return newDesign;
  }, []);

  const remove = useCallback((id: string) => {
    const designs = loadDesigns().filter((d) => d.id !== id);
    saveDesigns(designs);
  }, []);

  const getById = useCallback((id: string): SavedDesign | null => {
    return loadDesigns().find((d) => d.id === id) ?? null;
  }, []);

  const clear = useCallback(() => {
    saveDesigns([]);
  }, []);

  return { getAll, save, remove, getById, clear };
}
