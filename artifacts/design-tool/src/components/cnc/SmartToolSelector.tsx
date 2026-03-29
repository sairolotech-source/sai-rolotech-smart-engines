import React, { useState, useCallback, useEffect } from "react";
import { useCncStore } from "../../store/useCncStore";
import { authFetch, getApiUrl } from "../../lib/auth-fetch";
import {
  Cpu, ChevronDown, ChevronRight, Clock, Database,
  ScanSearch, AlertTriangle, CheckCircle, Info, Wrench
} from "lucide-react";

interface ToolRecommendation {
  operation: string;
  insertCode: string;
  insertFamily: string;
  holder: string;
  vc: number;
  feed: number;
  doc: number;
  rpm: number;
  reason: string;
  fromLibrary?: boolean;
}

interface CycleTimeEstimate {
  operation: string;
  timeMin: number;
  lengthMm: number;
}

interface LibraryTool {
  id: string;
  name: string;
  category: string;
  subType: string;
  isoDesignation?: string;
  noseRadius?: number;
  noseAngle?: number;
  holderCode?: string;
  gradeCode?: string;
  coatingType?: string;
}

interface ProfileAnalysisResult {
  profileType: string;
  totalBendAngle: number;
  maxBendAngle: number;
  numBends: number;
  complexity: string;
  description: string;
  symmetrical: boolean;
  webHeight: number;
}

interface Delta2XTool {
  toolNumber: string;
  insertCode: string;
  toolHolder: string;
  operation: string;
  purpose: string;
  spindleSpeed: number;
  feedRate: number;
  depthOfCut: number;
  noseRadius: number;
  coolant: boolean;
}

interface StationAssignment {
  stationId: string;
  stationIndex: number;
  rollFeatures: string[];
  assignedTools: Delta2XTool[];
  sequenceOrder: string[];
  estimatedCycleTime: number;
  notes: string[];
}

interface SmartSelectionResult {
  profileAnalysis: ProfileAnalysisResult;
  selectedTools: Delta2XTool[];
  stationAssignments: StationAssignment[];
  totalTools: number;
  toolChangeCount: number;
  estimatedTotalTime: number;
  delta2xGcodeHeader: string[];
  warnings: string[];
  recommendations: string[];
}

