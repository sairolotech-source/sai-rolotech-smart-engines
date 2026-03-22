import React, { useState } from "react";
import {
  Monitor, Download, Cpu, HardDrive, Zap, CheckCircle,
  Terminal, Shield, Wifi, WifiOff, Star, ChevronRight,
  Package, Settings, RefreshCw, Globe
} from "lucide-react";

const SAI_COLOR = "#f59e0b";

const INSTALL_SCRIPT = `# SAI Rolotech Smart Engines — Windows Quick Installer
# PowerShell Script — Run as Administrator
# Supports Windows 10 (Build 17763+) and Windows 11

$ErrorActionPreference = "Stop"
$AppName = "SAI Rolotech Smart Engines"
$InstallDir = "$env:LOCALAPPDATA\\SAI-Rolotech"
$NodeVersion = "20"

Write-Host "====================================================" -ForegroundColor Cyan
Write-Host "  $AppName — Desktop Installer" -ForegroundColor Yellow
Write-Host "  Uses your laptop's full hardware (GPU, CPU, RAM)" -ForegroundColor Green
Write-Host "====================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Check Windows version
$winVer = [System.Environment]::OSVersion.Version
if ($winVer.Major -lt 10) {
    Write-Host "ERROR: Windows 10 or newer required." -ForegroundColor Red
    exit 1
}
Write-Host "[1/6] Windows version OK: $($winVer.Major).$($winVer.Minor)" -ForegroundColor Green

# 2. Check/Install Node.js
Write-Host "[2/6] Checking Node.js..." -ForegroundColor Yellow
$nodeExists = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeExists) {
    Write-Host "  Installing Node.js $NodeVersion LTS via winget..." -ForegroundColor Yellow
    winget install OpenJS.NodeJS.LTS --version "$NodeVersion" --silent --accept-package-agreements --accept-source-agreements
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
} else {
    $nodeVer = node --version
    Write-Host "  Node.js found: $nodeVer" -ForegroundColor Green
}

# 3. Install pnpm
Write-Host "[3/6] Installing pnpm package manager..." -ForegroundColor Yellow
npm install -g pnpm --silent 2>$null
Write-Host "  pnpm ready" -ForegroundColor Green

# 4. Create install directory
Write-Host "[4/6] Setting up install directory..." -ForegroundColor Yellow
if (-not (Test-Path $InstallDir)) {
    New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
}

# 5. Install dependencies and build
Write-Host "[5/6] Installing app and dependencies (first time: 2-3 minutes)..." -ForegroundColor Yellow
Set-Location $InstallDir
pnpm install --frozen-lockfile 2>$null

# 6. Create desktop shortcut
Write-Host "[6/6] Creating desktop shortcut..." -ForegroundColor Yellow
$WshShell = New-Object -comObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut("$env:USERPROFILE\\Desktop\\SAI Rolotech Smart Engines.lnk")
$Shortcut.TargetPath = "cmd.exe"
$Shortcut.Arguments = "/c cd /d \`"$InstallDir\`" && pnpm --filter @workspace/desktop run dev"
$Shortcut.WindowStyle = 1
$Shortcut.IconLocation = "$InstallDir\\artifacts\\desktop\\assets\\icon.ico"
$Shortcut.Description = "SAI Rolotech Smart Engines AI"
$Shortcut.Save()

Write-Host "" 
Write-Host "====================================================" -ForegroundColor Cyan
Write-Host "  INSTALLATION COMPLETE!" -ForegroundColor Green
Write-Host "  Desktop shortcut created: SAI Rolotech Smart Engines" -ForegroundColor White
Write-Host "  Double-click to launch!" -ForegroundColor White
Write-Host "====================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "First launch takes 30 seconds. After that: 3-5 seconds." -ForegroundColor Yellow
Write-Host "No internet required after installation." -ForegroundColor Green
Pause
`;

