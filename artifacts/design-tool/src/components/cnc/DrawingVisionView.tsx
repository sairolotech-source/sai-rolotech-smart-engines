import React, { useState, useRef, useCallback } from "react";
import { Eye, Upload, FileImage, Loader2, CheckCircle2, AlertTriangle, X, Brain, Copy, FileCode2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { getPersonalGeminiKey } from "@/hooks/usePersonalAIKey";

interface VisionResult {
  success: boolean;
  analysis: string;
  extractedData: {
    thickness?: number;
    width?: number;
    height?: number;
    innerRadius?: number;
    bendAngles?: number[];
    profileType?: string;
    estimatedStations?: number;
    [key: string]: unknown;
  };
  model: string;
  filename?: string;
  fileSize?: string;
  fileType?: "image" | "dxf";
}

const DRAWING_PROMPT = `Analyze this engineering drawing and extract all technical specifications:
## 1. Profile Type
## 2. Dimensions (mm) — width, height, flanges, web
## 3. Bend Angles (°) — list each
## 4. Inner Radii (mm)
## 5. Material Thickness (mm)
## 6. Tolerances
## 7. Roll Forming Assessment — suitable? estimated stations?
## 8. Special Notes`;

function isDxfFile(f: File): boolean {
  return f.name.toLowerCase().endsWith(".dxf") ||
    f.type === "application/dxf" ||
    f.type === "application/octet-stream";
}

export function DrawingVisionView() {
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isDxf, setIsDxf] = useState(false);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VisionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((f: File) => {
    const isImage = f.type.startsWith("image/");
    const dxf = isDxfFile(f);

    if (!isImage && !dxf) {
      toast({ title: "Galat File", description: "JPG, PNG, WebP image ya .DXF CAD file upload karein", variant: "destructive" });
      return;
    }

    setFile(f);
    setIsDxf(dxf);
    setResult(null);
    setError(null);

    if (isImage) {
      const reader = new FileReader();
      reader.onload = e => setPreview(e.target?.result as string);
      reader.readAsDataURL(f);
    } else {
      setPreview(null);
    }
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  };

  const analyzeViaServer = async (f: File, q: string): Promise<VisionResult> => {
    const formData = new FormData();
    formData.append("image", f);
    if (q.trim()) formData.append("question", q.trim());
    const token = localStorage.getItem("cnc_token") ?? "";
    const res = await fetch("/api/drawing-vision/analyze", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    const data = await res.json() as VisionResult & { error?: string };
    if (!res.ok || !data.success) throw new Error(data.error ?? "Server analysis failed");
    return data;
  };

  const analyzeViaBrowser = async (f: File, q: string): Promise<VisionResult> => {
    const personalKey = getPersonalGeminiKey();
    if (!personalKey) throw new Error("Koi API key nahi — pehle 'AI Key' button se apni Gemini key daalo. DXF files sirf server se analyze hoti hain.");
    if (isDxfFile(f)) throw new Error("DXF files sirf server se analyze hoti hain — server connection check karein");

    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => {
        const result = (e.target?.result as string).split(",")[1];
        if (result) resolve(result); else reject(new Error("File read failed"));
      };
      reader.onerror = () => reject(new Error("File read error"));
      reader.readAsDataURL(f);
    });

    const prompt = q.trim() || DRAWING_PROMPT;
    const body = {
      system_instruction: { parts: [{ text: "You are a senior roll forming and CNC engineering expert. Analyze technical drawings and extract all specifications precisely." }] },
      contents: [{ role: "user", parts: [{ inline_data: { mime_type: f.type, data: base64 } }, { text: prompt }] }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 2048 },
    };

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${personalKey}`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(30000) }
    );

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Gemini error ${res.status}: ${errText.slice(0, 150)}`);
    }

    const data = await res.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    const extractedData: Record<string, unknown> = {};
    const thicknessMatch = text.match(/thickness[:\s*]+([0-9.]+)\s*mm/i);
    if (thicknessMatch) extractedData["thickness"] = parseFloat(thicknessMatch[1]!);
    const widthMatch = text.match(/(?:total\s+)?width[:\s*]+([0-9.]+)\s*mm/i);
    if (widthMatch) extractedData["width"] = parseFloat(widthMatch[1]!);
    const angles: number[] = [];
    for (const m of text.matchAll(/(\d+(?:\.\d+)?)\s*°/g)) angles.push(parseFloat(m[1]!));
    if (angles.length) extractedData["bendAngles"] = angles;
    const profileMatch = text.match(/(C-channel|Z-section|U-channel|hat section|angle|omega|sigma)/i);
    if (profileMatch) extractedData["profileType"] = profileMatch[1];
    const stationsMatch = text.match(/(\d+)\s*station/i);
    if (stationsMatch) extractedData["estimatedStations"] = parseInt(stationsMatch[1]!);

    return { success: true, analysis: text, extractedData, model: "Gemini 2.5 Pro Vision (Personal Key)", filename: f.name, fileSize: `${(f.size / 1024).toFixed(1)} KB`, fileType: "image" };
  };

  const analyze = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      let data: VisionResult;
      try {
        data = await analyzeViaServer(file, question);
      } catch (serverErr) {
        if (isDxfFile(file)) throw serverErr;
        data = await analyzeViaBrowser(file, question);
      }
      setResult(data);
      toast({ title: "Analysis Complete ✅", description: `${data.fileType === "dxf" ? "DXF" : "Drawing"} analyze ho gayi — Gemini ne dimensions nikale!` });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Analysis failed";
      setError(msg);
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const copyResult = () => {
    if (result?.analysis) {
      navigator.clipboard.writeText(result.analysis);
      toast({ title: "Copied", description: "Analysis clipboard mein copy ho gayi" });
    }
  };

  const clear = () => {
    setFile(null);
    setPreview(null);
    setIsDxf(false);
    setResult(null);
    setError(null);
    setQuestion("");
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div className="flex flex-col h-full bg-[#0a0a0f] text-white overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10 bg-[#0d0d14]">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
          <Eye className="w-4 h-4 text-white" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-white">Drawing Vision — Gemini 2.5 Pro + Codex 5.3</h2>
          <p className="text-[10px] text-white/50">Image ya DXF upload karein — AI dimensions, angles, profile type nikaale ga</p>
        </div>
        <div className="ml-auto flex items-center gap-1.5 px-2 py-1 rounded-full bg-violet-500/10 border border-violet-500/20">
          <Brain className="w-3 h-3 text-violet-400" />
          <span className="text-[10px] text-violet-300 font-medium">Gemini 2.5 Pro</span>
        </div>
      </div>

      <div className="flex flex-1 gap-4 p-4 overflow-hidden">
        <div className="flex flex-col gap-4 w-[380px] flex-shrink-0">

          <div
            className={`relative border-2 border-dashed rounded-xl transition-all cursor-pointer
              ${dragging ? "border-violet-500 bg-violet-500/10" : "border-white/10 bg-white/2 hover:border-white/20"}
              ${(preview || (file && isDxf)) ? "border-solid border-white/10" : ""}`}
            style={{ minHeight: 220 }}
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => !file && fileRef.current?.click()}
          >
            {preview ? (
              <div className="relative">
                <img src={preview} alt="Drawing preview" className="w-full rounded-xl object-contain max-h-60" />
                <button
                  onClick={e => { e.stopPropagation(); clear(); }}
                  className="absolute top-2 right-2 w-6 h-6 rounded-full bg-red-500/80 flex items-center justify-center hover:bg-red-500 transition-colors"
                >
                  <X className="w-3 h-3 text-white" />
                </button>
                {file && (
                  <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-black/60 text-[10px] text-white/70">
                    {file.name} — {(file.size / 1024).toFixed(1)} KB
                  </div>
                )}
              </div>
            ) : file && isDxf ? (
              <div className="flex flex-col items-center justify-center py-10 gap-3">
                <div className="w-14 h-14 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                  <FileCode2 className="w-7 h-7 text-blue-400" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-blue-300">{file.name}</p>
                  <p className="text-[10px] text-white/40 mt-1">{(file.size / 1024).toFixed(1)} KB — DXF CAD File</p>
                  <p className="text-[10px] text-emerald-400 mt-1">✓ Python engine se parse hogi → Gemini analyze karega</p>
                </div>
                <button
                  onClick={e => { e.stopPropagation(); clear(); }}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400 hover:bg-red-500/20 transition-colors"
                >
                  <X className="w-3 h-3" /> File Hatao
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 gap-3">
                <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center">
                  <FileImage className="w-6 h-6 text-white/30" />
                </div>
                <div className="text-center">
                  <p className="text-sm text-white/50">Drawing yahan drop karein</p>
                  <p className="text-[10px] text-white/30 mt-1">JPG, PNG, WebP image — ya .DXF CAD file</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="px-2 py-0.5 rounded bg-violet-500/10 border border-violet-500/20 text-[10px] text-violet-300">PNG/JPG → Vision AI</div>
                  <div className="px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 text-[10px] text-blue-300">DXF → Python Parse</div>
                </div>
                <button className="px-4 py-1.5 rounded-lg bg-violet-600/80 hover:bg-violet-600 text-xs font-medium text-white transition-colors flex items-center gap-1.5">
                  <Upload className="w-3 h-3" /> File Choose Karein
                </button>
              </div>
            )}
          </div>

          <input ref={fileRef} type="file" accept="image/*,.dxf,application/dxf" className="hidden" onChange={onFileChange} />

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] text-white/50 font-medium">Custom Sawaal (Optional)</label>
            <textarea
              value={question}
              onChange={e => setQuestion(e.target.value)}
              placeholder="Koi specific sawaal? Jaise: 'Bend radius kya hai?' ya 'Roll forming ke liye suitable hai?'"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white/80 placeholder:text-white/20 resize-none focus:outline-none focus:border-violet-500/50 transition-colors"
              rows={3}
            />
          </div>

          <button
            onClick={analyze}
            disabled={!file || loading}
            className="w-full py-2.5 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2
              disabled:opacity-40 disabled:cursor-not-allowed
              bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500
              shadow-lg shadow-violet-900/30 text-white"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {isDxf ? "Python parse kar raha hai... Gemini analyze karega..." : "Gemini Pro Analyze Kar Raha Hai..."}
              </>
            ) : (
              <>
                <Eye className="w-4 h-4" />
                {isDxf ? "DXF Analyze Karo (Python + Gemini)" : "Drawing Analyze Karo"}
              </>
            )}
          </button>

          {result?.extractedData && Object.keys(result.extractedData).length > 0 && (
            <div className="rounded-xl border border-white/10 bg-white/3 p-3 flex flex-col gap-2">
              <p className="text-[11px] font-semibold text-white/60 uppercase tracking-wider">
                Extracted Dimensions
                {result.fileType === "dxf" && <span className="ml-2 text-blue-400 normal-case">DXF</span>}
              </p>
              {result.extractedData.profileType && (
                <div className="flex justify-between items-center">
                  <span className="text-[11px] text-white/50">Profile Type</span>
                  <span className="text-[11px] font-semibold text-violet-300">{String(result.extractedData.profileType)}</span>
                </div>
              )}
              {result.extractedData.thickness && (
                <div className="flex justify-between items-center">
                  <span className="text-[11px] text-white/50">Thickness</span>
                  <span className="text-[11px] font-semibold text-emerald-300">{String(result.extractedData.thickness)} mm</span>
                </div>
              )}
              {result.extractedData.width && (
                <div className="flex justify-between items-center">
                  <span className="text-[11px] text-white/50">Width</span>
                  <span className="text-[11px] font-semibold text-cyan-300">{String(result.extractedData.width)} mm</span>
                </div>
              )}
              {result.extractedData.height && (
                <div className="flex justify-between items-center">
                  <span className="text-[11px] text-white/50">Height</span>
                  <span className="text-[11px] font-semibold text-cyan-300">{String(result.extractedData.height)} mm</span>
                </div>
              )}
              {result.extractedData.innerRadius && (
                <div className="flex justify-between items-center">
                  <span className="text-[11px] text-white/50">Inner Radius</span>
                  <span className="text-[11px] font-semibold text-orange-300">{String(result.extractedData.innerRadius)} mm</span>
                </div>
              )}
              {result.extractedData.estimatedStations && (
                <div className="flex justify-between items-center">
                  <span className="text-[11px] text-white/50">Est. Stations</span>
                  <span className="text-[11px] font-semibold text-amber-300">{String(result.extractedData.estimatedStations)}</span>
                </div>
              )}
              {result.extractedData.bendAngles && Array.isArray(result.extractedData.bendAngles) && (
                <div className="flex justify-between items-start">
                  <span className="text-[11px] text-white/50">Bend Angles</span>
                  <span className="text-[11px] font-semibold text-blue-300 text-right">
                    {(result.extractedData.bendAngles as number[]).join("°, ")}°
                  </span>
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-3 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-300">{error}</p>
            </div>
          )}
        </div>

        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {result ? (
            <div className="flex flex-col h-full">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span className="text-sm font-semibold text-white">Analysis Result</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-300">
                    {result.model}
                  </span>
                  {result.fileType === "dxf" && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-300">
                      DXF → Python → Gemini
                    </span>
                  )}
                </div>
                <button
                  onClick={copyResult}
                  className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-white/60 hover:text-white transition-colors"
                >
                  <Copy className="w-3 h-3" /> Copy
                </button>
              </div>
              <div className="flex-1 overflow-y-auto rounded-xl border border-white/10 bg-white/2 p-4">
                <pre className="text-xs text-white/80 whitespace-pre-wrap font-sans leading-relaxed">
                  {result.analysis}
                </pre>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
              <div className="w-16 h-16 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
                <Eye className="w-8 h-8 text-violet-400/50" />
              </div>
              <div>
                <p className="text-sm font-medium text-white/40">Drawing ya DXF upload karein</p>
                <p className="text-xs text-white/25 mt-1">Gemini 2.5 Pro + SAI Codex 5.3 drawing ko analyze karke saari specifications nikalenge</p>
              </div>
              <div className="grid grid-cols-2 gap-3 mt-2 max-w-sm">
                {[
                  { icon: "📐", text: "Dimensions nikaale (mm)" },
                  { icon: "🔄", text: "Bend angles detect kare" },
                  { icon: "📏", text: "Material thickness bataye" },
                  { icon: "🏭", text: "Roll forming suitability" },
                  { icon: "📁", text: "DXF CAD file support" },
                  { icon: "🐍", text: "Python se DXF parse" },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/3 border border-white/5">
                    <span className="text-base">{item.icon}</span>
                    <span className="text-[11px] text-white/40">{item.text}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
