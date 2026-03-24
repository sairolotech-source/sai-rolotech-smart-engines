import React, { useState } from "react";
import {
  Monitor, Download, Cpu, HardDrive, Zap, CheckCircle,
  Terminal, Shield, WifiOff, ChevronRight,
  Package, Settings, RefreshCw, Globe, Trash2, AlertTriangle
} from "lucide-react";

const SAI_COLOR = "#f59e0b";

// ─── COMPLETE REMOVE + FRESH INSTALL ─────────────────────────────────────────
const CLEAN_REINSTALL_SCRIPT = `# SAI Rolotech Smart Engines — PURA SAAF + NAYA INSTALL
# PowerShell Script v2.2 — Ek baar chalao, hamesha ke liye theek ho jayega
# Run karo: Right-click → "Run with PowerShell" → Yes (Admin)

$ErrorActionPreference = "SilentlyContinue"
$AppName = "SAI Rolotech Smart Engines"

Write-Host ""
Write-Host "============================================================" -ForegroundColor Red
Write-Host "  SAI ROLOTECH — PURA SAAF + NAYA INSTALL SCRIPT" -ForegroundColor Yellow
Write-Host "  Purana version hata ke bilkul fresh install karega" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Red
Write-Host ""
Start-Sleep -Seconds 2

# ── STEP 1: Saare processes band karo ────────────────────────────────────────
Write-Host "[1/7] Purani app ke saare processes band kar raha hun..." -ForegroundColor Yellow
$processNames = @(
    "SAI Rolotech Smart Engines",
    "SaiRolotech",
    "sai-rolotech",
    "electron",
    "SAI-Rolotech",
    "SAI Rolotech"
)
foreach ($proc in $processNames) {
    Get-Process -Name $proc -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
}
Start-Sleep -Seconds 2
Write-Host "  Processes band!" -ForegroundColor Green

# ── STEP 2: Windows Uninstaller chalao ───────────────────────────────────────
Write-Host "[2/7] Windows Programs list se uninstall kar raha hun..." -ForegroundColor Yellow
$uninstallPaths = @(
    "HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall",
    "HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall",
    "HKLM:\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall"
)
foreach ($regPath in $uninstallPaths) {
    if (Test-Path $regPath) {
        Get-ChildItem $regPath | ForEach-Object {
            $displayName = (Get-ItemProperty $_.PSPath -ErrorAction SilentlyContinue).DisplayName
            if ($displayName -like "*SAI*" -or $displayName -like "*Rolotech*" -or $displayName -like "*RoloTech*") {
                $uninstallStr = (Get-ItemProperty $_.PSPath -ErrorAction SilentlyContinue).UninstallString
                Write-Host "  Mila: $displayName — uninstall ho raha hai..." -ForegroundColor Cyan
                if ($uninstallStr) {
                    if ($uninstallStr -like "*MsiExec*") {
                        $msiCode = $uninstallStr -replace "MsiExec.exe /I","" -replace "MsiExec.exe /X",""
                        Start-Process "msiexec.exe" -ArgumentList "/x $msiCode /quiet /norestart" -Wait -ErrorAction SilentlyContinue
                    } else {
                        $uninstallStr = $uninstallStr -replace '"',''
                        Start-Process $uninstallStr -ArgumentList "/S /silent /quiet" -Wait -ErrorAction SilentlyContinue
                    }
                }
                Remove-Item $_.PSPath -Recurse -Force -ErrorAction SilentlyContinue
                Write-Host "  Registry entry hata diya!" -ForegroundColor Green
            }
        }
    }
}

# ── STEP 3: Saari purani directories hato ────────────────────────────────────
Write-Host "[3/7] Purani files aur folders hata raha hun..." -ForegroundColor Yellow
$dirsToRemove = @(
    "$env:LOCALAPPDATA\\SAI-Rolotech",
    "$env:LOCALAPPDATA\\sai-rolotech-smart-engines",
    "$env:LOCALAPPDATA\\SAI Rolotech Smart Engines",
    "$env:LOCALAPPDATA\\SaiRolotech",
    "$env:APPDATA\\SAI-Rolotech",
    "$env:APPDATA\\sai-rolotech-smart-engines",
    "$env:APPDATA\\SAI Rolotech Smart Engines",
    "$env:APPDATA\\SaiRolotech",
    "$env:PROGRAMFILES\\SAI-Rolotech",
    "$env:PROGRAMFILES\\SAI Rolotech Smart Engines",
    "$env:PROGRAMFILES(X86)\\SAI-Rolotech",
    "$env:PROGRAMFILES(X86)\\SAI Rolotech Smart Engines",
    "C:\\SAI-Rolotech",
    "C:\\sai-rolotech",
    "$env:USERPROFILE\\SAI-Rolotech",
    "$env:TEMP\\SAI-Rolotech-Install*"
)
foreach ($dir in $dirsToRemove) {
    if (Test-Path $dir) {
        Remove-Item $dir -Recurse -Force -ErrorAction SilentlyContinue
        Write-Host "  Hata diya: $dir" -ForegroundColor Green
    }
}

# ── STEP 4: Shortcuts hato ────────────────────────────────────────────────────
Write-Host "[4/7] Purane shortcuts hata raha hun..." -ForegroundColor Yellow
$shortcuts = @(
    "$env:USERPROFILE\\Desktop\\SAI Rolotech Smart Engines.lnk",
    "$env:USERPROFILE\\Desktop\\SAI-Rolotech.lnk",
    "$env:APPDATA\\Microsoft\\Windows\\Start Menu\\Programs\\SAI Rolotech Smart Engines.lnk",
    "$env:APPDATA\\Microsoft\\Windows\\Start Menu\\Programs\\SAI-Rolotech\\SAI Rolotech Smart Engines.lnk",
    "$env:PROGRAMDATA\\Microsoft\\Windows\\Start Menu\\Programs\\SAI Rolotech Smart Engines.lnk",
    "$env:PROGRAMDATA\\Microsoft\\Windows\\Start Menu\\Programs\\SAI Rolotech Smart Engines\\SAI Rolotech Smart Engines.lnk"
)
foreach ($lnk in $shortcuts) {
    if (Test-Path $lnk) {
        Remove-Item $lnk -Force -ErrorAction SilentlyContinue
        Write-Host "  Shortcut hata diya: $lnk" -ForegroundColor Green
    }
}
$startMenuFolder = "$env:APPDATA\\Microsoft\\Windows\\Start Menu\\Programs\\SAI Rolotech Smart Engines"
if (Test-Path $startMenuFolder) {
    Remove-Item $startMenuFolder -Recurse -Force -ErrorAction SilentlyContinue
}
$startMenuFolder2 = "$env:PROGRAMDATA\\Microsoft\\Windows\\Start Menu\\Programs\\SAI Rolotech Smart Engines"
if (Test-Path $startMenuFolder2) {
    Remove-Item $startMenuFolder2 -Recurse -Force -ErrorAction SilentlyContinue
}
Write-Host "  Shortcuts saaf!" -ForegroundColor Green

# ── STEP 5: Naya install directory banao ──────────────────────────────────────
Write-Host "[5/7] Naya install directory bana raha hun..." -ForegroundColor Yellow
$InstallDir = "$env:LOCALAPPDATA\\SAI-Rolotech"
New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
Write-Host "  Directory: $InstallDir" -ForegroundColor Green

# Node.js check / install
Write-Host "  Node.js check kar raha hun..." -ForegroundColor Cyan
$nodeExists = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeExists) {
    Write-Host "  Node.js nahi mila — install kar raha hun..." -ForegroundColor Yellow
    winget install OpenJS.NodeJS.LTS --silent --accept-package-agreements --accept-source-agreements
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
} else {
    Write-Host "  Node.js mila: $(node --version)" -ForegroundColor Green
}
# pnpm
$pnpmExists = Get-Command pnpm -ErrorAction SilentlyContinue
if (-not $pnpmExists) {
    Write-Host "  pnpm install ho raha hai..." -ForegroundColor Yellow
    npm install -g pnpm --silent 2>$null
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
}
Write-Host "  pnpm: $(pnpm --version 2>$null)" -ForegroundColor Green

# ── STEP 6: Latest GitHub se download karo ───────────────────────────────────
Write-Host "[6/7] GitHub se latest version download kar raha hun..." -ForegroundColor Yellow
$RepoZip = "$env:TEMP\\SAI-Rolotech-Latest.zip"
$ExtractDir = "$env:TEMP\\SAI-Rolotech-Src"

if (Test-Path $RepoZip) { Remove-Item $RepoZip -Force }
if (Test-Path $ExtractDir) { Remove-Item $ExtractDir -Recurse -Force }

try {
    Write-Host "  GitHub se code download ho raha hai..." -ForegroundColor Cyan
    Invoke-WebRequest "https://github.com/sairolotech-source/sai-rolotech-smart-engines/archive/refs/heads/main.zip" -OutFile $RepoZip -UseBasicParsing
    Write-Host "  Download complete! Extract ho raha hai..." -ForegroundColor Green
    Expand-Archive -Path $RepoZip -DestinationPath $ExtractDir -Force
    $srcFolder = Get-ChildItem $ExtractDir | Select-Object -First 1
    Copy-Item "$($srcFolder.FullName)\\*" -Destination $InstallDir -Recurse -Force
    Write-Host "  Code copy ho gaya!" -ForegroundColor Green
} catch {
    Write-Host "  GitHub download fail — internet check karo." -ForegroundColor Red
    Write-Host "  Error: $_" -ForegroundColor Red
    Pause
    exit 1
}

# pnpm install
Write-Host "  Dependencies install ho rahe hain (2-3 minute lagenge)..." -ForegroundColor Yellow
Set-Location $InstallDir
pnpm install --frozen-lockfile 2>&1 | Where-Object { $_ -notmatch "^$" } | Select-Object -Last 5
Write-Host "  Dependencies ready!" -ForegroundColor Green

# ── STEP 7: Naye shortcuts banao ──────────────────────────────────────────────
Write-Host "[7/7] Naye shortcuts bana raha hun..." -ForegroundColor Yellow

# Desktop shortcut
$WshShell = New-Object -comObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut("$env:USERPROFILE\\Desktop\\SAI Rolotech Smart Engines.lnk")
$Shortcut.TargetPath = "cmd.exe"
$Shortcut.Arguments = "/c cd /d ""$InstallDir"" && pnpm --filter @workspace/design-tool run dev && timeout 3 && start http://localhost:5000"
$Shortcut.WindowStyle = 7
$Shortcut.Description = "SAI Rolotech Smart Engines v2.2"
if (Test-Path "$InstallDir\\artifacts\\desktop\\assets\\icon.ico") {
    $Shortcut.IconLocation = "$InstallDir\\artifacts\\desktop\\assets\\icon.ico"
}
$Shortcut.Save()

# Start Menu shortcut
$StartMenuDir = "$env:APPDATA\\Microsoft\\Windows\\Start Menu\\Programs\\SAI Rolotech Smart Engines"
if (-not (Test-Path $StartMenuDir)) { New-Item -ItemType Directory -Path $StartMenuDir -Force | Out-Null }
$ShortcutSM = $WshShell.CreateShortcut("$StartMenuDir\\SAI Rolotech Smart Engines.lnk")
$ShortcutSM.TargetPath = "cmd.exe"
$ShortcutSM.Arguments = "/c cd /d ""$InstallDir"" && pnpm --filter @workspace/design-tool run dev && timeout 3 && start http://localhost:5000"
$ShortcutSM.WindowStyle = 7
$ShortcutSM.Description = "SAI Rolotech Smart Engines v2.2"
$ShortcutSM.Save()

# Cleanup temp files
Remove-Item $RepoZip -Force -ErrorAction SilentlyContinue
Remove-Item $ExtractDir -Recurse -Force -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
Write-Host "  BILKUL FRESH INSTALL COMPLETE!" -ForegroundColor Green
Write-Host "  Install folder: $InstallDir" -ForegroundColor White
Write-Host "  Desktop shortcut bana diya: SAI Rolotech Smart Engines" -ForegroundColor White
Write-Host "  Ab double-click karo shortcut ko — launch ho jayegi!" -ForegroundColor Yellow
Write-Host "============================================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Agar koi problem ho to Ctrl+C dabao aur admin ko batao." -ForegroundColor Gray
Write-Host ""
Pause
`;