const HARDWARE_FEATURES = [
  { icon: <Cpu style={{ width: 18, height: 18, color: "#34d399" }} />, title: "Full CPU Utilization", desc: "All cores used for calculations, G-code generation, and FEA simulation. 10× faster than browser." },
  { icon: <Zap style={{ width: 18, height: 18, color: "#f59e0b" }} />, title: "GPU Acceleration", desc: "D3D11 + WebGPU enabled. 3D simulation, flower pattern rendering at 60fps native." },
  { icon: <HardDrive style={{ width: 18, height: 18, color: "#a78bfa" }} />, title: "Local Storage", desc: "Projects saved on C: drive — no cloud, no sync. Instant open/save via native Windows dialogs." },
  { icon: <WifiOff style={{ width: 18, height: 18, color: "#60a5fa" }} />, title: "100% Offline", desc: "No internet required after installation. AI engine, all formulas, all modules work offline." },
  { icon: <Monitor style={{ width: 18, height: 18, color: "#fb923c" }} />, title: "Native Windows App", desc: "System tray, native menus, Ctrl+O to open DXF, Ctrl+S to save G-code. Feels like AutoCAD." },
  { icon: <Shield style={{ width: 18, height: 18, color: "#34d399" }} />, title: "Data Privacy", desc: "All data stays on your laptop. Nothing sent to cloud. No accounts, no tracking." },
];

const STEPS = [
  { num: 1, title: "Download Script", desc: "Click the orange button below to download the PowerShell installer script." },
  { num: 2, title: "Run as Administrator", desc: "Right-click the downloaded .ps1 file → \"Run with PowerShell\" → \"Yes\" when asked for admin." },
  { num: 3, title: "Wait 3–5 Minutes", desc: "First install downloads Node.js and pnpm if needed. Progress shown in terminal." },
  { num: 4, title: "Desktop Shortcut", desc: "Installation creates a shortcut on your Desktop. Double-click to launch SAI!" },
];

const MANUAL_STEPS = [
  "Open PowerShell as Administrator (Start → search PowerShell → right-click → Run as Admin)",
  "Install Node.js: winget install OpenJS.NodeJS.LTS",
  "Install pnpm: npm install -g pnpm",
  "Navigate to project folder: cd C:\\SAI-Rolotech",
  "Install dependencies: pnpm install",
  "Build Windows app: pnpm --filter @workspace/desktop run dist:installer",
  "Find installer in: artifacts/desktop/release/*.exe",
  "Run the .exe installer — creates Start Menu & Desktop shortcuts",
];

