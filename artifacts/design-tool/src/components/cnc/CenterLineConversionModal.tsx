/**
 * SAI Rolotech — Center Line → Sheet Profile Conversion Modal
 *
 * Appears after DXF upload when the geometry is detected (or selected) as
 * a center-line profile.  Collects thickness parameters, runs the offline
 * converter, and writes the result back to the store.
 */

import React, { useState, useCallback } from "react";
import { X, Layers, ChevronRight, AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react";
import { useCncStore } from "../../store/useCncStore";
import { convertCenterLineToSheet, detectProfileSourceType, type OffsetMode } from "../../lib/centerLineConverter";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Called when conversion is done — parent can navigate or show toast. */
  onConverted?: (bendCount: number, devLength: number) => void;
}

const OFFSET_MODES: { value: OffsetMode; label: string; desc: string }[] = [
  { value: "both",    label: "Center (Both Sides)",  desc: "Offset equally ±t/2 each side — most common for roll-formed profiles" },
  { value: "outside", label: "Outside Only",          desc: "Center line becomes the inner face — offset to the outside by t" },
  { value: "inside",  label: "Inside Only",           desc: "Center line becomes the outer face — offset to the inside by t" },
];

export function CenterLineConversionModal({ open, onClose, onConverted }: Props) {
  const {
    geometry,
    materialThickness,
    minThickness,
    maxThickness,
    materialType,
    setGeometry,
    setMinThickness,
    setMaxThickness,
    setMaterialThickness,
    setProfileSourceType,
  } = useCncStore();

  const [nomThk, setNomThk] = useState(materialThickness || 1.0);
  const [minThk, setMinThk] = useState(minThickness || 0.9);
  const [maxThk, setMaxThk] = useState(maxThickness || 1.1);
  const [offsetMode, setOffsetMode] = useState<OffsetMode>("both");
  const [kFactor, setKFactor] = useState(0.44);
  const [bendRadius, setBendRadius] = useState(nomThk);
  const [converting, setConverting] = useState(false);
  const [done, setDone] = useState(false);
  const [result, setResult] = useState<{ bendCount: number; devLength: number; warnings: string[] } | null>(null);
  const [sourceChoice, setSourceChoice] = useState<"centerline" | "sheetProfile" | null>(() => {
    if (!geometry?.segments?.length) return null;
    const detected = detectProfileSourceType(geometry.segments);
    return detected === "unknown" ? null : detected;
  });

  const handleConvert = useCallback(() => {
    if (!geometry?.segments?.length) return;
    setConverting(true);

    try {
      const res = convertCenterLineToSheet({
        segments: geometry.segments,
        thickness: nomThk,
        offsetMode,
        kFactor,
        bendRadius,
      });

      setGeometry(res.geometry);
      setMaterialThickness(nomThk);
      setMinThickness(minThk);
      setMaxThickness(maxThk);
      setProfileSourceType("centerline");

      setResult({ bendCount: res.bendCount, devLength: res.developedLength, warnings: res.warnings });
      setDone(true);
      onConverted?.(res.bendCount, res.developedLength);
    } catch (err) {
      console.error("[CenterLineConversion] Error:", err);
    } finally {
      setConverting(false);
    }
  }, [geometry, nomThk, minThk, maxThk, offsetMode, kFactor, bendRadius, setGeometry, setMaterialThickness, setMinThickness, setMaxThickness, setProfileSourceType, onConverted]);

  const handleUseAsSheet = useCallback(() => {
    setMaterialThickness(nomThk);
    setMinThickness(minThk);
    setMaxThickness(maxThk);
    setProfileSourceType("sheetProfile");
    onClose();
  }, [nomThk, minThk, maxThk, setMaterialThickness, setMinThickness, setMaxThickness, setProfileSourceType, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)" }}>
      <div
        className="w-full max-w-lg rounded-2xl border border-white/10 shadow-2xl overflow-hidden"
        style={{ background: "rgba(9,10,24,0.97)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.07]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-500/20 to-amber-500/10 border border-orange-500/30 flex items-center justify-center">
              <Layers className="w-4.5 h-4.5 text-orange-400" />
            </div>
            <div>
              <div className="text-sm font-bold text-white">Profile Setup</div>
              <div className="text-[10px] text-zinc-500 mt-0.5">Set thickness and offset mode for your DXF profile</div>
            </div>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg bg-white/[0.05] hover:bg-white/[0.10] flex items-center justify-center transition-colors">
            <X className="w-3.5 h-3.5 text-zinc-400" />
          </button>
        </div>

        <div className="p-5 space-y-5 overflow-y-auto max-h-[70vh]">
          {!done ? (
            <>
              {/* Step 1: Profile type selection */}
              <div>
                <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-3">
                  Step 1 — Is this a center line or sheet profile?
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { v: "centerline",   label: "Center Line",    desc: "Single line representing the neutral axis — needs thickness expansion", color: "orange" },
                    { v: "sheetProfile", label: "Sheet Profile",   desc: "Already has full sheet thickness — use directly", color: "blue" },
                  ] as const).map(opt => (
                    <button
                      key={opt.v}
                      onClick={() => setSourceChoice(opt.v)}
                      className={`rounded-xl border p-3 text-left transition-all ${
                        sourceChoice === opt.v
                          ? opt.color === "orange"
                            ? "border-orange-500/60 bg-orange-500/10"
                            : "border-blue-500/60 bg-blue-500/10"
                          : "border-white/[0.07] bg-white/[0.02] hover:border-white/20"
                      }`}
                    >
                      <div className={`text-xs font-bold mb-1 ${sourceChoice === opt.v ? (opt.color === "orange" ? "text-orange-300" : "text-blue-300") : "text-zinc-300"}`}>
                        {opt.label}
                      </div>
                      <div className="text-[10px] text-zinc-500 leading-relaxed">{opt.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Step 2: Thickness inputs */}
              {sourceChoice !== null && (
                <div>
                  <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-3">
                    Step 2 — Thickness parameters
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: "Nominal (t)", val: nomThk, set: (v: number) => { setNomThk(v); setBendRadius(v); setMinThk(parseFloat((v * 0.9).toFixed(2))); setMaxThk(parseFloat((v * 1.1).toFixed(2))); } },
                      { label: "Min (t−10%)", val: minThk, set: setMinThk },
                      { label: "Max (t+10%)", val: maxThk, set: setMaxThk },
                    ].map(f => (
                      <div key={f.label}>
                        <div className="text-[9px] text-zinc-500 mb-1">{f.label}</div>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min={0.1} max={25} step={0.05}
                            value={f.val}
                            onChange={e => f.set(parseFloat(e.target.value) || 0.1)}
                            className="w-full bg-white/[0.04] border border-white/[0.10] rounded-lg px-2 py-1.5 text-xs text-white font-mono focus:border-orange-500/50 focus:outline-none"
                          />
                          <span className="text-[9px] text-zinc-600 flex-shrink-0">mm</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Step 3: Offset mode (only for centerline) */}
              {sourceChoice === "centerline" && (
                <div>
                  <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-3">
                    Step 3 — Offset mode
                  </div>
                  <div className="space-y-2">
                    {OFFSET_MODES.map(m => (
                      <button
                        key={m.value}
                        onClick={() => setOffsetMode(m.value)}
                        className={`w-full rounded-xl border p-3 text-left transition-all flex items-start gap-3 ${
                          offsetMode === m.value
                            ? "border-orange-500/50 bg-orange-500/[0.08]"
                            : "border-white/[0.06] bg-white/[0.02] hover:border-white/15"
                        }`}
                      >
                        <div className={`w-3.5 h-3.5 rounded-full border-2 flex-shrink-0 mt-0.5 transition-colors ${offsetMode === m.value ? "border-orange-400 bg-orange-400" : "border-zinc-600"}`} />
                        <div>
                          <div className={`text-xs font-semibold ${offsetMode === m.value ? "text-orange-300" : "text-zinc-300"}`}>{m.label}</div>
                          <div className="text-[10px] text-zinc-500 mt-0.5">{m.desc}</div>
                        </div>
                      </button>
                    ))}
                  </div>

                  {/* Advanced: K-factor and bend radius */}
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <div>
                      <div className="text-[9px] text-zinc-500 mb-1">Bend Radius (default t×1.0)</div>
                      <div className="flex items-center gap-1">
                        <input
                          type="number" min={0.1} max={50} step={0.1}
                          value={bendRadius}
                          onChange={e => setBendRadius(parseFloat(e.target.value) || 0.1)}
                          className="w-full bg-white/[0.04] border border-white/[0.10] rounded-lg px-2 py-1.5 text-xs text-white font-mono focus:border-orange-500/50 focus:outline-none"
                        />
                        <span className="text-[9px] text-zinc-600 flex-shrink-0">mm</span>
                      </div>
                    </div>
                    <div>
                      <div className="text-[9px] text-zinc-500 mb-1">K-Factor (0.33–0.50)</div>
                      <input
                        type="number" min={0.25} max={0.55} step={0.01}
                        value={kFactor}
                        onChange={e => setKFactor(parseFloat(e.target.value) || 0.44)}
                        className="w-full bg-white/[0.04] border border-white/[0.10] rounded-lg px-2 py-1.5 text-xs text-white font-mono focus:border-orange-500/50 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Validation warning */}
              {sourceChoice !== null && nomThk <= 0 && (
                <div className="flex items-center gap-2 text-[11px] text-amber-400 bg-amber-950/30 border border-amber-700/30 rounded-lg px-3 py-2">
                  <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                  Nominal thickness must be greater than 0 mm.
                </div>
              )}

              {/* Actions */}
              {sourceChoice !== null && (
                <div className="flex gap-3">
                  {sourceChoice === "centerline" ? (
                    <button
                      onClick={handleConvert}
                      disabled={converting || nomThk <= 0}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-bold text-black transition-all shadow-lg shadow-orange-500/20"
                    >
                      {converting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ChevronRight className="w-3.5 h-3.5" />}
                      Convert to Sheet Profile
                    </button>
                  ) : (
                    <button
                      onClick={handleUseAsSheet}
                      disabled={nomThk <= 0}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 disabled:opacity-40 text-sm font-bold text-white transition-all shadow-lg shadow-blue-500/20"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                      Use As-Is (Sheet Profile)
                    </button>
                  )}
                  <button onClick={onClose} className="px-4 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-sm text-zinc-400 transition-all">
                    Skip
                  </button>
                </div>
              )}
            </>
          ) : (
            /* Success state */
            <div className="space-y-4">
              <div className="flex flex-col items-center gap-3 py-4">
                <div className="w-12 h-12 rounded-2xl bg-green-500/10 border border-green-500/30 flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6 text-green-400" />
                </div>
                <div className="text-center">
                  <div className="text-sm font-bold text-white mb-1">Sheet Profile Generated</div>
                  <div className="text-xs text-zinc-400">Center line successfully expanded to full sheet geometry</div>
                </div>
              </div>

              {result && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-white/[0.03] border border-white/[0.07] p-3 text-center">
                    <div className="text-xl font-bold text-orange-400 font-mono">{result.bendCount}</div>
                    <div className="text-[10px] text-zinc-500 mt-0.5">Bends detected</div>
                  </div>
                  <div className="rounded-xl bg-white/[0.03] border border-white/[0.07] p-3 text-center">
                    <div className="text-xl font-bold text-blue-400 font-mono">{result.devLength.toFixed(1)}</div>
                    <div className="text-[10px] text-zinc-500 mt-0.5">Dev. length (mm)</div>
                  </div>
                </div>
              )}

              {result?.warnings && result.warnings.length > 0 && (
                <div className="rounded-xl bg-amber-950/30 border border-amber-700/30 p-3 space-y-1">
                  {result.warnings.map((w, i) => (
                    <div key={i} className="flex items-start gap-2 text-[11px] text-amber-300">
                      <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" />
                      {w}
                    </div>
                  ))}
                </div>
              )}

              <div className="rounded-xl bg-green-950/20 border border-green-700/20 p-3 text-[11px] text-green-300">
                ✓ Thickness set to {nomThk}mm &nbsp;·&nbsp; Min {minThk}mm &nbsp;·&nbsp; Max {maxThk}mm
                <br />
                ✓ Geometry normalized and ready for Station Config → Power Pattern
              </div>

              <button
                onClick={onClose}
                className="w-full px-4 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-sm font-bold text-black transition-all shadow-lg shadow-orange-500/20"
              >
                Continue to Station Config →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
