import React, { useState, useMemo } from "react";
import {
  FolderOpen, Search, FileText, Image, File, ChevronRight,
  ChevronDown, Clock, Star, Filter, Grid, List, FolderTree
} from "lucide-react";

interface ProjectFile {
  id: string;
  name: string;
  type: "project" | "drawing" | "rollset" | "gcode" | "report" | "dxf" | "step";
  profile: string;
  material: string;
  thickness: number;
  stations: number;
  modified: string;
  size: string;
  starred: boolean;
  path: string;
  tags: string[];
}

function generateProjectFiles(): ProjectFile[] {
  const profiles = ["C-Channel 100x50x2", "Z-Purlin 150x65x1.5", "Hat Section 80x40x1.2", "U-Channel 75x38x1.6", "Angle 50x50x3", "Guardrail W-Beam", "Trapezoidal Sheet T35", "Box Section 40x40x2"];
  const materials = ["GI", "CR", "SS 304", "AL 6061"];
  const types: ProjectFile["type"][] = ["project", "drawing", "rollset", "gcode", "report", "dxf", "step"];

  const files: ProjectFile[] = [];
  let id = 1;

  profiles.forEach(profile => {
    const mat = materials[id % materials.length];
    const t = parseFloat(profile.match(/x([\d.]+)$/)?.[1] || "1.5");
    const stations = 8 + (id % 8);

    types.forEach(type => {
      const ext = type === "project" ? ".cprf" : type === "drawing" ? ".dwg" : type === "rollset" ? ".cprs" : type === "gcode" ? ".nc" : type === "report" ? ".pdf" : type === "dxf" ? ".dxf" : ".step";
      files.push({
        id: `F-${id.toString().padStart(4, "0")}`,
        name: `${profile.split(" ")[0]}_${type}${ext}`,
        type,
        profile,
        material: mat,
        thickness: t,
        stations,
        modified: `2025-${(1 + (id % 12)).toString().padStart(2, "0")}-${(1 + (id % 28)).toString().padStart(2, "0")}`,
        size: `${(Math.random() * 10 + 0.1).toFixed(1)} MB`,
        starred: id % 5 === 0,
        path: `/projects/${profile.split(" ")[0]}/${type}`,
        tags: [mat, `${t}mm`, `${stations}stn`],
      });
      id++;
    });
  });

  return files;
}