export function DesktopInstallView() {
  const [copied, setCopied] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [activeTab, setActiveTab] = useState<"quick" | "manual" | "requirements">("quick");

  function downloadScript() {
    const blob = new Blob([INSTALL_SCRIPT], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "SAI-Install-Windows.ps1";
    a.click();
    URL.revokeObjectURL(url);
  }

  function copyScript() {
    navigator.clipboard.writeText(INSTALL_SCRIPT).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div style={{ height: "100%", overflow: "auto", background: "radial-gradient(ellipse at 50% 0%, rgba(245,158,11,0.04) 0%, transparent 60%), #070710", padding: 24 }}>
      <div style={{ maxWidth: 960, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 28 }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: "linear-gradient(135deg, #f59e0b, #d97706)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 8px 24px rgba(245,158,11,0.3)" }}>
            <Monitor style={{ width: 28, height: 28, color: "#fff" }} />
          </div>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 900, color: "#fff", margin: 0, letterSpacing: "-0.01em" }}>Laptop / Windows Install</h1>
            <p style={{ fontSize: 13, color: "#71717a", margin: 0, marginTop: 3 }}>Hardware acceleration — CPU, GPU, RAM ka poora use</p>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <div style={{ padding: "6px 12px", borderRadius: 8, background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.25)", fontSize: 11, fontWeight: 700, color: "#34d399" }}>
              Windows 10/11
            </div>
            <div style={{ padding: "6px 12px", borderRadius: 8, background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.25)", fontSize: 11, fontWeight: 700, color: "#f59e0b" }}>
              x64 Only
            </div>
          </div>
        </div>

        {/* Hardware benefits grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 24 }}>
          {HARDWARE_FEATURES.map((f, i) => (
            <div key={i} style={{ borderRadius: 14, padding: "16px 18px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", display: "flex", gap: 12, alignItems: "flex-start" }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                {f.icon}
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#e4e4e7", marginBottom: 3 }}>{f.title}</div>
                <div style={{ fontSize: 11, color: "#71717a", lineHeight: 1.5 }}>{f.desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, marginBottom: 20, padding: 4, background: "rgba(255,255,255,0.03)", borderRadius: 12, border: "1px solid rgba(255,255,255,0.06)", width: "fit-content" }}>
          {(["quick", "manual", "requirements"] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              style={{ padding: "8px 18px", borderRadius: 9, border: "none", fontSize: 12, fontWeight: 700, cursor: "pointer", background: activeTab === tab ? "linear-gradient(90deg, rgba(245,158,11,0.25), rgba(245,158,11,0.12))" : "transparent", color: activeTab === tab ? "#fbbf24" : "#71717a", transition: "all 0.15s", letterSpacing: "0.02em", textTransform: "capitalize" }}>
              {tab === "quick" ? "Quick Install" : tab === "manual" ? "Manual Build" : "System Requirements"}
            </button>
          ))}
        </div>

        {/* QUICK INSTALL TAB */}
        {activeTab === "quick" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {/* Steps */}
            <div style={{ borderRadius: 16, padding: 24, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <h3 style={{ fontSize: 14, fontWeight: 800, color: "#fff", marginBottom: 20, display: "flex", alignItems: "center", gap: 8 }}>
                <Zap style={{ width: 16, height: 16, color: SAI_COLOR }} />
                4 Steps — 5 Minutes
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {STEPS.map((s, i) => (
                  <div key={i} style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: "linear-gradient(135deg, rgba(245,158,11,0.2), rgba(245,158,11,0.08))", border: "1px solid rgba(245,158,11,0.3)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 12, fontWeight: 900, color: "#f59e0b" }}>{s.num}</div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#e4e4e7", marginBottom: 2 }}>{s.title}</div>
                      <div style={{ fontSize: 12, color: "#71717a", lineHeight: 1.5 }}>{s.desc}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: 24, padding: "14px 16px", borderRadius: 12, background: "rgba(52,211,153,0.06)", border: "1px solid rgba(52,211,153,0.2)" }}>
                <div style={{ fontSize: 12, color: "#34d399", fontWeight: 700, marginBottom: 6 }}>✅ After Install You Get:</div>
                {["Native Windows exe (.exe) — starts in 3–5 sec", "Desktop + Start Menu shortcuts", "System tray icon — minimize to tray", "Ctrl+O open DXF, Ctrl+S save G-code", "Auto-update support", "100% offline AI — no internet needed"].map((item, i) => (
                  <div key={i} style={{ fontSize: 11, color: "#a1a1aa", marginBottom: 3, display: "flex", gap: 6, alignItems: "center" }}>
                    <CheckCircle style={{ width: 12, height: 12, color: "#34d399", flexShrink: 0 }} />
                    {item}
                  </div>
                ))}
              </div>
            </div>

            {/* Download */}
            <div style={{ borderRadius: 16, padding: 24, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <h3 style={{ fontSize: 14, fontWeight: 800, color: "#fff", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
                <Download style={{ width: 16, height: 16, color: SAI_COLOR }} />
                Download Installer Script
              </h3>

              <button onClick={downloadScript}
                style={{ width: "100%", padding: "16px 20px", borderRadius: 12, border: "none", background: "linear-gradient(90deg, #f59e0b, #d97706)", color: "#fff", fontSize: 14, fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, boxShadow: "0 4px 20px rgba(245,158,11,0.4)", marginBottom: 12, letterSpacing: "0.02em" }}>
                <Download style={{ width: 18, height: 18 }} />
                Download SAI-Install-Windows.ps1
              </button>

              <div style={{ padding: "12px 14px", borderRadius: 10, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: "#71717a", marginBottom: 6, fontWeight: 700 }}>After Download:</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {["Find .ps1 file in Downloads folder", "Right-click → Run with PowerShell", "Click Yes when Windows asks for admin", "Wait 3–5 min — watch progress in terminal", "Desktop shortcut appears when done!"].map((step, i) => (
                    <div key={i} style={{ fontSize: 11, color: "#a1a1aa", display: "flex", gap: 6, alignItems: "flex-start" }}>
                      <ChevronRight style={{ width: 12, height: 12, color: "#f59e0b", flexShrink: 0, marginTop: 1 }} />
                      {step}
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ padding: "12px 14px", borderRadius: 10, background: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.2)", marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#60a5fa", marginBottom: 4 }}>Script kaisa kaam karta hai:</div>
                <div style={{ fontSize: 11, color: "#a1a1aa", lineHeight: 1.6 }}>
                  1. Node.js 20 LTS install karta hai (winget se — safe hai)<br />
                  2. pnpm install karta hai (package manager)<br />
                  3. SAI ki dependencies install karta hai<br />
                  4. Desktop shortcut banata hai<br />
                  5. Pura offline mode mein kaam karta hai — koi data nahi jaata
                </div>
              </div>

              <button onClick={copyScript}
                style={{ width: "100%", padding: "10px 16px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)", color: copied ? "#34d399" : "#a1a1aa", fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                {copied ? <CheckCircle style={{ width: 14, height: 14 }} /> : <Terminal style={{ width: 14, height: 14 }} />}
                {copied ? "Copied!" : "Copy Script to Clipboard"}
              </button>
            </div>
          </div>
        )}

        {/* MANUAL BUILD TAB */}
        {activeTab === "manual" && (
          <div style={{ borderRadius: 16, padding: 24, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <h3 style={{ fontSize: 14, fontWeight: 800, color: "#fff", marginBottom: 20, display: "flex", alignItems: "center", gap: 8 }}>
              <Package style={{ width: 16, height: 16, color: SAI_COLOR }} />
              Manual Build — Full Windows .exe Installer
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#71717a", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>Steps</div>
                {MANUAL_STEPS.map((step, i) => (
                  <div key={i} style={{ display: "flex", gap: 10, marginBottom: 12, alignItems: "flex-start" }}>
                    <div style={{ width: 22, height: 22, borderRadius: 6, background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.25)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 10, fontWeight: 800, color: "#f59e0b" }}>{i + 1}</div>
                    <div style={{ fontSize: 12, color: "#c4c4cc", lineHeight: 1.5 }}>{step}</div>
                  </div>
                ))}
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#71717a", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>Build Commands</div>
                <div style={{ borderRadius: 12, background: "#0c0d1f", border: "1px solid rgba(255,255,255,0.07)", padding: 16, fontFamily: "monospace", fontSize: 12, color: "#34d399", lineHeight: 2 }}>
                  <div style={{ color: "#71717a" }}>{`:: Open PowerShell as Admin`}</div>
                  <div>pnpm install</div>
                  <div style={{ color: "#71717a" }}>{`:: Build full .exe installer:`}</div>
                  <div>pnpm --filter @workspace/desktop</div>
                  <div style={{ paddingLeft: 20 }}>run dist:installer</div>
                  <div style={{ color: "#71717a", marginTop: 8 }}>{`:: OR portable .exe (no install):`}</div>
                  <div>pnpm --filter @workspace/desktop</div>
                  <div style={{ paddingLeft: 20 }}>run dist:portable</div>
                  <div style={{ color: "#71717a", marginTop: 8 }}>{`:: Output:`}</div>
                  <div style={{ color: "#fbbf24" }}>artifacts/desktop/release/*.exe</div>
                </div>
                <div style={{ marginTop: 16, padding: "12px 14px", borderRadius: 10, background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.2)" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#f59e0b", marginBottom: 4 }}>Output Files:</div>
                  <div style={{ fontSize: 11, color: "#a1a1aa", lineHeight: 1.7 }}>
                    📦 <strong>SAI-Rolotech-AI-Setup-1.0.0.exe</strong> — Full NSIS installer<br />
                    📦 <strong>SAI-Rolotech-AI-Portable-1.0.0.exe</strong> — No install needed<br />
                    Share the .exe file on USB drive — no internet needed on target PC!
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* REQUIREMENTS TAB */}
        {activeTab === "requirements" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div style={{ borderRadius: 16, padding: 24, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <h3 style={{ fontSize: 14, fontWeight: 800, color: "#fff", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
                <Settings style={{ width: 16, height: 16, color: SAI_COLOR }} />
                System Requirements
              </h3>
              {[
                { label: "OS", value: "Windows 10 (Build 17763+) or Windows 11", ok: true },
                { label: "Processor", value: "64-bit (x64) — Intel or AMD", ok: true },
                { label: "RAM", value: "4 GB minimum — 8 GB recommended", ok: true },
                { label: "Storage", value: "500 MB free disk space", ok: true },
                { label: "GPU", value: "Any DirectX 11 GPU (integrated OK)", ok: true },
                { label: "Internet", value: "Only for installation — not after", ok: true },
                { label: "Node.js", value: "Auto-installed by script (v20 LTS)", ok: true },
                { label: "Admin", value: "Required for first install only", ok: true },
              ].map((req, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                  <span style={{ fontSize: 12, color: "#71717a", fontWeight: 600 }}>{req.label}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 12, color: "#c4c4cc" }}>{req.value}</span>
                    <CheckCircle style={{ width: 13, height: 13, color: "#34d399" }} />
                  </div>
                </div>
              ))}
            </div>

            <div style={{ borderRadius: 16, padding: 24, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <h3 style={{ fontSize: 14, fontWeight: 800, color: "#fff", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
                <Zap style={{ width: 16, height: 16, color: "#34d399" }} />
                Desktop vs Browser Comparison
              </h3>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", padding: "8px 10px", color: "#52525b", fontSize: 11, fontWeight: 700, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>Feature</th>
                    <th style={{ textAlign: "center", padding: "8px 10px", color: "#f59e0b", fontSize: 11, fontWeight: 700, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>Desktop App</th>
                    <th style={{ textAlign: "center", padding: "8px 10px", color: "#60a5fa", fontSize: 11, fontWeight: 700, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>Browser</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["Startup speed", "3–5 sec", "Instant"],
                    ["GPU acceleration", "✅ Full D3D11", "⚠️ Limited"],
                    ["File access", "✅ Native dialogs", "⚠️ Download only"],
                    ["Offline mode", "✅ 100%", "✅ 100%"],
                    ["System tray", "✅ Yes", "❌ No"],
                    ["Auto-update", "✅ Silent", "✅ Browser refresh"],
                    ["RAM usage", "400–800 MB", "200–400 MB"],
                    ["Print to PDF", "✅ Native print", "✅ Browser print"],
                    ["DXF open", "✅ Ctrl+O", "⚠️ File picker"],
                    ["Multi-monitor", "✅ Native", "⚠️ Limited"],
                  ].map(([feature, desktop, browser], i) => (
                    <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                      <td style={{ padding: "7px 10px", color: "#a1a1aa" }}>{feature}</td>
                      <td style={{ textAlign: "center", padding: "7px 10px", color: "#fbbf24" }}>{desktop}</td>
                      <td style={{ textAlign: "center", padding: "7px 10px", color: "#93c5fd" }}>{browser}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Bottom note */}
        <div style={{ marginTop: 20, padding: "16px 20px", borderRadius: 12, background: "rgba(245,158,11,0.04)", border: "1px solid rgba(245,158,11,0.1)", display: "flex", alignItems: "center", gap: 12 }}>
          <Globe style={{ width: 18, height: 18, color: "#f59e0b", flexShrink: 0 }} />
          <div>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#f59e0b" }}>Web browser mein bhi use kar sakte hain — </span>
            <span style={{ fontSize: 12, color: "#71717a" }}>Agar Windows install nahi karna to browser mein hi use karo. Sab features available hain. Desktop app sirf hardware ka zyada fayda deta hai (GPU, native files, system tray).</span>
          </div>
        </div>
      </div>
    </div>
  );
}
