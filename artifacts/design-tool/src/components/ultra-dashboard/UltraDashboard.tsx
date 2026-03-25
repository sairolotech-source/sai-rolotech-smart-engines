import React, { useState, useEffect, useRef } from "react";
import { Monitor, Brain, FolderOpen, Settings2, Wifi, WifiOff, Bell, Cpu, CircuitBoard, Shield } from "lucide-react";
import { SystemInfoPanel } from "./SystemInfoPanel";
import { AIChatPanel } from "./AIChatPanel";
import { FileManagerPanel } from "./FileManagerPanel";
import { SettingsPanel } from "./SettingsPanel";
import { OfflineAIPanel } from "./OfflineAIPanel";
import { HardwareMonitorPanel } from "./HardwareMonitorPanel";
import { WatchdogPanel } from "./WatchdogPanel";
import { useNetworkStatus } from "../../hooks/useNetworkStatus";

type DashTab = "system" | "hardware" | "chat" | "localai" | "files" | "settings" | "watchdog";

const DASH_TABS: { id: DashTab; label: string; icon: React.ReactNode }[] = [
  { id: "system",   label: "System Info", icon: <Monitor className="w-4 h-4" /> },
  { id: "hardware", label: "Hardware",    icon: <CircuitBoard className="w-4 h-4" /> },
  { id: "chat",     label: "AI Chat",     icon: <Brain className="w-4 h-4" /> },
  { id: "localai",  label: "Local AI",    icon: <Cpu className="w-4 h-4" /> },
  { id: "files",    label: "File Manager",icon: <FolderOpen className="w-4 h-4" /> },
  { id: "settings", label: "Settings",    icon: <Settings2 className="w-4 h-4" /> },
  { id: "watchdog", label: "Auto Sync",   icon: <Shield className="w-4 h-4" /> },
];

function NetworkBanner({ isOnline }: { isOnline: boolean }) {
  const [visible, setVisible] = useState(false);
  const prevOnline = useRef(isOnline);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (prevOnline.current !== isOnline) {
      setMsg(isOnline
        ? "Connection restored — switching to Online AI mode"
        : "Internet lost — AI automatically switched to Offline mode. No data lost.");
      setVisible(true);
      const t = setTimeout(() => setVisible(false), 5000);
      prevOnline.current = isOnline;
      return () => clearTimeout(t);
    }
    return undefined;
  }, [isOnline]);

  if (!visible) return null;

  return (
    <div className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-all ${
      isOnline
        ? "bg-emerald-500/15 border-b border-emerald-500/25 text-emerald-300"
        : "bg-amber-500/15 border-b border-amber-500/25 text-amber-300"
    }`}>
      <Bell className="w-3.5 h-3.5 flex-shrink-0" />
      {msg}
      <button onClick={() => setVisible(false)} className="ml-auto text-current opacity-60 hover:opacity-100">✕</button>
    </div>
  );
}

export function UltraDashboard() {
  const [activeTab, setActiveTab] = useState<DashTab>("system");
  const network = useNetworkStatus();

  return (
    <div className="flex flex-col h-full bg-[#07070F] text-zinc-100">
      <NetworkBanner isOnline={network.isOnline} />

      <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.06] flex-shrink-0">
        <div>
          <h2 className="text-base font-bold text-zinc-100 tracking-tight">Ultra AI Dashboard</h2>
          <p className="text-[11px] text-zinc-600 mt-0.5">All-in-one AI control center · hardware · system · chat · files</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold ${
            network.isOnline
              ? "bg-emerald-500/10 border border-emerald-500/25 text-emerald-400"
              : "bg-amber-500/12 border border-amber-500/30 text-amber-400 animate-pulse"
          }`}>
            {network.isOnline
              ? <><Wifi className="w-2.5 h-2.5" /> Online AI Active</>
              : <><WifiOff className="w-2.5 h-2.5" /> Offline AI Active</>}
          </span>
        </div>
      </div>

      <div className="flex gap-0.5 px-4 pt-3 border-b border-white/[0.06] flex-shrink-0 overflow-x-auto">
        {DASH_TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3.5 py-2 text-[12px] font-medium rounded-t-lg relative transition-colors whitespace-nowrap ${
                isActive
                  ? "text-blue-300 bg-white/[0.05]"
                  : "text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.03]"
              }`}
            >
              <span className={isActive ? "text-blue-400" : "text-zinc-600"}>{tab.icon}</span>
              {tab.label}
              {isActive && (
                <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-blue-500 rounded-full opacity-70" />
              )}
            </button>
          );
        })}
      </div>

      <div className="flex-1 overflow-hidden">
        {activeTab === "system" && (
          <div className="h-full overflow-y-auto p-5">
            <SystemInfoPanel />
          </div>
        )}
        {activeTab === "hardware" && (
          <div className="h-full overflow-y-auto p-5">
            <HardwareMonitorPanel />
          </div>
        )}
        {activeTab === "chat" && (
          <div className="h-full flex flex-col">
            <AIChatPanel />
          </div>
        )}
        {activeTab === "localai" && (
          <div className="h-full flex flex-col">
            <OfflineAIPanel />
          </div>
        )}
        {activeTab === "files" && (
          <div className="h-full flex flex-col">
            <FileManagerPanel />
          </div>
        )}
        {activeTab === "settings" && (
          <div className="h-full overflow-y-auto">
            <SettingsPanel />
          </div>
        )}
        {activeTab === "watchdog" && (
          <div className="h-full overflow-hidden">
            <WatchdogPanel />
          </div>
        )}
      </div>
    </div>
  );
}