export function CADFinderView() {
  const [files] = useState(() => generateProjectFiles());
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(["all"]));

  const filtered = useMemo(() => {
    let result = files;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(f =>
        f.name.toLowerCase().includes(q) ||
        f.profile.toLowerCase().includes(q) ||
        f.material.toLowerCase().includes(q) ||
        f.tags.some(t => t.toLowerCase().includes(q))
      );
    }
    if (filterType !== "all") result = result.filter(f => f.type === filterType);
    return result;
  }, [files, searchQuery, filterType]);

  const selected = files.find(f => f.id === selectedId);

  const grouped = useMemo(() => {
    const groups: Record<string, ProjectFile[]> = {};
    filtered.forEach(f => {
      const key = f.profile;
      if (!groups[key]) groups[key] = [];
      groups[key].push(f);
    });
    return groups;
  }, [filtered]);

  const toggleFolder = (key: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const typeIcon = (t: string) => {
    switch (t) {
      case "project": return <FolderOpen className="w-3 h-3 text-amber-400" />;
      case "drawing": return <Image className="w-3 h-3 text-blue-400" />;
      case "rollset": return <File className="w-3 h-3 text-purple-400" />;
      case "gcode": return <FileText className="w-3 h-3 text-green-400" />;
      case "report": return <FileText className="w-3 h-3 text-red-400" />;
      case "dxf": return <File className="w-3 h-3 text-cyan-400" />;
      case "step": return <File className="w-3 h-3 text-orange-400" />;
      default: return <File className="w-3 h-3 text-zinc-400" />;
    }
  };

  const typeColor = (t: string) =>
    t === "project" ? "bg-amber-500/10 text-amber-400" :
    t === "drawing" ? "bg-blue-500/10 text-blue-400" :
    t === "rollset" ? "bg-purple-500/10 text-purple-400" :
    t === "gcode" ? "bg-green-500/10 text-green-400" :
    t === "report" ? "bg-red-500/10 text-red-400" :
    t === "dxf" ? "bg-cyan-500/10 text-cyan-400" :
    "bg-orange-500/10 text-orange-400";

  return (
    <div className="flex flex-col h-full bg-[#08081a] text-zinc-200">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.06] bg-gradient-to-r from-amber-500/5 to-transparent">
        <FolderTree className="w-5 h-5 text-amber-400" />
        <div>
          <div className="text-sm font-bold text-zinc-100">FormAxis CADFinder</div>
          <div className="text-[10px] text-zinc-500">Integrated Document Management & Project Navigation</div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-[9px] px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400">
            {filtered.length} Files
          </span>
          <span className="text-[9px] px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 text-blue-400">
            {Object.keys(grouped).length} Projects
          </span>
        </div>
      </div>

      <div className="px-4 py-2 border-b border-white/[0.06] bg-white/[0.01] flex items-center gap-3">
        <div className="flex items-center gap-1 flex-1">
          <Search className="w-3.5 h-3.5 text-zinc-500" />
          <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search files, profiles, materials..."
            className="flex-1 bg-transparent border-none outline-none text-[11px] text-zinc-200 placeholder-zinc-600" />
        </div>
        <select value={filterType} onChange={e => setFilterType(e.target.value)}
          className="bg-black/30 border border-white/[0.08] rounded px-2 py-0.5 text-[10px] text-zinc-300">
          <option value="all">All Types</option>
          <option value="project">Projects</option>
          <option value="drawing">Drawings</option>
          <option value="rollset">Roll Sets</option>
          <option value="gcode">G-Code</option>
          <option value="report">Reports</option>
          <option value="dxf">DXF</option>
          <option value="step">STEP</option>
        </select>
        <div className="flex gap-0.5">
          <button onClick={() => setViewMode("list")}
            className={`p-1 rounded ${viewMode === "list" ? "bg-white/[0.08] text-zinc-200" : "text-zinc-500"}`}>
            <List className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => setViewMode("grid")}
            className={`p-1 rounded ${viewMode === "grid" ? "bg-white/[0.08] text-zinc-200" : "text-zinc-500"}`}>
            <Grid className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-y-auto p-3">
          {viewMode === "list" ? (
            <div className="space-y-1">
              {Object.entries(grouped).map(([profile, profileFiles]) => (
                <div key={profile} className="border border-white/[0.04] rounded-lg overflow-hidden">
                  <button onClick={() => toggleFolder(profile)}
                    className="w-full flex items-center gap-2 px-3 py-2 bg-white/[0.02] hover:bg-white/[0.04]">
                    {expandedFolders.has(profile) ? <ChevronDown className="w-3 h-3 text-zinc-500" /> : <ChevronRight className="w-3 h-3 text-zinc-500" />}
                    <FolderOpen className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-[11px] font-semibold text-zinc-300 flex-1 text-left">{profile}</span>
                    <span className="text-[9px] text-zinc-600">{profileFiles.length} files</span>
                  </button>
                  {expandedFolders.has(profile) && (
                    <div className="bg-[#0a0a15]">
                      {profileFiles.map(f => (
                        <div key={f.id}
                          onClick={() => setSelectedId(f.id)}
                          className={`flex items-center gap-2 px-4 py-1.5 cursor-pointer border-t border-white/[0.03] ${
                            selectedId === f.id ? "bg-amber-500/10" : "hover:bg-white/[0.02]"}`}>
                          {typeIcon(f.type)}
                          <span className="text-[10px] text-zinc-300 flex-1">{f.name}</span>
                          {f.starred && <Star className="w-3 h-3 text-amber-400 fill-amber-400" />}
                          <span className={`text-[8px] px-1 py-0.5 rounded ${typeColor(f.type)}`}>{f.type}</span>
                          <span className="text-[9px] text-zinc-600">{f.size}</span>
                          <span className="text-[9px] text-zinc-600">{f.modified}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-2">
              {filtered.map(f => (
                <div key={f.id}
                  onClick={() => setSelectedId(f.id)}
                  className={`p-3 rounded-lg border cursor-pointer ${
                    selectedId === f.id ? "bg-amber-500/10 border-amber-500/20" : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]"}`}>
                  <div className="flex items-center gap-2 mb-2">
                    {typeIcon(f.type)}
                    {f.starred && <Star className="w-3 h-3 text-amber-400 fill-amber-400" />}
                  </div>
                  <div className="text-[10px] text-zinc-300 font-medium truncate">{f.name}</div>
                  <div className="text-[9px] text-zinc-600 mt-1">{f.profile}</div>
                  <div className="flex items-center gap-1 mt-1">
                    <span className={`text-[8px] px-1 py-0.5 rounded ${typeColor(f.type)}`}>{f.type}</span>
                    <span className="text-[8px] text-zinc-600">{f.size}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {selected && (
          <div className="w-[260px] flex-shrink-0 border-l border-white/[0.06] p-3 overflow-y-auto bg-[#0a0a18]">
            <div className="text-[11px] font-bold text-zinc-400 mb-3 flex items-center gap-2">
              {typeIcon(selected.type)}
              File Detail
            </div>
            <div className="space-y-1 text-[10px]">
              {[
                { label: "Filename", value: selected.name },
                { label: "Type", value: selected.type },
                { label: "Profile", value: selected.profile },
                { label: "Material", value: selected.material },
                { label: "Thickness", value: `${selected.thickness}mm` },
                { label: "Stations", value: selected.stations },
                { label: "Path", value: selected.path },
                { label: "Size", value: selected.size },
                { label: "Modified", value: selected.modified },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between">
                  <span className="text-zinc-500">{label}</span>
                  <span className="text-zinc-300 text-right max-w-[140px] truncate">{String(value)}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-1">
              {selected.tags.map(tag => (
                <span key={tag} className="text-[8px] px-1.5 py-0.5 rounded bg-white/[0.05] text-zinc-400 border border-white/[0.06]">{tag}</span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
