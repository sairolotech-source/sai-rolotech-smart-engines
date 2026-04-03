import React, { useState, useEffect, useCallback, useRef } from "react";
import { Folder, File, ChevronRight, Home, ArrowLeft, Eye, ExternalLink, Loader2, AlertCircle, Upload, CheckCircle } from "lucide-react";
import { authFetch, getApiUrl } from "../../lib/auth-fetch";

interface FileEntry {
  name: string;
  isDirectory: boolean;
  isFile: boolean;
  size: number;
  mtime: string;
  path: string;
}

interface DirListing {
  current: string;
  parent: string | null;
  items: FileEntry[];
}

function fmtSize(b: number): string {
  if (b >= 1e9) return `${(b / 1e9).toFixed(1)} GB`;
  if (b >= 1e6) return `${(b / 1e6).toFixed(1)} MB`;
  if (b >= 1e3) return `${(b / 1e3).toFixed(0)} KB`;
  return `${b} B`;
}

function Breadcrumbs({ path, onNavigate }: { path: string; onNavigate: (p: string) => void }) {
  const parts = path.split("/").filter(Boolean);
  return (
    <div className="flex items-center gap-1 text-[11px] flex-wrap">
      <button
        onClick={() => onNavigate("/")}
        className="text-zinc-500 hover:text-zinc-300 transition-colors flex items-center gap-0.5"
      >
        <Home className="w-3 h-3" />
      </button>
      {parts.map((part, i) => {
        const partPath = "/" + parts.slice(0, i + 1).join("/");
        return (
          <React.Fragment key={partPath}>
            <ChevronRight className="w-3 h-3 text-zinc-700" />
            <button
              onClick={() => onNavigate(partPath)}
              className={`transition-colors ${i === parts.length - 1 ? "text-zinc-300 font-medium" : "text-zinc-500 hover:text-zinc-300"}`}
            >
              {part}
            </button>
          </React.Fragment>
        );
      })}
    </div>
  );
}

