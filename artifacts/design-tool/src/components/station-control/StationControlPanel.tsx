import { useState, useMemo, useCallback } from "react";
import { useCncStore } from "../../store/useCncStore";
import {
  Zap, Settings2, Hand, ChevronDown, ChevronRight,
  RotateCcw, Copy, Lock, Unlock, AlertTriangle, CheckCircle2,
  Gauge, ArrowUpDown, Circle, Save, Download, Upload,
} from "lucide-react";

export type StationMode = "fully-auto" | "semi-auto" | "manual";

export interface StationControlData {
  stationNumber: number;
  mode: StationMode;
  locked: boolean;
  upperRollOD: number;
  lowerRollOD: number;
  shaftDia: number;
  rollGap: number;
  rollWidth: number;
  boreSize: number;
  speedRPM: number;
  bendAngle: number;
  notes: string;
}

const MODE_INFO: Record<StationMode, { label: string; labelHi: string; icon: typeof Zap; color: string; bg: string; border: string; desc: string }> = {
  "fully-auto": {
    label: "Fully Auto",
    labelHi: "पूरी तरह ऑटो",
    icon: Zap,
    color: "#22c55e",
    bg: "rgba(34,197,94,0.08)",
    border: "rgba(34,197,94,0.25)",
    desc: "AI sets all parameters — roll OD, shaft, gap, speed, angle — optimal for this station",
  },
  "semi-auto": {
    label: "Semi Auto",
    labelHi: "सेमी ऑटो",
    icon: Settings2,
    color: "#f59e0b",
    bg: "rgba(245,158,11,0.08)",
    border: "rgba(245,158,11,0.25)",
    desc: "AI suggests — you can override any value. Best for experienced operators",
  },
  "manual": {
    label: "Manual",
    labelHi: "मैनुअल",
    icon: Hand,
    color: "#ef4444",
    bg: "rgba(239,68,68,0.08)",
    border: "rgba(239,68,68,0.25)",
    desc: "Full control — you set every parameter. AI only warns if values are dangerous",
  },
};

function generateDefaultStations(count: number, material: string, thickness: number): StationControlData[] {
  const stations: StationControlData[] = [];
  const baseOD = material.includes("SS") || material.includes("Stainless") ? 200 : 180;
  for (let i = 1; i <= count; i++) {
    const progress = i / count;
    const angle = Math.min(90, progress * 90);
    stations.push({
      stationNumber: i,
      mode: "fully-auto",
      locked: false,
      upperRollOD: baseOD + (i % 2 === 0 ? 10 : 0),
      lowerRollOD: baseOD + 20 + (i % 2 === 0 ? 10 : 0),
      shaftDia: thickness <= 1.5 ? 50 : thickness <= 3 ? 60 : 75,
      rollGap: Math.max(thickness - 0.05, thickness * 0.98),
      rollWidth: 60 + i * 2,
      boreSize: thickness <= 1.5 ? 50 : thickness <= 3 ? 60 : 75,
      speedRPM: Math.round(25 - progress * 8),
      bendAngle: Math.round(angle * 10) / 10,
      notes: "",
    });
  }
  return stations;
}

function aiAutoCalc(st: StationControlData, idx: number, total: number, material: string, thickness: number): StationControlData {
  const progress = (idx + 1) / total;
  const isSS = material.includes("SS") || material.includes("Stainless");
  const baseOD = isSS ? 200 : 180;
  return {
    ...st,
    upperRollOD: baseOD + (idx % 2 === 0 ? 10 : 0),
    lowerRollOD: baseOD + 20 + (idx % 2 === 0 ? 10 : 0),
    shaftDia: thickness <= 1.5 ? 50 : thickness <= 3 ? 60 : 75,
    rollGap: Math.round((thickness * (1 - progress * 0.02)) * 100) / 100,
    rollWidth: Math.round(60 + idx * 2.5),
    boreSize: thickness <= 1.5 ? 50 : thickness <= 3 ? 60 : 75,
    speedRPM: Math.round(25 - progress * 8),
    bendAngle: Math.round(Math.min(90, progress * 95) * 10) / 10,
  };
}