const INSERT_MATRIX: Record<string, Record<string, {
  insert: string; family: string; holder: string;
  vcRough: number; feedRough: number; docRough: number;
  vcFinish: number; feedFinish: number; docFinish: number;
  reason: string;
}>> = {
  GI: {
    small:  { insert: "CNMG 120404-PR", family: "CNMG", holder: "MCLNR 2020K-12", vcRough: 180, feedRough: 0.30, docRough: 3.0, vcFinish: 220, feedFinish: 0.08, docFinish: 0.30, reason: "CNMG 120404-PR: stable roughing on zinc-coated surface; P25-coated carbide prevents built-up edge" },
    medium: { insert: "CNMG 120408-PR", family: "CNMG", holder: "MCLNR 2020K-12", vcRough: 180, feedRough: 0.30, docRough: 3.0, vcFinish: 220, feedFinish: 0.08, docFinish: 0.30, reason: "Larger nose radius 0.8mm for better surface finish on GI" },
    large:  { insert: "CNMG 160608-PR", family: "CNMG", holder: "MCLNR 2525M-16", vcRough: 160, feedRough: 0.35, docRough: 3.5, vcFinish: 200, feedFinish: 0.10, docFinish: 0.35, reason: "Large roll >200mm OD: CNMG 16 for heavy roughing" },
  },
  CR: {
    small:  { insert: "VNMG 110302-PF", family: "VNMG", holder: "MVJNR 2020K-11", vcRough: 200, feedRough: 0.28, docRough: 2.5, vcFinish: 240, feedFinish: 0.07, docFinish: 0.25, reason: "VNMG V-type (35°): best profiling access angle for CR finish contour" },
    medium: { insert: "VNMG 160404-PF", family: "VNMG", holder: "MVJNR 2020K-16", vcRough: 200, feedRough: 0.28, docRough: 2.5, vcFinish: 240, feedFinish: 0.07, docFinish: 0.25, reason: "VNMG 1604 for medium CR rolls — excellent chip control" },
    large:  { insert: "CNMG 160608-PR", family: "CNMG", holder: "MCLNR 2525M-16", vcRough: 180, feedRough: 0.32, docRough: 3.0, vcFinish: 220, feedFinish: 0.09, docFinish: 0.30, reason: "Large CR roll: CNMG for strength" },
  },
  HR: {
    small:  { insert: "CNMG 120408-PR", family: "CNMG", holder: "MCLNR 2020K-12", vcRough: 120, feedRough: 0.25, docRough: 2.5, vcFinish: 160, feedFinish: 0.07, docFinish: 0.25, reason: "HR has surface scale — reduce Vc to protect insert edge" },
    medium: { insert: "CNMG 120412-PR", family: "CNMG", holder: "MCLNR 2020K-12", vcRough: 120, feedRough: 0.25, docRough: 2.5, vcFinish: 160, feedFinish: 0.07, docFinish: 0.25, reason: "CNMG with larger nose R1.2 for HR scale protection" },
    large:  { insert: "CNMG 160616-PR", family: "CNMG", holder: "MCLNR 2525M-16", vcRough: 100, feedRough: 0.30, docRough: 3.0, vcFinish: 140, feedFinish: 0.08, docFinish: 0.28, reason: "Large HR: heavy roughing with CNMG 1606R1.6" },
  },
  SS: {
    small:  { insert: "CNMG 120404-MF", family: "CNMG", holder: "MCLNR 2020K-12", vcRough: 80, feedRough: 0.15, docRough: 2.0, vcFinish: 100, feedFinish: 0.06, docFinish: 0.20, reason: "SS: CNMG-MF geometry for work hardening — M20-M30 PVD TiAlN, flood coolant mandatory" },
    medium: { insert: "CNMG 120404-MF", family: "CNMG", holder: "MCLNR 2020K-12", vcRough: 80, feedRough: 0.15, docRough: 1.5, vcFinish: 100, feedFinish: 0.05, docFinish: 0.20, reason: "SS medium: reduce DOC for safer multiple passes" },
    large:  { insert: "CNMG 160608-MF", family: "CNMG", holder: "MCLNR 2525M-16", vcRough: 70, feedRough: 0.15, docRough: 1.5, vcFinish: 90, feedFinish: 0.06, docFinish: 0.18, reason: "Large SS roll >200mm: lower Vc — coolant at max pressure" },
  },
  AL: {
    small:  { insert: "VCMT 110302-AK", family: "VCMT", holder: "MVJNR 2020K-11", vcRough: 300, feedRough: 0.35, docRough: 4.0, vcFinish: 400, feedFinish: 0.10, docFinish: 0.40, reason: "AL: VCMT uncoated (sharp edge prevents BUE) — high Vc" },
    medium: { insert: "WNMG 080408-MR", family: "WNMG", holder: "MWLNR 2020K-08", vcRough: 300, feedRough: 0.35, docRough: 4.0, vcFinish: 400, feedFinish: 0.10, docFinish: 0.40, reason: "WNMG for AL: 6 cutting edges economy — K10 uncoated" },
    large:  { insert: "WNMG 080412-MR", family: "WNMG", holder: "MWLNR 2525M-08", vcRough: 280, feedRough: 0.35, docRough: 4.5, vcFinish: 380, feedFinish: 0.12, docFinish: 0.45, reason: "Large AL roll: higher DOC acceptable" },
  },
  MS: {
    small:  { insert: "CNMG 120408-PR", family: "CNMG", holder: "MCLNR 2020K-12", vcRough: 160, feedRough: 0.30, docRough: 3.0, vcFinish: 200, feedFinish: 0.08, docFinish: 0.30, reason: "MS standard: CNMG-PR P25 coated carbide" },
    medium: { insert: "CNMG 120408-PR", family: "CNMG", holder: "MCLNR 2020K-12", vcRough: 160, feedRough: 0.30, docRough: 3.0, vcFinish: 200, feedFinish: 0.08, docFinish: 0.30, reason: "MS medium: optimize with CSS G96 mode" },
    large:  { insert: "CNMG 160608-PR", family: "CNMG", holder: "MCLNR 2525M-16", vcRough: 140, feedRough: 0.32, docRough: 3.5, vcFinish: 180, feedFinish: 0.09, docFinish: 0.32, reason: "Large MS roll: CNMG 1606 for stability at large diameter" },
  },
};