export function FileManagerPanel() {
  const [listing, setListing] = useState<DirListing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [currentDir, setCurrentDir] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);

  const navigate = useCallback(async (dir: string) => {
    setLoading(true);
    setError(null);
    setPreviewContent(null);
    setPreviewFile(null);
    try {
      const r = await authFetch(getApiUrl(`/files/list?dir=${encodeURIComponent(dir)}`));
      const data = await r.json() as DirListing & { error?: string };
      if (data.error) {
        setError(data.error);
      } else {
        setListing(data);
        setCurrentDir(data.current);
      }
    } catch {
      setError("Failed to load directory");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    navigate("/home");
  }, [navigate]);

  const openPreview = async (entry: FileEntry) => {
    if (entry.isDirectory) {
      navigate(entry.path);
      return;
    }
    setPreviewLoading(true);
    setPreviewFile(entry.name);
    setPreviewContent(null);
    try {
      const r = await authFetch(getApiUrl(`/files/read?path=${encodeURIComponent(entry.path)}`));
      const data = await r.json() as { content: string; truncated: boolean };
      setPreviewContent(data.content);
    } catch {
      setPreviewContent("[Error reading file]");
    }
    setPreviewLoading(false);
  };

  const openWithSystem = async (entry: FileEntry) => {
    try {
      await authFetch(getApiUrl("/files/open"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filePath: entry.path }),
      });
    } catch { /* ok */ }
  };

  const uploadFiles = async (files: FileList | File[]) => {
    if (!currentDir || files.length === 0) return;
    setUploading(true);
    setUploadMsg(null);
    const formData = new FormData();
    Array.from(files).forEach((f) => formData.append("files", f));
    try {
      const r = await authFetch(getApiUrl(`/files/upload?dir=${encodeURIComponent(currentDir)}`), {
        method: "POST",
        body: formData,
      });
      const data = await r.json() as { success: boolean; count?: number; error?: string };
      if (data.success) {
        setUploadMsg({ text: `${data.count} file(s) uploaded`, ok: true });
        navigate(currentDir);
      } else {
        setUploadMsg({ text: data.error ?? "Upload failed", ok: false });
      }
    } catch {
      setUploadMsg({ text: "Upload failed", ok: false });
    }
    setUploading(false);
    setTimeout(() => setUploadMsg(null), 4000);
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setIsDragOver(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    dragCounter.current = 0;
    const { files } = e.dataTransfer;
    if (files.length > 0) {
      uploadFiles(files);
    }
  };

  return (
    <div
      className={`flex flex-col h-full gap-0 relative transition-colors ${isDragOver ? "bg-blue-500/5" : ""}`}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      {isDragOver && (
        <div className="absolute inset-0 z-50 flex items-center justify-center
                        bg-blue-500/10 border-2 border-dashed border-blue-500/50 rounded-lg pointer-events-none">
          <div className="flex flex-col items-center gap-2 text-blue-300">
            <Upload className="w-10 h-10" />
            <p className="text-sm font-semibold">Drop files to upload here</p>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.06] flex-shrink-0">
        <button
          onClick={() => listing?.parent && navigate(listing.parent)}
          disabled={!listing?.parent}
          className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.06] disabled:opacity-30 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        {listing && (
          <Breadcrumbs path={listing.current} onNavigate={navigate} />
        )}
        <div className="ml-auto flex items-center gap-2">
          {uploadMsg && (
            <span className={`flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full ${
              uploadMsg.ok
                ? "text-emerald-400 bg-emerald-500/10"
                : "text-red-400 bg-red-500/10"
            }`}>
              {uploadMsg.ok ? <CheckCircle className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
              {uploadMsg.text}
            </span>
          )}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || !currentDir}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium
                       text-blue-400 bg-blue-500/10 border border-blue-500/20
                       hover:bg-blue-500/20 disabled:opacity-40 transition-colors"
            title="Upload files (or drag & drop onto the file list)"
          >
            {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
            Upload
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => e.target.files && uploadFiles(e.target.files)}
          />
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* File List */}
        <div className="flex-1 overflow-y-auto p-3 min-h-0">
          {loading && (
            <div className="flex items-center justify-center h-32 text-zinc-600 text-sm gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading…
            </div>
          )}
          {error && !loading && (
            <div className="flex items-center justify-center h-32 text-red-400 text-sm gap-2">
              <AlertCircle className="w-4 h-4" /> {error}
            </div>
          )}
          {!loading && !error && listing && listing.items.length === 0 && (
            <div className="flex flex-col items-center justify-center h-32 text-zinc-600 text-sm gap-2">
              <p>Empty directory</p>
              <p className="text-[11px]">Drag & drop files here to upload</p>
            </div>
          )}
          {!loading && !error && listing && (
            <div className="grid gap-0.5">
              {listing.items.map((entry) => (
                <div
                  key={entry.path}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer
                    hover:bg-white/[0.05] transition-colors group
                    ${previewFile === entry.name ? "bg-blue-500/10 border border-blue-500/15" : "border border-transparent"}`}
                  onDoubleClick={() => entry.isDirectory ? navigate(entry.path) : openPreview(entry)}
                  onClick={() => !entry.isDirectory && openPreview(entry)}
                >
                  <div className={`w-6 h-6 flex items-center justify-center rounded flex-shrink-0 ${
                    entry.isDirectory ? "text-amber-400" : "text-zinc-500"
                  }`}>
                    {entry.isDirectory ? <Folder className="w-4 h-4" /> : <File className="w-4 h-4" />}
                  </div>
                  <span className={`flex-1 text-sm truncate ${entry.isDirectory ? "text-zinc-200 font-medium" : "text-zinc-400"}`}>
                    {entry.name}
                  </span>
                  {entry.isFile && (
                    <span className="text-[10px] text-zinc-700 hidden group-hover:inline">
                      {fmtSize(entry.size)}
                    </span>
                  )}
                  <div className="hidden group-hover:flex items-center gap-1">
                    {entry.isFile && (
                      <button
                        onClick={(e) => { e.stopPropagation(); openPreview(entry); }}
                        className="p-1 rounded text-zinc-600 hover:text-zinc-300 hover:bg-white/[0.08]"
                        title="Preview"
                      >
                        <Eye className="w-3 h-3" />
                      </button>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); openWithSystem(entry); }}
                      className="p-1 rounded text-zinc-600 hover:text-zinc-300 hover:bg-white/[0.08]"
                      title="Open with system"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Preview Pane */}
        {(previewFile || previewLoading) && (
          <div className="w-80 border-l border-white/[0.06] flex flex-col flex-shrink-0">
            <div className="px-3 py-2.5 border-b border-white/[0.06] flex items-center justify-between">
              <span className="text-[11px] font-medium text-zinc-400 truncate">{previewFile}</span>
              <button
                onClick={() => { setPreviewFile(null); setPreviewContent(null); }}
                className="text-zinc-700 hover:text-zinc-400 text-xs"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-auto p-3">
              {previewLoading && (
                <div className="flex items-center gap-2 text-zinc-600 text-sm">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…
                </div>
              )}
              {previewContent && (
                <pre className="text-[11px] text-zinc-400 whitespace-pre-wrap break-words font-mono leading-relaxed">
                  {previewContent}
                </pre>
              )}
            </div>
          </div>
        )}
      </div>

      {currentDir && (
        <div className="px-4 py-2 border-t border-white/[0.06] text-[10px] text-zinc-700 flex-shrink-0 truncate">
          {currentDir} · {listing?.items.length ?? 0} items · Drag & drop files to upload
        </div>
      )}
    </div>
  );
}