function validateStation(st: StationControlData, thickness: number): { ok: boolean; warnings: string[] } {
  const warnings: string[] = [];
  if (st.rollGap < thickness * 0.9) warnings.push(`Roll gap (${st.rollGap}mm) too tight — may crush material (min ${(thickness * 0.9).toFixed(2)}mm)`);
  if (st.rollGap > thickness * 1.2) warnings.push(`Roll gap (${st.rollGap}mm) too loose — poor forming (max ${(thickness * 1.2).toFixed(2)}mm)`);
  if (st.shaftDia < 40) warnings.push(`Shaft dia (${st.shaftDia}mm) too small — risk of deflection`);
  if (st.shaftDia > 100) warnings.push(`Shaft dia (${st.shaftDia}mm) unusually large — check design`);
  if (st.upperRollOD < 100) warnings.push(`Upper roll OD (${st.upperRollOD}mm) too small`);
  if (st.upperRollOD > 350) warnings.push(`Upper roll OD (${st.upperRollOD}mm) unusually large`);
  if (st.speedRPM < 5) warnings.push(`Speed (${st.speedRPM} RPM) very slow`);
  if (st.speedRPM > 60) warnings.push(`Speed (${st.speedRPM} RPM) too fast — surface quality risk`);
  if (st.bendAngle > 90) warnings.push(`Bend angle (${st.bendAngle}°) exceeds 90° — check overbend`);
  return { ok: warnings.length === 0, warnings };
}

function ModeButton({ mode, active, onClick }: { mode: StationMode; active: boolean; onClick: () => void }) {
  const info = MODE_INFO[mode];
  const Icon = info.icon;
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200"
      style={{
        background: active ? info.bg : "transparent",
        border: `1px solid ${active ? info.border : "rgba(255,255,255,0.06)"}`,
        color: active ? info.color : "#71717a",
        boxShadow: active ? `0 0 12px ${info.color}22` : "none",
      }}
    >
      <Icon className="w-3.5 h-3.5" />
      {info.label}
    </button>
  );
}

function FieldInput({ label, value, unit, disabled, onChange, warning }: {
  label: string; value: number; unit: string; disabled: boolean;
  onChange: (v: number) => void; warning?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] text-zinc-500 uppercase tracking-wider">{label}</span>
      <div className="flex items-center gap-1">
        <input
          type="number"
          value={value}
          disabled={disabled}
          onChange={e => onChange(parseFloat(e.target.value) || 0)}
          className="w-full bg-white/[0.04] border rounded px-2 py-1 text-xs text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          style={{
            borderColor: warning ? "rgba(239,68,68,0.4)" : disabled ? "rgba(255,255,255,0.05)" : "rgba(245,158,11,0.2)",
          }}
          step="any"
        />
        <span className="text-[10px] text-zinc-600 shrink-0">{unit}</span>
      </div>
    </div>
  );
}

