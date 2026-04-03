import React, { useState, useEffect, useCallback } from "react";
import { useCncStore, MATERIAL_DATABASE } from "../../store/useCncStore";
import { useAuthStore } from "../../store/useAuthStore";
import { saveProject, listProjects, deleteProject, backupProjectToDrive, saveJobPackage } from "../../lib/api";
import { X, Save, Trash2, FolderOpen, Plus, RefreshCw, Cloud, HardDrive, FolderTree } from "lucide-react";
import { buildFolderTree, sanitizeJobFolderName } from "./JobPackageExport";

const AUTO_BACKUP_KEY = "roll_form_ai_drive_auto_backup";

interface SavedProject {
  id: string;
  projectName: string;
  material: string;
  thickness: string;
  numStations: number;
  stationPrefix: string;
  lineSpeed: string;
  rollDiameter: string;
  shaftDiameter: string;
  clearance: string;
  profileName: string;
  fileName: string;
  createdAt: string;
  updatedAt: string;
}

interface SaveProjectModalProps {
  onClose: () => void;
}

export function SaveProjectModal({ onClose }: SaveProjectModalProps) {
  const {
    profileName, materialType, materialThickness, numStations, stationPrefix,
    lineSpeed, rollDiameter, shaftDiameter, clearance, fileName, geometry,
    stations, rollTooling, gcodeOutputs,
    setProfileName, setMaterialType, setMaterialThickness, setNumStations,
    setStationPrefix, setLineSpeed, setRollDiameter, setShaftDiameter, setClearance,
  } = useCncStore();
  const { user } = useAuthStore();

  const [tab, setTab] = useState<"save" | "load">("save");
  const [projectName, setProjectName] = useState(profileName || "");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [projects, setProjects] = useState<SavedProject[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [saveFilesToDisk, setSaveFilesToDisk] = useState(false);
  const [showFolderTree, setShowFolderTree] = useState(false);
  const [diskSaveResult, setDiskSaveResult] = useState<{ projectRoot?: string; fileCount?: number; error?: string } | null>(null);

  const fetchProjects = useCallback(async () => {
    setLoadingList(true);
    try {
      const res = await listProjects(user?.uid || "");
      setProjects(res.projects || []);
    } catch {
      setProjects([]);
    } finally {
      setLoadingList(false);
    }
  }, [user]);

  useEffect(() => {
    if (tab === "load") fetchProjects();
  }, [tab, fetchProjects]);

  const bendCount = geometry?.bendPoints?.length || 0;
  const totalBendAngle = geometry?.bendPoints?.reduce((s, bp) => s + Math.abs(bp.angle), 0) || 0;
  const matProps = MATERIAL_DATABASE[materialType];
  let suggestedPasses = bendCount * 2;
  if (materialThickness < 0.5) suggestedPasses += 1;
  if (materialType === "SS") suggestedPasses += 2;
  geometry?.bendPoints?.forEach(bp => {
    if (bp.radius > 0 && bp.radius < 1) suggestedPasses += 1;
    if (Math.abs(bp.angle) > 90) suggestedPasses += 1;
  });
  let riskLevel: string;
  if (bendCount >= 4) riskLevel = "high";
  else if (materialThickness < 0.4) riskLevel = "medium";
  else if (materialType === "SS") riskLevel = "high";
  else riskLevel = matProps?.crackingRisk || "low";

  const effectiveNumStations = Math.max(numStations, stations.length, rollTooling.length);
  const hasFileData = stations.length > 0 || rollTooling.length > 0 || gcodeOutputs.length > 0;

  const handleSave = async () => {
    if (!projectName.trim()) {
      setSaveMsg({ type: "err", text: "Project ka naam likho" });
      return;
    }
    setSaving(true);
    setSaveMsg(null);
    setDiskSaveResult(null);
    try {
      const bends = geometry?.bendPoints?.map((bp) => ({
        bend_angle: bp.angle,
        bend_radius: bp.radius,
        side: "left",
      })) || [];

      const result = await saveProject({
        projectName: projectName.trim(),
        material: materialType,
        thickness: materialThickness,
        numStations,
        stationPrefix,
        lineSpeed,
        rollDiameter,
        shaftDiameter,
        clearance,
        profileName: profileName || projectName.trim(),
        fileName: fileName || "",
        bends,
        analysis: bendCount > 0 ? {
          bendCount,
          suggestedPasses,
          riskLevel,
          totalBendAngle,
          notes: { material: materialType, notes: matProps.notes },
        } : null,
      });

      if (saveFilesToDisk && hasFileData) {
        try {
          const diskResult = await saveJobPackage({
            profileName: projectName.trim(),
            geometry: geometry ?? undefined,
            stations: stations.length > 0 ? (stations as unknown[]) : undefined,
            rollTooling: rollTooling.length > 0 ? (rollTooling as unknown as import("../../lib/api").RollToolingPayload[]) : undefined,
            gcodeOutputs: gcodeOutputs.length > 0 ? gcodeOutputs : undefined,
          });
          setDiskSaveResult({ projectRoot: diskResult.projectRoot, fileCount: diskResult.fileCount });
        } catch (diskErr) {
          setDiskSaveResult({ error: diskErr instanceof Error ? diskErr.message : "Disk save failed" });
        }
      }

      const isAutoBackup = (() => {
        try { return localStorage.getItem(AUTO_BACKUP_KEY) === "true"; } catch { return false; }
      })();

      if (isAutoBackup && result?.project?.id) {
        try {
          await backupProjectToDrive(result.project.id);
          setSaveMsg({ type: "ok", text: `✅ "${projectName.trim()}" saved & backed up to Google Drive!` });
        } catch {
          setSaveMsg({ type: "ok", text: `✅ "${projectName.trim()}" saved! (Drive backup failed — check Drive settings)` });
        }
      } else {
        setSaveMsg({ type: "ok", text: `✅ "${projectName.trim()}" successfully save ho gaya!` });
      }
    } catch (err: unknown) {
      setSaveMsg({ type: "err", text: err instanceof Error ? err.message : "Save failed" });
    } finally {
      setSaving(false);
    }
  };

  const handleLoad = (p: SavedProject) => {
    setProfileName(p.profileName || p.projectName);
    setMaterialType(p.material as Parameters<typeof setMaterialType>[0]);
    setMaterialThickness(parseFloat(p.thickness) || 1.0);
    setNumStations(p.numStations || 5);
    setStationPrefix(p.stationPrefix || "S");
    setLineSpeed(parseFloat(p.lineSpeed) || 20);
    setRollDiameter(parseFloat(p.rollDiameter) || 150);
    setShaftDiameter(parseFloat(p.shaftDiameter) || 40);
    setClearance(parseFloat(p.clearance) || 0.05);
    onClose();
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await deleteProject(id);
      setProjects((prev) => prev.filter((p) => p.id !== id));
    } catch { }
    setDeletingId(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 backdrop-blur-sm pt-10">
      <div className="w-full max-w-lg bg-zinc-950 border border-zinc-700 rounded-xl shadow-2xl flex flex-col" style={{ maxHeight: "85vh" }}>
        <div className="flex items-center justify-between p-4 border-b border-zinc-700 flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-green-700 rounded flex items-center justify-center">
              <Save className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm font-bold text-zinc-100">Projects — Save & Load</span>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex border-b border-zinc-700 flex-shrink-0">
          {(["save", "load"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 ${
                tab === t ? "text-white bg-zinc-800 border-b-2 border-blue-500" : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {t === "save" ? <><Plus className="w-3 h-3" /> Save New</> : <><FolderOpen className="w-3 h-3" /> Load Saved</>}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {tab === "save" && (
            <div className="space-y-4">
              <div>
                <label className="text-xs text-zinc-400 block mb-1">Project Name *</label>
                <input
                  type="text"
                  value={projectName}
                  onChange={(e) => { setProjectName(e.target.value); setDiskSaveResult(null); }}
                  placeholder="e.g. C-Purlin 1.5mm GI"
                  className="w-full bg-zinc-800 border border-zinc-600 rounded px-3 py-2 text-sm text-zinc-100 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="bg-zinc-800 rounded-lg border border-zinc-700 p-3 space-y-1.5 text-[11px] text-zinc-400">
                <div className="text-zinc-200 font-semibold text-xs mb-2">Current Settings (jo save honge)</div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                  <div className="flex justify-between"><span>Material:</span><strong className="text-white">{materialType}</strong></div>
                  <div className="flex justify-between"><span>Thickness:</span><strong className="text-white">{materialThickness} mm</strong></div>
                  <div className="flex justify-between"><span>Stations:</span><strong className="text-white">{numStations}</strong></div>
                  <div className="flex justify-between"><span>Roll Dia:</span><strong className="text-white">{rollDiameter} mm</strong></div>
                  <div className="flex justify-between"><span>Clearance:</span><strong className="text-white">{clearance} mm</strong></div>
                  <div className="flex justify-between"><span>Line Speed:</span><strong className="text-white">{lineSpeed} m/min</strong></div>
                  {bendCount > 0 && (
                    <>
                      <div className="flex justify-between"><span>Bends:</span><strong className="text-green-300">{bendCount}</strong></div>
                      <div className="flex justify-between"><span>Passes:</span><strong className="text-blue-300">{suggestedPasses}</strong></div>
                    </>
                  )}
                </div>
                {fileName && (
                  <div className="border-t border-zinc-700 pt-1.5 text-[10px] text-zinc-500">
                    📎 File: {fileName}
                  </div>
                )}
              </div>

              {hasFileData && (
                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={saveFilesToDisk}
                      onChange={(e) => { setSaveFilesToDisk(e.target.checked); setDiskSaveResult(null); }}
                      className="w-3.5 h-3.5 rounded border-zinc-600 bg-zinc-800 accent-emerald-500"
                    />
                    <div className="flex items-center gap-1.5">
                      <HardDrive className="w-3 h-3 text-emerald-400" />
                      <span className="text-[11px] text-zinc-300 group-hover:text-zinc-100 transition-colors">
                        Also save files to server disk (organized folders)
                      </span>
                    </div>
                  </label>

                  {saveFilesToDisk && projectName.trim() && (
                    <div className="space-y-1.5">
                      <button
                        onClick={() => setShowFolderTree(v => !v)}
                        className="flex items-center gap-1.5 text-[10px] text-blue-400 hover:text-blue-300 transition-colors"
                      >
                        <FolderTree className="w-3 h-3" />
                        {showFolderTree ? "Hide" : "Preview"} folder structure
                      </button>
                      {showFolderTree && (
                        <div className="bg-zinc-900 border border-zinc-700 rounded p-2 overflow-x-auto">
                          <pre className="text-[9px] font-mono text-emerald-300 whitespace-pre leading-relaxed">
                            {buildFolderTree(projectName.trim() || sanitizeJobFolderName(profileName || "roll-forming-job"), effectiveNumStations)}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}

                  {diskSaveResult && (
                    <div className={`text-[10px] rounded p-2 border ${diskSaveResult.error ? "bg-red-950/30 border-red-700/40 text-red-300" : "bg-emerald-950/30 border-emerald-700/40 text-emerald-300"}`}>
                      {diskSaveResult.error
                        ? `Disk save failed: ${diskSaveResult.error}`
                        : <>
                            {diskSaveResult.fileCount} files saved to:<br />
                            <span className="font-mono text-[9px] break-all">{diskSaveResult.projectRoot}</span>
                          </>
                      }
                    </div>
                  )}
                </div>
              )}

              {saveMsg && (
                <div className={`text-xs rounded p-2.5 border ${
                  saveMsg.type === "ok"
                    ? "bg-green-950 border-green-700 text-green-300"
                    : "bg-red-950 border-red-700 text-red-300"
                }`}>
                  {saveMsg.text}
                </div>
              )}

              <button
                onClick={handleSave}
                disabled={saving}
                className="w-full py-2.5 rounded bg-green-700 hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
              >
                {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {saving ? "Saving..." : "Database Mein Save Karo"}
              </button>
            </div>
          )}

          {tab === "load" && (
            <div className="space-y-2">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-zinc-400">Saved Projects ({projects.length})</span>
                <button onClick={fetchProjects} className="text-zinc-500 hover:text-zinc-300 transition-colors">
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingList ? "animate-spin" : ""}`} />
                </button>
              </div>

              {loadingList && (
                <div className="text-center py-8 text-zinc-500 text-sm">Loading...</div>
              )}

              {!loadingList && projects.length === 0 && (
                <div className="text-center py-8 text-zinc-500 text-sm">
                  <FolderOpen className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  Koi project save nahi hua abhi tak
                </div>
              )}

              {projects.map((p) => (
                <div key={p.id} className="bg-zinc-800 border border-zinc-700 rounded-lg p-3 hover:border-zinc-500 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-zinc-100 truncate">{p.projectName}</div>
                      <div className="text-[10px] text-zinc-400 mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
                        <span>📦 {p.material} · {p.thickness}mm</span>
                        <span>⚙ {p.numStations} stations</span>
                        <span>🔩 Ø{p.rollDiameter}mm</span>
                      </div>
                      <div className="text-[10px] text-zinc-600 mt-0.5">
                        {new Date(p.updatedAt || p.createdAt).toLocaleDateString("ur-PK", {
                          day: "2-digit", month: "short", year: "numeric"
                        })}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => handleLoad(p)}
                        className="px-2 py-1 text-[10px] rounded bg-blue-700 hover:bg-blue-600 text-white font-semibold transition-colors flex items-center gap-1"
                      >
                        <FolderOpen className="w-3 h-3" /> Load
                      </button>
                      <button
                        onClick={() => handleDelete(p.id)}
                        disabled={deletingId === p.id}
                        className="p-1 rounded text-red-500 hover:text-red-400 hover:bg-red-950 transition-colors disabled:opacity-50"
                      >
                        {deletingId === p.id
                          ? <RefreshCw className="w-3 h-3 animate-spin" />
                          : <Trash2 className="w-3 h-3" />}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