// ─── QUICK INSTALL SCRIPT ─────────────────────────────────────────────────────
const INSTALL_SCRIPT = `# SAI Rolotech Smart Engines — Windows Quick Installer
# PowerShell Script — Run as Administrator
$ErrorActionPreference = "Stop"
$AppName = "SAI Rolotech Smart Engines"
$InstallDir = "$env:LOCALAPPDATA\\SAI-Rolotech"
$NodeVersion = "20"
Write-Host "====================================================" -ForegroundColor Cyan
Write-Host "  $AppName — Desktop Installer" -ForegroundColor Yellow
Write-Host "====================================================" -ForegroundColor Cyan
$winVer = [System.Environment]::OSVersion.Version
if ($winVer.Major -lt 10) { Write-Host "ERROR: Windows 10+" -ForegroundColor Red; exit 1 }
Write-Host "[1/5] Windows OK: $($winVer.Major).$($winVer.Minor)" -ForegroundColor Green
$nodeExists = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeExists) {
    Write-Host "[2/5] Installing Node.js $NodeVersion LTS..." -ForegroundColor Yellow
    winget install OpenJS.NodeJS.LTS --silent --accept-package-agreements --accept-source-agreements
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
} else { Write-Host "[2/5] Node.js: $(node --version)" -ForegroundColor Green }
Write-Host "[3/5] Installing pnpm..." -ForegroundColor Yellow
npm install -g pnpm --silent 2>$null
if (-not (Test-Path $InstallDir)) { New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null }
Write-Host "[4/5] Downloading latest from GitHub..." -ForegroundColor Yellow
$zip = "$env:TEMP\\SAI-Latest.zip"
Invoke-WebRequest "https://github.com/sairolotech-source/sai-rolotech-smart-engines/archive/refs/heads/main.zip" -OutFile $zip -UseBasicParsing
Expand-Archive -Path $zip -DestinationPath "$env:TEMP\\SAI-Src" -Force
$src = Get-ChildItem "$env:TEMP\\SAI-Src" | Select-Object -First 1
Copy-Item "$($src.FullName)\\*" -Destination $InstallDir -Recurse -Force
Set-Location $InstallDir
pnpm install --frozen-lockfile 2>$null
Write-Host "[5/5] Creating shortcuts..." -ForegroundColor Yellow
$WshShell = New-Object -comObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut("$env:USERPROFILE\\Desktop\\SAI Rolotech Smart Engines.lnk")
$Shortcut.TargetPath = "cmd.exe"
$Shortcut.Arguments = "/c cd /d \`"$InstallDir\`" && pnpm --filter @workspace/design-tool run dev && timeout 3 && start http://localhost:5000"
$Shortcut.WindowStyle = 7
$Shortcut.Save()
Remove-Item $zip -Force -ErrorAction SilentlyContinue
Write-Host "DONE! Desktop shortcut bana diya. Double-click karo!" -ForegroundColor Green
Pause
`;

