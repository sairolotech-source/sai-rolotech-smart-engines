import { useState } from "react";
import { useCncStore } from "@/store/useCncStore";

interface Props {
  onClose: () => void;
}

function compress(obj: unknown): string {
  const json = JSON.stringify(obj);
  return btoa(encodeURIComponent(json));
}

function decompress(code: string): unknown {
  try {
    return JSON.parse(decodeURIComponent(atob(code)));
  } catch {
    return null;
  }
}

export function ProjectShare({ onClose }: Props) {
  const state = useCncStore();
  const [tab, setTab] = useState<"export" | "import">("export");
  const [importCode, setImportCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [importError, setImportError] = useState("");
  const [importSuccess, setImportSuccess] = useState(false);

  const exportPayload = {
    v: "2.2",
    profileName: state.profileName,
    materialType: state.materialType,
    materialThickness: state.materialThickness,
    numStations: state.numStations,
    openSectionType: state.openSectionType,
    stations: state.stations,
    rollDiameter: state.rollDiameter,
    shaftDiameter: state.shaftDiameter,
    clearance: state.clearance,
    exportedAt: new Date().toISOString(),
  };

  const shareCode = compress(exportPayload);

  const handleCopy = () => {
    navigator.clipboard.writeText(shareCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  const handleImport = () => {
    setImportError("");
    setImportSuccess(false);
    const data = decompress(importCode.trim()) as any;
    if (!data || data.v !== "2.2") {
      setImportError("Invalid share code. Please check and try again.");
      return;
    }
    try {
      if (data.profileName) state.setProfileName(data.profileName);
      if (data.materialType) state.setMaterialType(data.materialType);
      if (typeof data.materialThickness === "number") state.setMaterialThickness(data.materialThickness);
      if (typeof data.numStations === "number") state.setNumStations(data.numStations);
      if (data.openSectionType) state.setOpenSectionType(data.openSectionType);
      if (Array.isArray(data.stations)) state.setStations(data.stations);
      if (typeof data.rollDiameter === "number") state.setRollDiameter(data.rollDiameter);
      if (typeof data.shaftDiameter === "number") state.setShaftDiameter(data.shaftDiameter);
      setImportSuccess(true);
      setTimeout(() => onClose(), 1500);
    } catch {
      setImportError("Import failed — data format mismatch.");
    }
  };

  return (
    <div
      className="fixed inset-0 z-[9998] flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="relative w-full max-w-lg mx-4 rounded-2xl p-6 flex flex-col gap-4"
        style={{
          background: "linear-gradient(135deg, #0d0e1e 0%, #12132a 100%)",
          border: "1px solid rgba(245,158,11,0.25)",
          boxShadow: "0 0 60px rgba(245,158,11,0.1), 0 24px 48px rgba(0,0,0,0.6)",
        }}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center rounded-full text-xs"
          style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.4)" }}
        >
          ✕
        </button>

        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          🔗 Project Share
        </h2>
        <p className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>
          Project ek code mein export karo aur kisi bhi engineer ke saath share karo
        </p>

        {/* Tabs */}
        <div className="flex rounded-lg overflow-hidden" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
          {(["export","import"] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="flex-1 py-2 text-sm font-medium transition-all"
              style={{
                background: tab === t ? "rgba(245,158,11,0.18)" : "transparent",
                color: tab === t ? "#f59e0b" : "rgba(255,255,255,0.45)",
              }}
            >
              {t === "export" ? "📤 Export" : "📥 Import"}
            </button>
          ))}
        </div>

        {tab === "export" && (
          <div className="flex flex-col gap-3">
            <div className="text-xs font-medium" style={{ color: "rgba(255,255,255,0.5)" }}>
              Profile: <span style={{ color: "#f59e0b" }}>{state.profileName || "Unnamed Project"}</span>
            </div>
            <div className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
              Stations: {state.stations?.length ?? 0} | Material: {state.materialType || "—"} @ {state.materialThickness}mm
            </div>
            <textarea
              readOnly
              value={shareCode}
              rows={4}
              className="w-full rounded-lg p-3 text-xs font-mono resize-none select-all"
              style={{
                background: "rgba(0,0,0,0.4)",
                border: "1px solid rgba(255,255,255,0.08)",
                color: "rgba(255,255,255,0.6)",
                outline: "none",
              }}
              onClick={(e) => (e.target as HTMLTextAreaElement).select()}
            />
            <button
              onClick={handleCopy}
              className="w-full py-2.5 rounded-lg font-bold text-sm transition-all hover:opacity-90 active:scale-95"
              style={{ background: copied ? "#16a34a" : "linear-gradient(135deg,#f59e0b,#d97706)", color: "#000" }}
            >
              {copied ? "✅ Copied!" : "📋 Code Copy Karo"}
            </button>
          </div>
        )}

        {tab === "import" && (
          <div className="flex flex-col gap-3">
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>
              Share code paste karo neeche:
            </p>
            <textarea
              value={importCode}
              onChange={(e) => { setImportCode(e.target.value); setImportError(""); setImportSuccess(false); }}
              rows={4}
              placeholder="Yahan share code paste karo..."
              className="w-full rounded-lg p-3 text-xs font-mono resize-none"
              style={{
                background: "rgba(0,0,0,0.4)",
                border: `1px solid ${importError ? "#ef4444" : "rgba(255,255,255,0.08)"}`,
                color: "rgba(255,255,255,0.8)",
                outline: "none",
              }}
            />
            {importError && <p className="text-xs text-red-400">{importError}</p>}
            {importSuccess && <p className="text-xs text-green-400">✅ Project load ho gaya! Window close ho rahi hai...</p>}
            <button
              onClick={handleImport}
              disabled={!importCode.trim()}
              className="w-full py-2.5 rounded-lg font-bold text-sm transition-all hover:opacity-90 active:scale-95 disabled:opacity-40"
              style={{ background: "linear-gradient(135deg,#f59e0b,#d97706)", color: "#000" }}
            >
              📥 Project Import Karo
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