function getRpmRange(vc: number, diameter: number): number {
  if (diameter <= 0) return 500;
  return Math.max(100, Math.min(3000, Math.round((1000 * vc) / (Math.PI * diameter))));
}

function estimateCycleTime(rollDiameter: number, rollWidth: number, materialType: string): CycleTimeEstimate[] {
  const feedData: Record<string, { roughFn: number; semiVc: number; semiFn: number; finVc: number; finFn: number }> = {
    GI: { roughFn: 0.30, semiVc: 200, semiFn: 0.18, finVc: 220, finFn: 0.08 },
    CR: { roughFn: 0.28, semiVc: 220, semiFn: 0.16, finVc: 240, finFn: 0.07 },
    HR: { roughFn: 0.25, semiVc: 140, semiFn: 0.15, finVc: 160, finFn: 0.07 },
    SS: { roughFn: 0.15, semiVc: 90, semiFn: 0.10, finVc: 100, finFn: 0.06 },
    AL: { roughFn: 0.35, semiVc: 350, semiFn: 0.20, finVc: 400, finFn: 0.10 },
    MS: { roughFn: 0.30, semiVc: 180, semiFn: 0.18, finVc: 200, finFn: 0.08 },
  };
  const m = feedData[materialType] ?? feedData.GI;
  const stock = 4;
  const roughPasses = Math.ceil(stock / 2.5);
  const roughRpm = Math.min(2000, getRpmRange(160, rollDiameter + stock));
  const roughTime = roughPasses > 0 && m.roughFn > 0 && roughRpm > 0
    ? (roughPasses * rollWidth) / (m.roughFn * roughRpm)
    : 5;
  return [
    { operation: "Face Both Ends", timeMin: Math.max(1.5, Math.round((rollWidth / (0.20 * 1200)) * 2 * 100) / 100 + 1.5), lengthMm: rollWidth * 2 },
    { operation: "OD Rough", timeMin: Math.max(3, Math.round(roughTime * 100) / 100), lengthMm: roughPasses * rollWidth },
    { operation: "Bore Rough+Finish", timeMin: Math.max(2.5, Math.round((rollWidth * 2 / (0.08 * Math.min(2500, getRpmRange(120, 40)))) * 100) / 100), lengthMm: rollWidth * 2 },
    { operation: "OD Semi-Finish", timeMin: Math.max(2, Math.round((rollWidth / (m.semiFn * Math.min(2500, getRpmRange(m.semiVc, rollDiameter)))) * 100) / 100), lengthMm: rollWidth },
    { operation: "Profile Finish", timeMin: Math.max(2, Math.round((rollWidth / (m.finFn * Math.min(3000, getRpmRange(m.finVc, rollDiameter)))) * 100) / 100), lengthMm: rollWidth },
    { operation: "Groove + Chamfer", timeMin: 2.5, lengthMm: rollDiameter * 0.5 },
    { operation: "Inspection", timeMin: 3, lengthMm: 0 },
  ];
}

function matchLibraryTool(tools: LibraryTool[], operation: string, materialType: string, insertCode: string): LibraryTool | null {
  const subTypeMap: Record<string, string[]> = {
    "OD Roughing + Facing": ["od_roughing"],
    "OD Finish Profile": ["profiling", "od_finishing"],
    "Boring (ID Finish)": ["boring"],
    "Grooving": ["grooving", "cutoff"],
  };
  const targetSubTypes = subTypeMap[operation] || [];
  const candidates = tools.filter(t => t.category === "turning" && targetSubTypes.includes(t.subType));
  if (candidates.length === 0) return null;
  const family = insertCode.split(" ")[0];
  const exactMatch = candidates.find(t => t.isoDesignation === insertCode);
  if (exactMatch) return exactMatch;
  const familyMatch = candidates.find(t => t.isoDesignation && t.isoDesignation.startsWith(family + " "));
  if (familyMatch) return familyMatch;
  const gradeMap: Record<string, string[]> = {
    SS: ["M20", "M30"], AL: ["K10"], GI: ["P25", "P30"], CR: ["P20", "P25"],
    HR: ["P25", "P30"], MS: ["P25", "P30"],
  };
  const preferredGrades = gradeMap[materialType] || ["P25"];
  const gradeMatch = candidates.find(t => t.gradeCode && preferredGrades.includes(t.gradeCode));
  if (gradeMatch) return gradeMatch;
  return candidates[0];
}