const HARDWARE_FEATURES = [
  { icon: <Cpu style={{ width: 18, height: 18, color: "#34d399" }} />, title: "Full CPU Utilization", desc: "All cores — G-code, calculations, FEA. 10× faster." },
  { icon: <Zap style={{ width: 18, height: 18, color: "#f59e0b" }} />, title: "GPU Acceleration", desc: "D3D11 + WebGL. 3D simulation 60fps native." },
  { icon: <HardDrive style={{ width: 18, height: 18, color: "#a78bfa" }} />, title: "Local Storage", desc: "C: drive pe projects — no cloud, instant save." },
  { icon: <WifiOff style={{ width: 18, height: 18, color: "#60a5fa" }} />, title: "100% Offline", desc: "No internet after install. AI, DXF, all tools." },
  { icon: <Monitor style={{ width: 18, height: 18, color: "#fb923c" }} />, title: "Native Windows App", desc: "System tray, Ctrl+O DXF, Ctrl+S G-code." },
  { icon: <Shield style={{ width: 18, height: 18, color: "#34d399" }} />, title: "Data Privacy", desc: "Kuch bhi cloud pe nahi jaata. Pure local." },
];

export function DesktopInstallView() {
  const [activeTab, setActiveTab] = useState<"clean" | "fresh" | "requirements">("clean");
  const [downloaded, setDownloaded] = useState<"" | "clean" | "fresh">("");

  function download(type: "clean" | "fresh") {
    const endpoint = type === "clean"
      ? "/api/download-script/clean"
      : "/api/download-script/fresh";
    const a = document.createElement("a");
    a.href = endpoint;
    a.setAttribute("download", type === "clean" ? "SAI-PuraSaaf-NayaInstall.ps1" : "SAI-Install-Windows.ps1");
    a.target = "_blank";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setDownloaded(type);
    setTimeout(() => setDownloaded(""), 4000);
  }

  return (
    <div style={{ height: "100%", overflow: "auto", background: "#070710", padding: 24 }}>
      <div style={{ maxWidth: 980, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 22 }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, background: "linear-gradient(135deg, #f59e0b, #d97706)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Monitor style={{ width: 26, height: 26, color: "#fff" }} />
          </div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 900, color: "#fff", margin: 0 }}>Laptop / Windows Install</h1>
            <p style={{ fontSize: 12, color: "#71717a", margin: 0, marginTop: 2 }}>Hardware acceleration — CPU, GPU, RAM ka poora use</p>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <div style={{ padding: "5px 10px", borderRadius: 6, background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.25)", fontSize: 11, fontWeight: 700, color: "#34d399" }}>Windows 10/11</div>
            <div style={{ padding: "5px 10px", borderRadius: 6, background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.25)", fontSize: 11, fontWeight: 700, color: "#f59e0b" }}>x64</div>
          </div>
        </div>

        {/* ── BIG ALERT — PURA SAAF ─────────────────────────────────────── */}
        <div style={{
          borderRadius: 16, padding: "20px 24px", marginBottom: 22,
          background: "linear-gradient(135deg, rgba(239,68,68,0.12), rgba(245,158,11,0.08))",
          border: "2px solid rgba(239,68,68,0.4)",
          display: "flex", gap: 18, alignItems: "flex-start"
        }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.4)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Trash2 style={{ width: 24, height: 24, color: "#ef4444" }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 900, color: "#ef4444", marginBottom: 6 }}>
              Purana Version Baar Baar Aa Raha Hai? — YEH SCRIPT CHALAO
            </div>
            <div style={{ fontSize: 13, color: "#94a3b8", marginBottom: 14, lineHeight: 1.6 }}>
              Yeh script <strong style={{ color: "#fbbf24" }}>ek baar mein sab kuch</strong> karta hai:
              purana version <strong style={{ color: "#f87171" }}>100% hata deta hai</strong> (registry, folders, shortcuts, AppData sab) —
              phir <strong style={{ color: "#4ade80" }}>bilkul fresh GitHub se latest version install</strong> karta hai.
            </div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
              {[
                { icon: "🔴", text: "Saare processes band" },
                { icon: "🗑️", text: "Registry uninstall" },
                { icon: "📁", text: "Saare folders delete" },
                { icon: "🔗", text: "Shortcuts saaf" },
                { icon: "⬇️", text: "GitHub se latest download" },
                { icon: "✅", text: "Naya shortcut bana diya" },
              ].map((item, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 6, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", fontSize: 11, color: "#e2e8f0" }}>
                  <span>{item.icon}</span> {item.text}
                </div>
              ))}
            </div>
            <button
              onClick={() => download("clean")}
              style={{
                padding: "14px 28px", borderRadius: 10, border: "none",
                background: downloaded === "clean"
                  ? "linear-gradient(90deg, #16a34a, #15803d)"
                  : "linear-gradient(90deg, #ef4444, #dc2626)",
                color: "#fff", fontSize: 15, fontWeight: 800, cursor: "pointer",
                display: "inline-flex", alignItems: "center", gap: 10,
                boxShadow: "0 4px 20px rgba(239,68,68,0.4)",
                letterSpacing: "0.02em", transition: "all 0.2s"
              }}
            >
              {downloaded === "clean"
                ? <><CheckCircle style={{ width: 18, height: 18 }} /> Download Ho Gaya!</>
                : <><Download style={{ width: 18, height: 18 }} /> SAI-PuraSaaf-NayaInstall.ps1 Download Karo</>
              }
            </button>
            <div style={{ marginTop: 12, fontSize: 12, color: "#64748b", display: "flex", alignItems: "center", gap: 6 }}>
              <AlertTriangle style={{ width: 13, height: 13, color: "#f59e0b" }} />
              Download ke baad: File pe Right-click → "Run with PowerShell" → "Yes" (Admin allow karo)
            </div>
          </div>
        </div>

        {/* ── Steps how to run ─────────────────────────────────────────────── */}
        <div style={{ borderRadius: 14, padding: "16px 20px", marginBottom: 22, background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.2)" }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: "#fbbf24", marginBottom: 12 }}>📋 Script Kaise Chalayein — 3 Steps:</div>
          <div style={{ display: "flex", gap: 0, position: "relative" }}>
            {[
              { num: "1", title: "Download Karo", desc: "Upar red button dabao — .ps1 file download hogi Downloads folder mein", color: "#ef4444" },
              { num: "2", title: "Right-Click → Run with PowerShell", desc: "Downloads folder mein file dhundo → Right-click → 'Run with PowerShell' → 'Yes' click karo", color: "#f59e0b" },
              { num: "3", title: "Wait karo — Done!", desc: "5–10 minute mein sab kuch saaf aur naya install ho jayega. Desktop pe shortcut bana dega.", color: "#34d399" },
            ].map((s, i) => (
              <div key={i} style={{ flex: 1, padding: "0 16px", borderLeft: i > 0 ? "1px solid rgba(255,255,255,0.07)" : "none" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <div style={{ width: 26, height: 26, borderRadius: 7, background: `rgba(${s.color === "#ef4444" ? "239,68,68" : s.color === "#f59e0b" ? "245,158,11" : "52,211,153"},0.15)`, border: `1px solid ${s.color}40`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 900, color: s.color, flexShrink: 0 }}>{s.num}</div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: "#e2e8f0" }}>{s.title}</div>
                </div>
                <div style={{ fontSize: 11, color: "#71717a", lineHeight: 1.6 }}>{s.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Tabs ─────────────────────────────────────────────────────────── */}
        <div style={{ display: "flex", gap: 4, marginBottom: 18, padding: 4, background: "rgba(255,255,255,0.03)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)", width: "fit-content" }}>
          {([
            { id: "clean", label: "Kya Kya Saaf Hoga" },
            { id: "fresh", label: "Pehli Baar Install" },
            { id: "requirements", label: "Requirements" },
          ] as const).map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              style={{ padding: "7px 16px", borderRadius: 7, border: "none", fontSize: 12, fontWeight: 700, cursor: "pointer", background: activeTab === tab.id ? "linear-gradient(90deg, rgba(245,158,11,0.25), rgba(245,158,11,0.1))" : "transparent", color: activeTab === tab.id ? "#fbbf24" : "#71717a", transition: "all 0.15s" }}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── Tab: KYA KYA SAAF HOGA ─────────────────────────────────────── */}
        {activeTab === "clean" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div style={{ borderRadius: 14, padding: 20, background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)" }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: "#ef4444", marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
                <Trash2 style={{ width: 15, height: 15 }} /> Yeh sab HATEGA (purana version):
              </div>
              {[
                "Saare SAI app ke processes (force close)",
                "Windows Programs list se uninstall (NSIS/MSI)",
                "Registry keys — HKLM + HKCU dono",
                "%LOCALAPPDATA%\\SAI-Rolotech\\",
                "%APPDATA%\\SAI-Rolotech\\",
                "%PROGRAMFILES%\\SAI Rolotech\\",
                "C:\\SAI-Rolotech\\ (agar wahan install tha)",
                "Desktop shortcut (purana)",
                "Start Menu shortcut (purana)",
                "Temp folder ke cached files",
              ].map((item, i) => (
                <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 6, fontSize: 12, color: "#f87171" }}>
                  <span style={{ flexShrink: 0, marginTop: 1 }}>✕</span>
                  <span style={{ fontFamily: item.includes("%") || item.includes("C:\\") ? "monospace" : "inherit", fontSize: 11 }}>{item}</span>
                </div>
              ))}
            </div>
            <div style={{ borderRadius: 14, padding: 20, background: "rgba(52,211,153,0.06)", border: "1px solid rgba(52,211,153,0.2)" }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: "#34d399", marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
                <CheckCircle style={{ width: 15, height: 15 }} /> Yeh sab BANAYEGA (naya version):
              </div>
              {[
                "GitHub se bilkul latest code download",
                "Fresh %LOCALAPPDATA%\\SAI-Rolotech\\",
                "pnpm dependencies fresh install",
                "Desktop shortcut (naya, latest version)",
                "Start Menu entry (naya)",
                "Shortcut browser mein app kholta hai",
                "Koi purana data nahi rehta",
                "Hamesha latest version milega",
              ].map((item, i) => (
                <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 6, fontSize: 12, color: "#4ade80" }}>
                  <CheckCircle style={{ width: 12, height: 12, flexShrink: 0, marginTop: 2 }} />
                  {item}
                </div>
              ))}
              <div style={{ marginTop: 16, padding: "10px 14px", borderRadius: 8, background: "rgba(52,211,153,0.08)", fontSize: 11, color: "#71717a", lineHeight: 1.6 }}>
                💡 <strong style={{ color: "#34d399" }}>Ab se:</strong> Jab bhi update chahiye — yahi script chalao. Hamesha fresh GitHub se aayega.
              </div>
            </div>
          </div>
        )}

        {/* ── Tab: PEHLI BAAR INSTALL ─────────────────────────────────────── */}
        {activeTab === "fresh" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div style={{ borderRadius: 14, padding: 20, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: "#fff", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
                <Package style={{ width: 15, height: 15, color: SAI_COLOR }} />
                Pehli Baar Install (Naya Laptop)
              </div>
              {[
                { num: "1", text: "Download karo: SAI-Install-Windows.ps1 (neeche button)" },
                { num: "2", text: "Right-click → Run with PowerShell → Yes" },
                { num: "3", text: "Node.js auto-install hoga (winget se)" },
                { num: "4", text: "GitHub se latest code download hoga" },
                { num: "5", text: "Desktop shortcut bana dega — double-click karo!" },
              ].map((s, i) => (
                <div key={i} style={{ display: "flex", gap: 10, marginBottom: 12, alignItems: "flex-start" }}>
                  <div style={{ width: 22, height: 22, borderRadius: 5, background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.3)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 10, fontWeight: 900, color: "#f59e0b" }}>{s.num}</div>
                  <div style={{ fontSize: 12, color: "#c4c4cc", lineHeight: 1.5 }}>{s.text}</div>
                </div>
              ))}
              <button
                onClick={() => download("fresh")}
                style={{ width: "100%", marginTop: 8, padding: "12px 16px", borderRadius: 10, border: "none", background: downloaded === "fresh" ? "linear-gradient(90deg, #16a34a, #15803d)" : "linear-gradient(90deg, #f59e0b, #d97706)", color: "#fff", fontSize: 13, fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                {downloaded === "fresh" ? <><CheckCircle style={{ width: 15, height: 15 }} /> Downloaded!</> : <><Download style={{ width: 15, height: 15 }} /> SAI-Install-Windows.ps1</>}
              </button>
            </div>

            <div style={{ borderRadius: 14, padding: 20, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: "#fff", marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
                <Zap style={{ width: 15, height: 15, color: "#34d399" }} />
                Desktop vs Browser
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", padding: "6px 8px", color: "#52525b", fontSize: 10, fontWeight: 700, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>Feature</th>
                    <th style={{ textAlign: "center", padding: "6px 8px", color: "#f59e0b", fontSize: 10, fontWeight: 700, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>Desktop</th>
                    <th style={{ textAlign: "center", padding: "6px 8px", color: "#60a5fa", fontSize: 10, fontWeight: 700, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>Browser</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["Startup speed", "3–5 sec", "Instant"],
                    ["GPU acceleration", "✅ Full D3D11", "⚠️ Limited"],
                    ["File access", "✅ Native dialogs", "⚠️ Upload only"],
                    ["Offline mode", "✅ 100%", "✅ 100%"],
                    ["System tray", "✅ Yes", "❌ No"],
                    ["Auto-update", "✅ Script chalao", "✅ Refresh karo"],
                    ["DXF open", "✅ Ctrl+O", "⚠️ File picker"],
                  ].map(([f, d, b], i) => (
                    <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                      <td style={{ padding: "6px 8px", color: "#a1a1aa", fontSize: 11 }}>{f}</td>
                      <td style={{ textAlign: "center", padding: "6px 8px", color: "#fbbf24", fontSize: 11 }}>{d}</td>
                      <td style={{ textAlign: "center", padding: "6px 8px", color: "#93c5fd", fontSize: 11 }}>{b}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Tab: REQUIREMENTS ──────────────────────────────────────────── */}
        {activeTab === "requirements" && (
          <div style={{ borderRadius: 14, padding: 20, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#fff", marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
              <Settings style={{ width: 15, height: 15, color: SAI_COLOR }} /> System Requirements
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {[
                { label: "OS", value: "Windows 10 Build 17763+ or Windows 11", ok: true },
                { label: "Architecture", value: "64-bit (x64) — Intel or AMD", ok: true },
                { label: "RAM", value: "4 GB min — 8 GB recommended", ok: true },
                { label: "Disk Space", value: "1 GB free (for app + dependencies)", ok: true },
                { label: "GPU", value: "Any DirectX 11 (integrated OK)", ok: true },
                { label: "Internet", value: "Only during install — not after", ok: true },
                { label: "Node.js", value: "Auto-installed (v20 LTS)", ok: true },
                { label: "Admin Rights", value: "Required for first install only", ok: true },
                { label: "winget", value: "Pre-installed on Win10/11 (App Installer)", ok: true },
                { label: "PowerShell", value: "v5.1+ (pre-installed on Win10/11)", ok: true },
              ].map((req, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", borderRadius: 8, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>
                  <span style={{ fontSize: 12, color: "#71717a", fontWeight: 600 }}>{req.label}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 11, color: "#c4c4cc" }}>{req.value}</span>
                    <CheckCircle style={{ width: 12, height: 12, color: "#34d399" }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Hardware features ─────────────────────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginTop: 18 }}>
          {HARDWARE_FEATURES.map((f, i) => (
            <div key={i} style={{ borderRadius: 12, padding: "14px 16px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", display: "flex", gap: 10, alignItems: "flex-start" }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(255,255,255,0.04)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{f.icon}</div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#e4e4e7", marginBottom: 2 }}>{f.title}</div>
                <div style={{ fontSize: 10, color: "#71717a", lineHeight: 1.4 }}>{f.desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* ── Bottom note ────────────────────────────────────────────────── */}
        <div style={{ marginTop: 16, padding: "14px 18px", borderRadius: 10, background: "rgba(245,158,11,0.04)", border: "1px solid rgba(245,158,11,0.1)", display: "flex", alignItems: "center", gap: 10 }}>
          <Globe style={{ width: 16, height: 16, color: "#f59e0b", flexShrink: 0 }} />
          <span style={{ fontSize: 12, color: "#71717a" }}>
            <strong style={{ color: "#f59e0b" }}>Tip:</strong> Install ke baad bhi browser se use kar sakte hain — Replit URL pe jaao, login karo, sab same hai. Desktop app sirf hardware ka zyada fayda deta hai.
          </span>
        </div>

      </div>
    </div>
  );
}