function StationCard({
  station,
  index,
  total,
  material,
  thickness,
  onChange,
  expanded,
  onToggleExpand,
}: {
  station: StationControlData;
  index: number;
  total: number;
  material: string;
  thickness: number;
  onChange: (s: StationControlData) => void;
  expanded: boolean;
  onToggleExpand: () => void;
}) {
  const modeInfo = MODE_INFO[station.mode];
  const Icon = modeInfo.icon;
  const isEditable = station.mode !== "fully-auto" && !station.locked;
  const validation = validateStation(station, thickness);

  const handleModeChange = (mode: StationMode) => {
    let updated = { ...station, mode };
    if (mode === "fully-auto") {
      updated = aiAutoCalc(updated, index, total, material, thickness);
    }
    onChange(updated);
  };

  const handleFieldChange = (field: keyof StationControlData, value: number) => {
    if (station.locked || station.mode === "fully-auto") return;
    onChange({ ...station, [field]: value });
  };

  return (
    <div
      className="rounded-xl overflow-hidden transition-all duration-300"
      style={{
        background: expanded ? "#0c0d18" : "#0a0b14",
        border: `1px solid ${expanded ? modeInfo.border : "rgba(255,255,255,0.05)"}`,
      }}
    >
      <button
        onClick={onToggleExpand}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors"
      >
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold"
          style={{ background: modeInfo.bg, color: modeInfo.color, border: `1px solid ${modeInfo.border}` }}
        >
          {station.stationNumber}
        </div>

        <div className="flex-1 text-left">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-white">Station {station.stationNumber}</span>
            <span
              className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold"
              style={{ background: modeInfo.bg, color: modeInfo.color }}
            >
              <Icon className="w-3 h-3" />
              {modeInfo.label}
            </span>
            {station.locked && <Lock className="w-3 h-3 text-zinc-500" />}
            {!validation.ok && <AlertTriangle className="w-3 h-3 text-amber-500" />}
          </div>
          <div className="text-[10px] text-zinc-600 mt-0.5">
            Roll OD: {station.upperRollOD}/{station.lowerRollOD}mm · Shaft: {station.shaftDia}mm · Gap: {station.rollGap}mm · Angle: {station.bendAngle}°
          </div>
        </div>

        {expanded ? <ChevronDown className="w-4 h-4 text-zinc-500" /> : <ChevronRight className="w-4 h-4 text-zinc-500" />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-white/5 pt-3 space-y-3">
          <div className="flex items-center gap-2">
            <ModeButton mode="fully-auto" active={station.mode === "fully-auto"} onClick={() => handleModeChange("fully-auto")} />
            <ModeButton mode="semi-auto" active={station.mode === "semi-auto"} onClick={() => handleModeChange("semi-auto")} />
            <ModeButton mode="manual" active={station.mode === "manual"} onClick={() => handleModeChange("manual")} />
            <div className="flex-1" />
            <button
              onClick={() => onChange({ ...station, locked: !station.locked })}
              className="p-1.5 rounded-lg hover:bg-white/5 transition-colors"
              title={station.locked ? "Unlock station" : "Lock station"}
            >
              {station.locked ? <Lock className="w-3.5 h-3.5 text-red-400" /> : <Unlock className="w-3.5 h-3.5 text-zinc-500" />}
            </button>
          </div>

          <div className="text-[10px] px-2 py-1.5 rounded-lg" style={{ background: modeInfo.bg, color: modeInfo.color, border: `1px solid ${modeInfo.border}` }}>
            {modeInfo.desc}
          </div>

          <div className="grid grid-cols-4 gap-3">
            <FieldInput label="Upper Roll OD" value={station.upperRollOD} unit="mm" disabled={!isEditable} onChange={v => handleFieldChange("upperRollOD", v)} />
            <FieldInput label="Lower Roll OD" value={station.lowerRollOD} unit="mm" disabled={!isEditable} onChange={v => handleFieldChange("lowerRollOD", v)} />
            <FieldInput label="Shaft Dia" value={station.shaftDia} unit="mm" disabled={!isEditable} onChange={v => handleFieldChange("shaftDia", v)} />
            <FieldInput label="Roll Gap" value={station.rollGap} unit="mm" disabled={!isEditable} onChange={v => handleFieldChange("rollGap", v)} warning={!validation.ok && validation.warnings.some(w => w.includes("gap"))} />
          </div>
          <div className="grid grid-cols-4 gap-3">
            <FieldInput label="Roll Width" value={station.rollWidth} unit="mm" disabled={!isEditable} onChange={v => handleFieldChange("rollWidth", v)} />
            <FieldInput label="Bore Size" value={station.boreSize} unit="mm" disabled={!isEditable} onChange={v => handleFieldChange("boreSize", v)} />
            <FieldInput label="Speed" value={station.speedRPM} unit="RPM" disabled={!isEditable} onChange={v => handleFieldChange("speedRPM", v)} warning={!validation.ok && validation.warnings.some(w => w.includes("Speed"))} />
            <FieldInput label="Bend Angle" value={station.bendAngle} unit="°" disabled={!isEditable} onChange={v => handleFieldChange("bendAngle", v)} />
          </div>

          {station.mode !== "fully-auto" && (
            <div>
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Notes / Commands</span>
              <textarea
                value={station.notes}
                onChange={e => onChange({ ...station, notes: e.target.value })}
                placeholder="Enter manual notes, commands, or overrides..."
                className="w-full mt-1 bg-white/[0.03] border border-white/5 rounded-lg px-3 py-2 text-xs text-white placeholder:text-zinc-600 resize-none h-16 focus:border-amber-500/30 focus:outline-none"
                disabled={station.locked}
              />
            </div>
          )}

          {!validation.ok && (
            <div className="space-y-1">
              {validation.warnings.map((w, i) => (
                <div key={i} className="flex items-start gap-2 text-[11px] text-amber-400 bg-amber-500/5 border border-amber-500/10 rounded-lg px-3 py-1.5">
                  <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
                  {w}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function StationControlPanel() {
  const { stations: storeStations, materialType, materialThickness } = useCncStore();
  const stationCount = storeStations?.length || 12;
  const mat = materialType || "CR Steel";
  const thk = materialThickness || 2.0;

  const [stationsData, setStationsData] = useState<StationControlData[]>(() => generateDefaultStations(stationCount, mat, thk));
  const [expandedStation, setExpandedStation] = useState<number | null>(null);
  const [bulkMode, setBulkMode] = useState<StationMode | null>(null);

  const handleStationChange = useCallback((idx: number, data: StationControlData) => {
    setStationsData(prev => {
      const next = [...prev];
      next[idx] = data;
      return next;
    });
  }, []);

  const handleBulkMode = (mode: StationMode) => {
    setBulkMode(mode);
    setStationsData(prev => prev.map((st, i) => {
      if (st.locked) return st;
      let updated = { ...st, mode };
      if (mode === "fully-auto") {
        updated = aiAutoCalc(updated, i, prev.length, mat, thk);
      }
      return updated;
    }));
  };

  const handleResetAll = () => {
    setStationsData(generateDefaultStations(stationCount, mat, thk));
    setBulkMode(null);
    setExpandedStation(null);
  };

  const stats = useMemo(() => {
    const auto = stationsData.filter(s => s.mode === "fully-auto").length;
    const semi = stationsData.filter(s => s.mode === "semi-auto").length;
    const manual = stationsData.filter(s => s.mode === "manual").length;
    const locked = stationsData.filter(s => s.locked).length;
    const warnings = stationsData.filter(s => !validateStation(s, thk).ok).length;
    return { auto, semi, manual, locked, warnings };
  }, [stationsData, thk]);

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(stationsData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `station-control-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    const inp = document.createElement("input");
    inp.type = "file";
    inp.accept = ".json";
    inp.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text) as StationControlData[];
        if (Array.isArray(data) && data.length > 0 && data[0].stationNumber) {
          setStationsData(data);
        }
      } catch {}
    };
    inp.click();
  };

  return (
    <div className="h-full flex flex-col bg-[#080812] text-white overflow-hidden">
      <div className="shrink-0 px-5 pt-5 pb-3 border-b border-white/5">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/20 flex items-center justify-center">
            <Gauge className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold tracking-tight">Station Control Panel</h2>
            <p className="text-xs text-zinc-500">Fully Auto · Semi Auto · Manual — per station mix & match</p>
          </div>
        </div>

        <div className="flex items-center gap-3 mb-3">
          <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-green-500/10 border border-green-500/15">
            <Zap className="w-3 h-3 text-green-400" />
            <span className="text-[11px] text-green-400 font-medium">Auto: {stats.auto}</span>
          </div>
          <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-500/10 border border-amber-500/15">
            <Settings2 className="w-3 h-3 text-amber-400" />
            <span className="text-[11px] text-amber-400 font-medium">Semi: {stats.semi}</span>
          </div>
          <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-red-500/10 border border-red-500/15">
            <Hand className="w-3 h-3 text-red-400" />
            <span className="text-[11px] text-red-400 font-medium">Manual: {stats.manual}</span>
          </div>
          {stats.locked > 0 && (
            <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-zinc-500/10 border border-zinc-500/15">
              <Lock className="w-3 h-3 text-zinc-400" />
              <span className="text-[11px] text-zinc-400 font-medium">Locked: {stats.locked}</span>
            </div>
          )}
          {stats.warnings > 0 && (
            <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-red-500/10 border border-red-500/15">
              <AlertTriangle className="w-3 h-3 text-red-400" />
              <span className="text-[11px] text-red-400 font-medium">{stats.warnings} warnings</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] text-zinc-500 uppercase tracking-widest mr-1">Bulk:</span>
          <button
            onClick={() => handleBulkMode("fully-auto")}
            className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-green-500/10 border border-green-500/20 text-green-400 hover:bg-green-500/20 transition-colors"
          >
            All Fully Auto
          </button>
          <button
            onClick={() => handleBulkMode("semi-auto")}
            className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/20 transition-colors"
          >
            All Semi Auto
          </button>
          <button
            onClick={() => handleBulkMode("manual")}
            className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-colors"
          >
            All Manual
          </button>
          <div className="flex-1" />
          <button onClick={handleExport} className="p-1.5 rounded-lg hover:bg-white/5 text-zinc-500 hover:text-amber-400 transition-colors" title="Export config">
            <Download className="w-3.5 h-3.5" />
          </button>
          <button onClick={handleImport} className="p-1.5 rounded-lg hover:bg-white/5 text-zinc-500 hover:text-amber-400 transition-colors" title="Import config">
            <Upload className="w-3.5 h-3.5" />
          </button>
          <button onClick={handleResetAll} className="p-1.5 rounded-lg hover:bg-white/5 text-zinc-500 hover:text-amber-400 transition-colors" title="Reset all">
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2">
        {stationsData.map((st, idx) => (
          <StationCard
            key={st.stationNumber}
            station={st}
            index={idx}
            total={stationsData.length}
            material={mat}
            thickness={thk}
            onChange={data => handleStationChange(idx, data)}
            expanded={expandedStation === idx}
            onToggleExpand={() => setExpandedStation(expandedStation === idx ? null : idx)}
          />
        ))}
      </div>

      <div className="shrink-0 px-5 py-3 border-t border-white/5 bg-[#060610]">
        <div className="flex items-center justify-between">
          <div className="text-[10px] text-zinc-600">
            {stationsData.length} stations · Material: {mat} · Thickness: {thk}mm
          </div>
          <div className="flex items-center gap-2">
            {stats.warnings === 0 ? (
              <span className="flex items-center gap-1 text-[11px] text-green-400">
                <CheckCircle2 className="w-3.5 h-3.5" /> All stations OK
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[11px] text-amber-400">
                <AlertTriangle className="w-3.5 h-3.5" /> {stats.warnings} station(s) need attention
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
