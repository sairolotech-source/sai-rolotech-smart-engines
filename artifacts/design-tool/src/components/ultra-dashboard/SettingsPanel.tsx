import React, { useState, useEffect, useCallback } from "react";
import { Save, RefreshCw, CheckCircle, Database, Loader2 } from "lucide-react";
import { authFetch, getApiUrl } from "../../lib/auth-fetch";

interface UserSettings {
  language: string;
  responseStyle: string;
  accuracyMode: string;
  memoryEnabled: boolean;
  forceOffline: boolean;
  backupIntervalSeconds: number;
}

function Toggle({
  label, desc, value, onChange,
}: {
  label: string; desc?: string; value: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-white/[0.05]">
      <div>
        <p className="text-sm text-zinc-200 font-medium">{label}</p>
        {desc && <p className="text-[11px] text-zinc-600 mt-0.5">{desc}</p>}
      </div>
      <button
        onClick={() => onChange(!value)}
        className={`w-10 h-5.5 rounded-full transition-colors relative flex-shrink-0 ${value ? "bg-blue-600" : "bg-zinc-700"}`}
        style={{ height: "22px", width: "40px" }}
      >
        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${value ? "translate-x-5" : "translate-x-0.5"}`} />
      </button>
    </div>
  );
}

function SelectField({
  label, desc, value, onChange, options,
}: {
  label: string; desc?: string; value: string;
  onChange: (v: string) => void; options: { value: string; label: string }[];
}) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-white/[0.05]">
      <div>
        <p className="text-sm text-zinc-200 font-medium">{label}</p>
        {desc && <p className="text-[11px] text-zinc-600 mt-0.5">{desc}</p>}
      </div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-white/[0.06] border border-white/[0.10] rounded-lg px-2.5 py-1.5
                   text-[12px] text-zinc-200 focus:outline-none focus:border-blue-500/40 transition-colors"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-[#151525]">
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function SettingsPanel() {
  const [settings, setSettings] = useState<UserSettings>({
    language: "english",
    responseStyle: "detailed",
    accuracyMode: "high",
    memoryEnabled: true,
    forceOffline: false,
    backupIntervalSeconds: 60,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [backups, setBackups] = useState<{ name: string; created: string; size: number }[]>([]);
  const [backupLoading, setBackupLoading] = useState(false);
  const [backupMsg, setBackupMsg] = useState<string | null>(null);

  const loadSettings = useCallback(async () => {
    try {
      const r = await authFetch(getApiUrl("/ai/settings"));
      const data = await r.json() as UserSettings;
      setSettings(data);
    } catch { /* ok */ }
    setLoading(false);
  }, []);

  const loadBackups = useCallback(async () => {
    try {
      const r = await authFetch(getApiUrl("/backup/list"));
      const data = await r.json() as { backups: { name: string; created: string; size: number }[] };
      setBackups(data.backups ?? []);
    } catch { /* ok */ }
  }, []);

  useEffect(() => {
    loadSettings();
    loadBackups();
  }, [loadSettings, loadBackups]);

  const saveSettings = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await authFetch(getApiUrl("/ai/settings"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch { /* ok */ }
    setSaving(false);
  };

  const createBackup = async () => {
    setBackupLoading(true);
    setBackupMsg(null);
    try {
      const r = await authFetch(getApiUrl("/backup/create"), { method: "POST" });
      const data = await r.json() as { success: boolean };
      if (data.success) {
        setBackupMsg("Backup created successfully");
        loadBackups();
      }
    } catch {
      setBackupMsg("Backup failed");
    }
    setBackupLoading(false);
    setTimeout(() => setBackupMsg(null), 4000);
  };

  const restoreBackup = async (name: string) => {
    if (!confirm(`Restore from backup "${name}"? This will overwrite current AI memory.`)) return;
    try {
      const r = await authFetch(getApiUrl("/backup/restore"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await r.json() as { success: boolean; message?: string };
      if (data.success) {
        setBackupMsg(data.message ?? "Restored");
      }
    } catch {
      setBackupMsg("Restore failed");
    }
    setTimeout(() => setBackupMsg(null), 4000);
  };

  const update = (patch: Partial<UserSettings>) => {
    setSettings((s) => ({ ...s, ...patch }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32 text-zinc-600 text-sm gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading settings…
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-4 overflow-y-auto max-h-full">

      {/* AI Behavior */}
      <section>
        <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">AI Behavior</h4>
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl px-4">
          <SelectField
            label="Response Language"
            desc="Language for AI replies"
            value={settings.language}
            onChange={(v) => update({ language: v })}
            options={[
              { value: "english", label: "English" },
              { value: "urdu", label: "Urdu (اردو)" },
              { value: "hindi", label: "Hindi (हिंदी)" },
            ]}
          />
          <SelectField
            label="Response Style"
            desc="How detailed should AI answers be"
            value={settings.responseStyle}
            onChange={(v) => update({ responseStyle: v })}
            options={[
              { value: "concise", label: "Concise" },
              { value: "detailed", label: "Detailed" },
            ]}
          />
          <SelectField
            label="Accuracy Mode"
            desc="Balance between speed and accuracy"
            value={settings.accuracyMode}
            onChange={(v) => update({ accuracyMode: v })}
            options={[
              { value: "high", label: "High Accuracy" },
              { value: "fast", label: "Fast Response" },
            ]}
          />
          <Toggle
            label="Enable AI Memory"
            desc="Save conversations persistently to disk"
            value={settings.memoryEnabled}
            onChange={(v) => update({ memoryEnabled: v })}
          />
          <Toggle
            label="Force Offline Mode"
            desc="Always use offline AI, even when internet is available"
            value={settings.forceOffline}
            onChange={(v) => update({ forceOffline: v })}
          />
          <div className="flex items-center justify-between py-3">
            <div>
              <p className="text-sm text-zinc-200 font-medium">Backup Interval</p>
              <p className="text-[11px] text-zinc-600 mt-0.5">How often to auto-save AI memory (seconds)</p>
            </div>
            <input
              type="number"
              min={10}
              max={3600}
              value={settings.backupIntervalSeconds}
              onChange={(e) => update({ backupIntervalSeconds: parseInt(e.target.value) || 60 })}
              className="w-20 bg-white/[0.06] border border-white/[0.10] rounded-lg px-2.5 py-1.5
                         text-[12px] text-zinc-200 text-center focus:outline-none focus:border-blue-500/40"
            />
          </div>
        </div>
      </section>

      {/* Save button */}
      <button
        onClick={saveSettings}
        disabled={saving}
        className="flex items-center justify-center gap-2 py-2.5 rounded-xl
                   bg-blue-600/80 border border-blue-500/40 text-sm font-medium text-white
                   hover:bg-blue-600 disabled:opacity-50 transition-colors"
      >
        {saving ? (
          <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
        ) : saved ? (
          <><CheckCircle className="w-4 h-4 text-emerald-400" /> Saved!</>
        ) : (
          <><Save className="w-4 h-4" /> Save Settings</>
        )}
      </button>

      {/* Backup & Restore */}
      <section>
        <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Backup & Restore</h4>
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-zinc-300">AI Memory Backups</p>
            <button
              onClick={createBackup}
              disabled={backupLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium
                         text-emerald-400 bg-emerald-500/10 border border-emerald-500/20
                         hover:bg-emerald-500/20 disabled:opacity-50 transition-colors"
            >
              {backupLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Database className="w-3 h-3" />}
              Create Backup Now
            </button>
          </div>
          {backupMsg && (
            <p className="text-[11px] text-emerald-400 bg-emerald-500/10 px-3 py-2 rounded-lg">{backupMsg}</p>
          )}
          {backups.length === 0 && (
            <p className="text-[11px] text-zinc-600">No backups yet. Auto-backup runs every {settings.backupIntervalSeconds}s.</p>
          )}
          <div className="flex flex-col gap-1.5">
            {backups.slice(0, 8).map((b) => (
              <div key={b.name} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                <Database className="w-3 h-3 text-zinc-600 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] text-zinc-400 truncate">{b.name}</p>
                  <p className="text-[10px] text-zinc-700">{new Date(b.created).toLocaleString()}</p>
                </div>
                <button
                  onClick={() => restoreBackup(b.name)}
                  className="text-[10px] text-blue-400 hover:text-blue-300 transition-colors flex-shrink-0 flex items-center gap-1"
                >
                  <RefreshCw className="w-2.5 h-2.5" /> Restore
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