const COMPLEXITY_COLOR: Record<string, string> = {
  simple: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  medium: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  complex: "text-red-400 bg-red-500/10 border-red-500/20",
};

const PROFILE_ICON: Record<string, string> = {
  "C-Channel": "⊏",
  "Z-Section": "Z",
  "Hat-Section": "⌒",
  "U-Channel": "U",
  "Angle": "∠",
  "Omega": "Ω",
  "T-Section": "T",
  "Custom": "✦",
};

type ViewMode = "profile" | "perRoll";

export function SmartToolSelector() {
  const { rollTooling, materialType, rollDiameter, stations, geometry } = useCncStore();
  const [expanded, setExpanded] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("profile");

  const [profileResult, setProfileResult] = useState<SmartSelectionResult | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [expandedStation, setExpandedStation] = useState<number | null>(null);

  const [recommendations, setRecommendations] = useState<ToolRecommendation[]>([]);
  const [cycleEstimate, setCycleEstimate] = useState<CycleTimeEstimate[]>([]);
  const [selectedRollIdx, setSelectedRollIdx] = useState(0);
  const [loading, setLoading] = useState(false);
  const [libraryTools, setLibraryTools] = useState<LibraryTool[]>([]);
  const [usingLibrary, setUsingLibrary] = useState(false);

  useEffect(() => {
    if (!expanded) return;
    authFetch(getApiUrl("/tools?category=turning"))
      .then(r => r.json())
      .then(data => {
        if (data.success && data.tools.length > 0) setLibraryTools(data.tools);
      })
      .catch(() => {});
  }, [expanded]);

  const runProfileAnalysis = useCallback(async () => {
    if (!stations || stations.length === 0) {
      setProfileError("Pehle Flower Pattern generate karein");
      return;
    }
    setProfileLoading(true);
    setProfileError(null);
    setProfileResult(null);
    try {
      const resp = await authFetch(getApiUrl("/smart-tool-selector"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stations,
          geometry: geometry ?? { bends: [], segments: [], profileType: "unknown", totalAngle: 0, stripWidth: 200 },
          materialType,
        }),
      });
      const data = await resp.json();
      if (!data.success) throw new Error(data.error || "Tool selection failed");
      setProfileResult(data.result as SmartSelectionResult);
    } catch (e: unknown) {
      setProfileError(e instanceof Error ? e.message : "Server error");
    } finally {
      setProfileLoading(false);
    }
  }, [stations, geometry, materialType]);

  const currentRoll = rollTooling[selectedRollIdx];
  const rollDia = currentRoll?.rollProfile?.rollDiameter ?? rollDiameter;
  const rollWidth = currentRoll?.rollProfile?.rollWidth ?? 50;
  const sizeKey = rollDia < 100 ? "small" : rollDia < 200 ? "medium" : "large";

  const runSelection = useCallback(() => {
    setLoading(true);
    setTimeout(() => {
      const matInserts = INSERT_MATRIX[materialType] ?? INSERT_MATRIX.GI;
      const ins = matInserts[sizeKey]!;
      const hasLibrary = libraryTools.length > 0;
      const buildRec = (operation: string, fallbackInsert: string, fallbackFamily: string, fallbackHolder: string, vc: number, feed: number, doc: number): ToolRecommendation => {
        const libTool = hasLibrary ? matchLibraryTool(libraryTools, operation, materialType, fallbackInsert) : null;
        if (libTool) {
          return { operation, insertCode: libTool.isoDesignation || libTool.name, insertFamily: (libTool.isoDesignation || libTool.name).split(" ")[0], holder: libTool.holderCode || fallbackHolder, vc, feed, doc, rpm: getRpmRange(vc, rollDia), reason: `From tool library: ${libTool.name} (${libTool.gradeCode || ""} ${libTool.coatingType || ""})`.trim(), fromLibrary: true };
        }
        return { operation, insertCode: fallbackInsert, insertFamily: fallbackFamily, holder: fallbackHolder, vc, feed, doc, rpm: getRpmRange(vc, rollDia), reason: ins.reason, fromLibrary: false };
      };
      const recs: ToolRecommendation[] = [
        buildRec("OD Roughing + Facing", ins.insert, ins.family, ins.holder, ins.vcRough, ins.feedRough, ins.docRough),
        buildRec("OD Finish Profile", materialType === "AL" ? "VCMT 110302-AK" : materialType === "SS" ? "VNMG 110302-PF" : "VNMG 110304-PF", "VNMG", "MVJNR 2020K-11", ins.vcFinish, ins.feedFinish, ins.docFinish),
        buildRec("Boring (ID Finish)", materialType === "AL" ? "CCMT 060202-AK" : "CCMT 060204-MF", "CCMT", `Boring bar Ø${Math.max(16, Math.round(rollDia * 0.25))} carbide`, ins.vcFinish * 0.7, ins.feedFinish * 0.8, 0.3),
        buildRec("Grooving", materialType === "AL" ? "MGMN 200-G (2mm)" : "MGMN 250-G (2.5mm)", "Grooving", "MGEHR 2020-3 blade holder", ins.vcRough * 0.5, materialType === "SS" ? 0.04 : 0.06, 0.5),
      ];
      setUsingLibrary(hasLibrary && recs.some(r => r.fromLibrary));
      setRecommendations(recs);
      setCycleEstimate(estimateCycleTime(rollDia, rollWidth, materialType));
      setLoading(false);
    }, 500);
  }, [materialType, rollDia, rollWidth, sizeKey, libraryTools]);

  const totalTime = cycleEstimate.reduce((s, c) => s + c.timeMin, 0);
  const hasRolls = rollTooling.length > 0;
  const hasStations = stations && stations.length > 0;

  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-white/[0.03] transition-colors"
      >
        <Cpu className="w-3.5 h-3.5 text-cyan-400" />
        <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-widest">Smart Tool Selector</span>
        {usingLibrary && <span className="text-[8px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"><Database className="w-2.5 h-2.5 inline mr-0.5" />Library</span>}
        {profileResult && <span className="text-[8px] px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-400 border border-violet-500/20"><ScanSearch className="w-2.5 h-2.5 inline mr-0.5" />{profileResult.profileAnalysis.profileType}</span>}
        <span className="ml-auto">{expanded ? <ChevronDown className="w-3 h-3 text-zinc-600" /> : <ChevronRight className="w-3 h-3 text-zinc-600" />}</span>
      </button>

      {expanded && (
        <div className="px-3 pb-3 border-t border-white/[0.06] space-y-3 pt-3">

          <div className="flex gap-1 rounded-lg bg-zinc-900/60 p-0.5 border border-zinc-700/30">
            <button
              onClick={() => setViewMode("profile")}
              className={`flex-1 text-[10px] py-1.5 rounded-md font-semibold transition-all flex items-center justify-center gap-1 ${viewMode === "profile" ? "bg-violet-600/30 text-violet-300 border border-violet-500/40" : "text-zinc-500 hover:text-zinc-300"}`}
            >
              <ScanSearch className="w-3 h-3" /> Profile Analysis
            </button>
            <button
              onClick={() => setViewMode("perRoll")}
              className={`flex-1 text-[10px] py-1.5 rounded-md font-semibold transition-all flex items-center justify-center gap-1 ${viewMode === "perRoll" ? "bg-cyan-600/30 text-cyan-300 border border-cyan-500/40" : "text-zinc-500 hover:text-zinc-300"}`}
            >
              <Wrench className="w-3 h-3" /> Per Roll
            </button>
          </div>

          {viewMode === "profile" && (
            <div className="space-y-3">
              {!hasStations && (
                <div className="text-[10px] text-amber-400/70 flex items-center gap-2 p-2 rounded-lg bg-amber-900/10 border border-amber-500/20">
                  <AlertTriangle className="w-3 h-3 shrink-0" />
                  Pehle Flower Pattern generate karein — phir profile analyze ho ga
                </div>
              )}

              <button
                onClick={runProfileAnalysis}
                disabled={profileLoading || !hasStations}
                className="w-full py-2 rounded-lg text-[11px] font-bold bg-violet-900/40 hover:bg-violet-900/60 border border-violet-500/30 text-violet-200 transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
              >
                <ScanSearch className={`w-3.5 h-3.5 ${profileLoading ? "animate-pulse" : ""}`} />
                {profileLoading ? "Profile Analyze Ho Raha Hai..." : "Profile Analyze Karo — Tools Select Karo"}
              </button>

              {profileError && (
                <div className="text-[10px] text-red-400 flex items-center gap-1.5 p-2 rounded-lg bg-red-900/10 border border-red-500/20">
                  <AlertTriangle className="w-3 h-3 shrink-0" />{profileError}
                </div>
              )}

              {profileResult && (
                <div className="space-y-2">
                  <div className="p-3 rounded-xl bg-violet-950/20 border border-violet-500/25">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-2xl font-bold text-violet-300">
                        {PROFILE_ICON[profileResult.profileAnalysis.profileType] ?? "✦"}
                      </span>
                      <div className="flex-1">
                        <div className="text-[13px] font-bold text-violet-200">{profileResult.profileAnalysis.profileType}</div>
                        <div className="text-[10px] text-zinc-400">{profileResult.profileAnalysis.description}</div>
                      </div>
                      <span className={`text-[9px] font-bold px-2 py-1 rounded-full border ${COMPLEXITY_COLOR[profileResult.profileAnalysis.complexity] ?? COMPLEXITY_COLOR.medium}`}>
                        {profileResult.profileAnalysis.complexity.toUpperCase()}
                      </span>
                    </div>
                    <div className="grid grid-cols-4 gap-1.5 text-[10px]">
                      {[
                        ["Bends", profileResult.profileAnalysis.numBends],
                        ["Max Angle", `${profileResult.profileAnalysis.maxBendAngle.toFixed(0)}°`],
                        ["Tools", profileResult.totalTools],
                        ["Time", `${profileResult.estimatedTotalTime.toFixed(0)} min`],
                      ].map(([l, v]) => (
                        <div key={String(l)} className="text-center p-1.5 rounded bg-violet-900/20">
                          <div className="text-zinc-500">{l}</div>
                          <div className="text-violet-200 font-mono font-bold">{v}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {profileResult.warnings.length > 0 && (
                    <div className="p-2.5 rounded-lg bg-amber-950/15 border border-amber-500/25 space-y-1">
                      {profileResult.warnings.map((w, i) => (
                        <div key={i} className="text-[10px] text-amber-300 flex items-start gap-1.5">
                          <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0 text-amber-400" />{w}
                        </div>
                      ))}
                    </div>
                  )}

                  <div>
                    <div className="text-[10px] font-semibold text-zinc-400 mb-1.5 flex items-center gap-1.5">
                      <Wrench className="w-3 h-3 text-cyan-400" /> Delta 2X — Required Tools
                    </div>
                    <div className="space-y-1.5">
                      {profileResult.selectedTools.map((tool) => (
                        <div key={tool.toolNumber} className="flex items-center gap-2 p-2 rounded-lg bg-zinc-900/50 border border-zinc-700/30 text-[10px]">
                          <span className="font-mono font-bold text-cyan-300 w-10 shrink-0">{tool.toolNumber}</span>
                          <div className="flex-1 min-w-0">
                            <div className="text-zinc-200 font-semibold truncate">{tool.insertCode}</div>
                            <div className="text-zinc-500 truncate">{tool.purpose}</div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-zinc-300 font-mono">{tool.spindleSpeed}rpm</div>
                            <div className="text-zinc-500">{tool.feedRate}mm/rev</div>
                          </div>
                          {tool.coolant && <span className="text-[8px] px-1 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">💧</span>}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="text-[10px] font-semibold text-zinc-400 mb-1.5 flex items-center gap-1.5">
                      <Clock className="w-3 h-3 text-amber-400" /> Station-by-Station Plan
                    </div>
                    <div className="space-y-1">
                      {profileResult.stationAssignments.map((sa, idx) => (
                        <div key={sa.stationId} className="rounded-lg border border-zinc-700/30 overflow-hidden">
                          <button
                            onClick={() => setExpandedStation(expandedStation === idx ? null : idx)}
                            className="w-full flex items-center gap-2 px-2.5 py-2 bg-zinc-900/50 hover:bg-zinc-900/70 transition-colors text-left"
                          >
                            <span className="text-[10px] font-bold text-zinc-300">Stn {sa.stationIndex}</span>
                            <span className="text-[10px] text-zinc-500 flex-1 truncate">{sa.sequenceOrder.join(" → ")}</span>
                            <span className="text-[9px] text-amber-300 font-mono shrink-0">{sa.estimatedCycleTime.toFixed(1)} min</span>
                            {expandedStation === idx ? <ChevronDown className="w-3 h-3 text-zinc-600 shrink-0" /> : <ChevronRight className="w-3 h-3 text-zinc-600 shrink-0" />}
                          </button>
                          {expandedStation === idx && (
                            <div className="px-2.5 py-2 border-t border-zinc-700/30 space-y-1.5 bg-zinc-900/30">
                              <div className="space-y-1">
                                {sa.rollFeatures.map((f, fi) => (
                                  <div key={fi} className="text-[10px] text-zinc-400 flex items-center gap-1.5">
                                    <CheckCircle className="w-2.5 h-2.5 text-emerald-500 shrink-0" />{f}
                                  </div>
                                ))}
                              </div>
                              {sa.notes.length > 0 && (
                                <div className="space-y-1 pt-1 border-t border-zinc-700/20">
                                  {sa.notes.map((n, ni) => (
                                    <div key={ni} className="text-[10px] text-amber-300/80 flex items-start gap-1.5">
                                      <Info className="w-2.5 h-2.5 mt-0.5 shrink-0 text-amber-400" />{n}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {profileResult.recommendations.length > 0 && (
                    <div className="p-2.5 rounded-lg bg-emerald-950/15 border border-emerald-500/20 space-y-1">
                      <div className="text-[10px] font-semibold text-emerald-400 mb-1 flex items-center gap-1"><CheckCircle className="w-3 h-3" />Recommendations</div>
                      {profileResult.recommendations.map((r, i) => (
                        <div key={i} className="text-[10px] text-emerald-300/80">{r}</div>
                      ))}
                    </div>
                  )}

                  <div className="p-2 rounded-lg bg-zinc-900/50 border border-zinc-700/30">
                    <div className="text-[9px] font-semibold text-zinc-500 mb-1.5">Delta 2X G-Code Header</div>
                    <div className="font-mono text-[9px] text-green-400/70 space-y-0.5">
                      {profileResult.delta2xGcodeHeader.map((line, i) => (
                        <div key={i}>{line}</div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {viewMode === "perRoll" && (
            <div className="space-y-3">
              {!hasRolls && (
                <div className="text-[10px] text-amber-400/70 flex items-center gap-2 p-2 rounded-lg bg-amber-900/10 border border-amber-500/20">
                  <AlertTriangle className="w-3 h-3 shrink-0" />
                  Pehle Roll Tooling calculate karein
                </div>
              )}

              {hasRolls && (
                <>
                  <div className="flex items-end gap-2">
                    <div className="flex-1">
                      <label className="text-[10px] text-zinc-500 block mb-1">Roll Station</label>
                      <select
                        value={selectedRollIdx}
                        onChange={e => setSelectedRollIdx(parseInt(e.target.value))}
                        className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 focus:border-cyan-500 focus:outline-none"
                      >
                        {rollTooling.map((rt, idx) => (
                          <option key={idx} value={idx}>
                            Stn {rt.stationNumber} — {rt.label} (Ø{rt.rollProfile?.rollDiameter?.toFixed(1) ?? "—"}mm)
                          </option>
                        ))}
                      </select>
                    </div>
                    <button
                      onClick={runSelection}
                      disabled={loading}
                      className="px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-cyan-900/40 hover:bg-cyan-900/60 border border-cyan-500/30 text-cyan-300 transition-colors disabled:opacity-50"
                    >
                      {loading ? "Selecting..." : "Auto-Select"}
                    </button>
                  </div>

                  {libraryTools.length > 0 && (
                    <div className="text-[9px] text-emerald-400/60 flex items-center gap-1">
                      <Database className="w-3 h-3" />
                      {libraryTools.length} tools loaded from your library
                    </div>
                  )}

                  <div className="grid grid-cols-3 gap-1.5 text-[10px]">
                    {[["Roll OD", `Ø${rollDia.toFixed(1)} mm`], ["Material", materialType], ["Size Class", sizeKey.charAt(0).toUpperCase() + sizeKey.slice(1)]].map(([l, v]) => (
                      <div key={l} className="p-1.5 rounded bg-zinc-900/60 border border-zinc-700/40 text-center">
                        <div className="text-zinc-500">{l}</div>
                        <div className="text-cyan-300 font-mono font-semibold">{v}</div>
                      </div>
                    ))}
                  </div>

                  {recommendations.length > 0 && (
                    <>
                      <div className="space-y-2">
                        {recommendations.map((rec, i) => (
                          <div key={i} className={`p-2.5 rounded-lg border space-y-1.5 ${rec.fromLibrary ? "bg-emerald-950/15 border-emerald-500/20" : "bg-cyan-950/15 border-cyan-500/20"}`}>
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-semibold text-cyan-300">{rec.operation}</span>
                              <div className="flex items-center gap-1">
                                {rec.fromLibrary && <Database className="w-3 h-3 text-emerald-400" />}
                                <span className="text-[10px] font-mono bg-cyan-900/40 text-cyan-200 px-1.5 py-0.5 rounded">{rec.insertCode}</span>
                              </div>
                            </div>
                            <div className="grid grid-cols-4 gap-1.5 text-[10px]">
                              {[["Vc", `${rec.vc} m/min`], ["Feed", `${rec.feed} mm/rev`], ["DOC", `${rec.doc} mm`], ["RPM", `${Math.min(3000, rec.rpm)}`]].map(([l, v]) => (
                                <div key={l} className="text-center">
                                  <div className="text-zinc-500">{l}</div>
                                  <div className="text-zinc-200 font-mono font-semibold">{v}</div>
                                </div>
                              ))}
                            </div>
                            <div className="text-[10px] text-zinc-400">{rec.holder}</div>
                            <div className="text-[10px] text-amber-300/70 italic">{rec.reason}</div>
                          </div>
                        ))}
                      </div>

                      {cycleEstimate.length > 0 && (
                        <div className="p-2.5 rounded-lg bg-amber-950/15 border border-amber-500/20">
                          <div className="flex items-center gap-2 mb-2">
                            <Clock className="w-3.5 h-3.5 text-amber-400" />
                            <span className="text-[11px] font-semibold text-amber-300">Cycle Time Estimate</span>
                            <span className="ml-auto text-amber-200 font-mono font-bold text-sm">~{Math.round(totalTime)} min</span>
                          </div>
                          <div className="space-y-1">
                            {cycleEstimate.map((ct, i) => (
                              <div key={i} className="flex justify-between items-center text-[10px] border-b border-amber-900/30 pb-0.5">
                                <span className="text-zinc-400">{ct.operation}</span>
                                <div className="flex items-center gap-2">
                                  {ct.lengthMm > 0 && <span className="text-zinc-500 font-mono">{ct.lengthMm.toFixed(0)} mm</span>}
                                  <span className="text-amber-300 font-mono font-semibold">~{ct.timeMin.toFixed(1)} min</span>
                                </div>
                              </div>
                            ))}
                            <div className="flex justify-between text-xs font-bold pt-1">
                              <span className="text-zinc-300">Total per roll</span>
                              <span className="text-amber-200 font-mono">~{Math.round(totalTime)} min</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
