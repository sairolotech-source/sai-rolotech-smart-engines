import { Router, type Request, type Response } from "express";
import https from "https";

const router = Router();
const GITHUB_REPO = "sairolotech-source/sai-rolotech-smart-engines";

function ghHeaders(): Record<string, string> {
  const h: Record<string, string> = { "User-Agent": "SAI-Rolotech-UpdateAgent/1.0" };
  const token = process.env.GITHUB_PERSONAL_ACCESS_TOKEN || process.env.GH_TOKEN || "";
  if (token) h["Authorization"] = `token ${token}`;
  return h;
}

async function fetchLatestRelease() {
  const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, { headers: ghHeaders() });
  if (!res.ok) throw new Error(`GitHub API ${res.status}`);
  return res.json() as Promise<{ tag_name: string; name: string; published_at: string; assets: { id: number; name: string; browser_download_url: string; size: number; url: string }[] }>;
}

function getSetupAsset(assets: any[]) {
  return assets?.find((a: any) => a.name.includes("Setup") && a.name.endsWith(".exe"))
    ?? assets?.find((a: any) => a.name.endsWith(".exe") && !a.name.endsWith(".blockmap") && !a.name.includes("Portable"));
}

function proxyUrl(req: Request, asset: any): string {
  const host = (req.headers["x-forwarded-host"] ?? req.headers.host ?? "localhost:8080") as string;
  const proto = (req.headers["x-forwarded-proto"] ?? "https") as string;
  return `${proto}://${host}/api/download/proxy/${asset.id}/${asset.name}`;
}

router.get("/download/proxy/:assetId/:filename", async (req: Request, res: Response) => {
  try {
    const assetId = req.params.assetId;
    const filename = req.params.filename || "SAI-Rolotech-Setup.exe";
    const url = `https://api.github.com/repos/${GITHUB_REPO}/releases/assets/${assetId}`;
    const headers = { ...ghHeaders(), Accept: "application/octet-stream" };

    const proxyReq = https.get(url, { headers }, (proxyRes) => {
      if (proxyRes.statusCode === 302 && proxyRes.headers.location) {
        https.get(proxyRes.headers.location, (finalRes) => {
          res.setHeader("Content-Type", "application/octet-stream");
          res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
          if (finalRes.headers["content-length"]) res.setHeader("Content-Length", finalRes.headers["content-length"]);
          finalRes.pipe(res);
        }).on("error", (e) => res.status(500).json({ error: String(e) }));
        return;
      }
      res.setHeader("Content-Type", "application/octet-stream");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      if (proxyRes.headers["content-length"]) res.setHeader("Content-Length", proxyRes.headers["content-length"]);
      proxyRes.pipe(res);
    });
    proxyReq.on("error", (e) => res.status(500).json({ error: String(e) }));
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

async function getDirectDownloadUrl(assetId: number): Promise<string> {
  const url = `https://api.github.com/repos/${GITHUB_REPO}/releases/assets/${assetId}`;
  const headers = { ...ghHeaders(), Accept: "application/octet-stream" };
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers }, (res) => {
      if (res.statusCode === 302 && res.headers.location) {
        resolve(res.headers.location);
      } else {
        reject(new Error(`Expected redirect, got ${res.statusCode}`));
      }
      res.resume();
    });
    req.on("error", reject);
  });
}

router.get("/download/direct-url", async (_req: Request, res: Response) => {
  try {
    const release = await fetchLatestRelease();
    const setupAsset = getSetupAsset(release.assets ?? []);
    const portableAsset = (release.assets ?? []).find((a: any) => a.name.includes("Portable") && a.name.endsWith(".exe"));
    const setupUrl = setupAsset ? await getDirectDownloadUrl(setupAsset.id) : null;
    const portableUrl = portableAsset ? await getDirectDownloadUrl(portableAsset.id) : null;
    res.json({ version: release.tag_name, setup: { url: setupUrl, name: setupAsset?.name, sizeMB: setupAsset ? Math.round(setupAsset.size / 1024 / 1024) : null }, portable: { url: portableUrl, name: portableAsset?.name, sizeMB: portableAsset ? Math.round(portableAsset.size / 1024 / 1024) : null } });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.get("/install", async (_req: Request, res: Response) => {
  try {
    const release = await fetchLatestRelease();

    const tag = release.tag_name ?? "v2.2.18";
    const asset = getSetupAsset(release.assets ?? []);
    let url: string;
    try {
      url = asset ? await getDirectDownloadUrl(asset.id) : `https://github.com/${GITHUB_REPO}/releases/download/${tag}/SAI-Rolotech-Smart-Engines-Setup-${tag.replace("v", "")}.exe`;
    } catch {
      url = asset ? proxyUrl(_req, asset) : `https://github.com/${GITHUB_REPO}/releases/download/${tag}/SAI-Rolotech-Smart-Engines-Setup-${tag.replace("v", "")}.exe`;
    }
    const sizeMB = asset ? Math.round(asset.size / 1024 / 1024) : 83;

    const ps1 = `
Write-Host ""
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "  SAI Rolotech Smart Engines Update      " -ForegroundColor Cyan
Write-Host "  Version: ${tag}  (~${sizeMB}MB)        " -ForegroundColor White
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "[1/4] Purani SAI app band kar raha hun..." -ForegroundColor Yellow
$exactNames = @("SAI Rolotech Smart Engines","Sai Rolotech Smart Engines","SaiRolotech-SmartEngines","SAI-Rolotech-Smart-Engines")
foreach ($n in $exactNames) { Get-Process -Name $n -EA SilentlyContinue | Stop-Process -Force -EA SilentlyContinue }
Get-Process | Where-Object { $_.MainWindowTitle -like "*SAI Rolotech*" } | Stop-Process -Force -EA SilentlyContinue
Start-Sleep -Seconds 2
Write-Host "      Done." -ForegroundColor Green

Write-Host "[2/4] Purane installer files Desktop se hata raha hun..." -ForegroundColor Yellow
Get-ChildItem "$env:USERPROFILE\\Desktop" -Filter "SAI*.exe" -EA SilentlyContinue | Remove-Item -Force -EA SilentlyContinue
Get-ChildItem "$env:USERPROFILE\\Desktop" -Filter "SAI-*.exe" -EA SilentlyContinue | Remove-Item -Force -EA SilentlyContinue
Write-Host "      Done." -ForegroundColor Green

Write-Host "[3/4] ${tag} Setup download ho raha hai..." -ForegroundColor Yellow
$f = "$env:TEMP\\SAI-Setup-${tag}.exe"
Invoke-WebRequest "${url}" -OutFile $f -UseBasicParsing
Write-Host "      Download complete!" -ForegroundColor Green

Write-Host "[4/4] Install ho raha hai..." -ForegroundColor Yellow
Start-Process $f -Wait
Write-Host ""
Write-Host "=========================================" -ForegroundColor Green
Write-Host "  ${tag} install ho gaya!               " -ForegroundColor Green
Write-Host "  Desktop ke naye shortcut se kholen    " -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Green
`.trim();

    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.send(ps1);
  } catch (err) {
    res.status(500).send(`Write-Host "Error: ${err}" -ForegroundColor Red`);
  }
});

// ── Direct download redirect — one click, installer starts automatically ──────
// Visit: /api/download → browser auto-downloads latest Setup.exe
router.get("/download", async (_req: Request, res: Response) => {
  try {
    const release = await fetchLatestRelease();
    const asset = getSetupAsset(release.assets ?? []);
    if (!asset) { res.status(404).json({ error: "Installer not found" }); return; }
    const directUrl = await getDirectDownloadUrl(asset.id);
    res.redirect(302, directUrl);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.get("/download-page", async (_req: Request, res: Response) => {
  try {
    const release = await fetchLatestRelease();

    const tag = release.tag_name ?? "v2.2.18";
    const setupAsset   = getSetupAsset(release.assets ?? []);
    const portableAsset = (release.assets ?? []).find((a: any) => a.name.includes("Portable") && a.name.endsWith(".exe"));
    const setupUrl    = setupAsset ? await getDirectDownloadUrl(setupAsset.id) : "";
    const portableUrl = portableAsset ? await getDirectDownloadUrl(portableAsset.id) : "";
    const setupMB     = setupAsset    ? Math.round(setupAsset.size    / 1024 / 1024) : 83;
    const portableMB  = portableAsset ? Math.round(portableAsset.size / 1024 / 1024) : 83;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>SAI Rolotech Smart Engines — Download ${tag}</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{background:#070710;color:#e4e4e7;font-family:'Segoe UI',system-ui,sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}
    .card{background:#0f0f1a;border:1px solid rgba(249,115,22,0.25);border-radius:16px;padding:40px;max-width:480px;width:100%;text-align:center}
    .logo{font-size:28px;font-weight:800;color:#f97316;margin-bottom:6px}
    .sub{color:#71717a;font-size:13px;margin-bottom:32px}
    .badge{display:inline-block;background:rgba(249,115,22,0.15);color:#f97316;border:1px solid rgba(249,115,22,0.3);border-radius:20px;padding:4px 14px;font-size:12px;font-weight:600;margin-bottom:28px}
    .btn{display:block;width:100%;padding:14px 20px;border-radius:10px;font-size:15px;font-weight:700;text-decoration:none;margin-bottom:12px;transition:opacity 0.2s;cursor:pointer}
    .btn-primary{background:linear-gradient(135deg,#f97316,#d97706);color:#fff}
    .btn-secondary{background:rgba(255,255,255,0.05);color:#a1a1aa;border:1px solid rgba(255,255,255,0.1)}
    .btn:hover{opacity:0.85}
    .info{color:#52525b;font-size:11px;margin-top:20px;line-height:1.8}
    .progress{display:none;margin-top:20px}
    .bar-wrap{height:6px;background:rgba(249,115,22,0.1);border-radius:3px;overflow:hidden;margin-top:8px}
    .bar{height:100%;width:0%;background:linear-gradient(90deg,#f97316,#fbbf24);border-radius:3px;transition:width 0.3s}
    .dl-msg{color:#f97316;font-size:12px;margin-top:8px}
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">SAI Rolotech Smart Engines</div>
    <div class="sub">Roll Forming Engineering Suite</div>
    <span class="badge">${tag} — Latest Version</span>

    <a class="btn btn-primary" href="${setupUrl}" id="mainDl" download>
      ⬇ Setup Installer Download (~${setupMB} MB)
    </a>
    <a class="btn btn-secondary" href="${portableUrl}" download>
      📦 Portable Version (~${portableMB} MB)
    </a>

    <div class="progress" id="dlProgress">
      <div class="dl-msg">Download shuru ho gaya...</div>
      <div class="bar-wrap"><div class="bar" id="bar"></div></div>
    </div>

    <div class="info">
      ✅ Koi product key nahi chahiye<br>
      ✅ Silent install — koi popup nahi<br>
      ✅ Desktop shortcut automatically banega<br>
      ✅ Auto-update — nayi version apne aap aayegi
    </div>
  </div>
  <script>
    // Auto-trigger Setup download on page load
    window.addEventListener('load', () => {
      setTimeout(() => {
        document.getElementById('dlProgress').style.display = 'block';
        const link = document.createElement('a');
        link.href = '${setupUrl}';
        link.download = '';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }, 800);
    });
  </script>
</body>
</html>`;

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  } catch (err) {
    res.status(500).send(`<h1>Error: ${err}</h1>`);
  }
});

// JSON info endpoint
router.get("/install/info", async (req: Request, res: Response) => {
  try {
    const release = await fetchLatestRelease();
    const asset = getSetupAsset(release.assets ?? []);
    res.json({
      version: release.tag_name,
      name: release.name,
      publishedAt: release.published_at,
      downloadUrl: asset ? proxyUrl(req, asset) : null,
      fileName: asset?.name,
      sizeMB: asset ? Math.round(asset.size / 1024 / 1024) : null,
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ── irm | iex clean install endpoint ─────────────────────────────────────────
// PowerShell one-liner: irm https://<domain>/api/install/clean | iex
router.get("/install/clean", (req: Request, res: Response) => {
  const host = (req.headers["x-forwarded-host"] ?? req.headers.host ?? "localhost:5000") as string;
  const proto = (req.headers["x-forwarded-proto"] ?? "https") as string;
  const appUrl = `${proto}://${host}`;

  const script = `
$ErrorActionPreference = "SilentlyContinue"
Write-Host ""
Write-Host "================================================" -ForegroundColor Red
Write-Host "  SAI ROLOTECH — PURA SAAF + NAYA INSTALL" -ForegroundColor Yellow
Write-Host "================================================" -ForegroundColor Red
Write-Host ""

Write-Host "[1/5] Purane processes band kar raha hun..." -ForegroundColor Yellow
@("SAI Rolotech Smart Engines","SaiRolotech","sai-rolotech","electron","node") | ForEach-Object {
    Get-Process -Name $_ -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
}
Start-Sleep -Seconds 2
Write-Host "  Done!" -ForegroundColor Green

Write-Host "[2/5] Registry se uninstall kar raha hun..." -ForegroundColor Yellow
@("HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall","HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall","HKLM:\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall") | ForEach-Object {
    if (Test-Path $_) {
        Get-ChildItem $_ | ForEach-Object {
            $dn = (Get-ItemProperty $_.PSPath -ErrorAction SilentlyContinue).DisplayName
            if ($dn -like "*SAI*" -or $dn -like "*Rolotech*") {
                $us = (Get-ItemProperty $_.PSPath -ErrorAction SilentlyContinue).UninstallString
                if ($us) { if ($us -like "*MsiExec*") { Start-Process msiexec.exe -ArgumentList "/x $($us -replace 'MsiExec.exe /[IX]','') /quiet /norestart" -Wait -EA SilentlyContinue } else { Start-Process ($us -replace '"','') -ArgumentList "/S" -Wait -EA SilentlyContinue } }
                Remove-Item $_.PSPath -Recurse -Force -EA SilentlyContinue
                Write-Host "  Uninstall: $dn" -ForegroundColor Cyan
            }
        }
    }
}
Write-Host "  Done!" -ForegroundColor Green

Write-Host "[3/5] Purane folders aur shortcuts hata raha hun..." -ForegroundColor Yellow
@("$env:LOCALAPPDATA\\SAI-Rolotech","$env:LOCALAPPDATA\\sai-rolotech-smart-engines","$env:LOCALAPPDATA\\SAI Rolotech Smart Engines","$env:APPDATA\\SAI-Rolotech","$env:PROGRAMFILES\\SAI Rolotech Smart Engines","$env:PROGRAMFILES(X86)\\SAI Rolotech Smart Engines","C:\\SAI-Rolotech","$env:USERPROFILE\\SAI-Rolotech") | ForEach-Object {
    if (Test-Path $_) { Remove-Item $_ -Recurse -Force -EA SilentlyContinue; Write-Host "  Hata: $_" -ForegroundColor DarkGray }
}
@("$env:USERPROFILE\\Desktop\\SAI Rolotech Smart Engines.lnk","$env:USERPROFILE\\Desktop\\SAI-Rolotech.lnk","$env:APPDATA\\Microsoft\\Windows\\Start Menu\\Programs\\SAI Rolotech Smart Engines.lnk") | ForEach-Object {
    if (Test-Path $_) { Remove-Item $_ -Force -EA SilentlyContinue }
}
@("$env:APPDATA\\Microsoft\\Windows\\Start Menu\\Programs\\SAI Rolotech Smart Engines","$env:PROGRAMDATA\\Microsoft\\Windows\\Start Menu\\Programs\\SAI Rolotech Smart Engines") | ForEach-Object {
    if (Test-Path $_) { Remove-Item $_ -Recurse -Force -EA SilentlyContinue }
}
Write-Host "  Done!" -ForegroundColor Green

Write-Host "[4/5] Naya Desktop shortcut bana raha hun..." -ForegroundColor Yellow
$AppUrl = "${appUrl}"
$WshShell = New-Object -comObject WScript.Shell
$lnk = $WshShell.CreateShortcut("$env:USERPROFILE\\Desktop\\SAI Rolotech Smart Engines.lnk")
$chrome = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
$edge   = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"
if (Test-Path $chrome) { $lnk.TargetPath = $chrome; $lnk.Arguments = "--app=\`"$AppUrl\`" --window-size=1440,900" }
elseif (Test-Path $edge) { $lnk.TargetPath = $edge; $lnk.Arguments = "--app=\`"$AppUrl\`" --window-size=1440,900" }
else { $lnk.TargetPath = "explorer.exe"; $lnk.Arguments = $AppUrl }
$lnk.Description = "SAI Rolotech Smart Engines v2.2"
$lnk.Save()
Write-Host "  Desktop shortcut bana diya!" -ForegroundColor Green

Write-Host "[5/5] Browser mein latest version khol raha hun..." -ForegroundColor Yellow
Start-Process $AppUrl
Start-Sleep -Seconds 1

Write-Host ""
Write-Host "================================================" -ForegroundColor Green
Write-Host "  COMPLETE! Purana hata, naya install ho gaya!" -ForegroundColor Green
Write-Host "  URL: $AppUrl" -ForegroundColor Cyan
Write-Host "  Desktop shortcut ready!" -ForegroundColor White
Write-Host "================================================" -ForegroundColor Green
`.trim();

  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-store");
  res.send(script);
});

// ── Script download endpoints — browser-safe, no Blob needed ─────────────────
// GET /api/download-script/clean  → SAI-PuraSaaf-NayaInstall.ps1
// GET /api/download-script/fresh  → SAI-Install-Windows.ps1
// GET /api/download-script/shortcut → shortcut-only .ps1

function getAppUrl(req: Request): string {
  const host = req.headers["x-forwarded-host"] ?? req.headers.host ?? "localhost:5000";
  const proto = req.headers["x-forwarded-proto"] ?? "https";
  return `${proto}://${host}`;
}

router.get("/download-script/clean", (req: Request, res: Response) => {
  const appUrl = getAppUrl(req);
  const script = `# SAI Rolotech Smart Engines — PURA SAAF + NAYA INSTALL
# PowerShell Script v2.2 — Ek baar chalao, hamesha ke liye theek
# Right-click → "Run with PowerShell" → Yes (Admin allow karo)

$ErrorActionPreference = "SilentlyContinue"
$AppName = "SAI Rolotech Smart Engines"
$AppUrl  = "${appUrl}"

Write-Host ""
Write-Host "============================================================" -ForegroundColor Red
Write-Host "  SAI ROLOTECH — PURA SAAF + NAYA INSTALL" -ForegroundColor Yellow
Write-Host "  Purana version hata ke bilkul fresh install karega" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Red
Write-Host ""
Start-Sleep -Seconds 1

# ── 1: Saare processes band karo ─────────────────────────────────────────────
Write-Host "[1/6] Purane app processes band kar raha hun..." -ForegroundColor Yellow
$processNames = @("SAI Rolotech Smart Engines","SaiRolotech","sai-rolotech","electron","node","SAI-Rolotech")
foreach ($proc in $processNames) {
    Get-Process -Name $proc -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
}
Start-Sleep -Seconds 2
Write-Host "  Processes band!" -ForegroundColor Green

# ── 2: Registry se uninstall karo ────────────────────────────────────────────
Write-Host "[2/6] Windows Programs list se uninstall kar raha hun..." -ForegroundColor Yellow
$uninstallPaths = @(
    "HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall",
    "HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall",
    "HKLM:\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall"
)
foreach ($regPath in $uninstallPaths) {
    if (Test-Path $regPath) {
        Get-ChildItem $regPath | ForEach-Object {
            $displayName = (Get-ItemProperty $_.PSPath -ErrorAction SilentlyContinue).DisplayName
            if ($displayName -like "*SAI*" -or $displayName -like "*Rolotech*") {
                $uninstallStr = (Get-ItemProperty $_.PSPath -ErrorAction SilentlyContinue).UninstallString
                Write-Host "  Mila: $displayName" -ForegroundColor Cyan
                if ($uninstallStr) {
                    if ($uninstallStr -like "*MsiExec*") {
                        $msiCode = $uninstallStr -replace "MsiExec.exe /I","" -replace "MsiExec.exe /X",""
                        Start-Process "msiexec.exe" -ArgumentList "/x $msiCode /quiet /norestart" -Wait -ErrorAction SilentlyContinue
                    } else {
                        Start-Process ($uninstallStr -replace '"','') -ArgumentList "/S /silent" -Wait -ErrorAction SilentlyContinue
                    }
                }
                Remove-Item $_.PSPath -Recurse -Force -ErrorAction SilentlyContinue
            }
        }
    }
}
Write-Host "  Registry saaf!" -ForegroundColor Green

# ── 3: Purane folders hato ───────────────────────────────────────────────────
Write-Host "[3/6] Purane folders hata raha hun..." -ForegroundColor Yellow
$dirsToRemove = @(
    "$env:LOCALAPPDATA\\SAI-Rolotech",
    "$env:LOCALAPPDATA\\sai-rolotech-smart-engines",
    "$env:LOCALAPPDATA\\SAI Rolotech Smart Engines",
    "$env:APPDATA\\SAI-Rolotech",
    "$env:APPDATA\\sai-rolotech-smart-engines",
    "$env:PROGRAMFILES\\SAI-Rolotech",
    "$env:PROGRAMFILES\\SAI Rolotech Smart Engines",
    "$env:PROGRAMFILES(X86)\\SAI-Rolotech",
    "C:\\SAI-Rolotech",
    "$env:USERPROFILE\\SAI-Rolotech"
)
foreach ($dir in $dirsToRemove) {
    if (Test-Path $dir) {
        Remove-Item $dir -Recurse -Force -ErrorAction SilentlyContinue
        Write-Host "  Hata diya: $dir" -ForegroundColor Green
    }
}
Write-Host "  Folders saaf!" -ForegroundColor Green

# ── 4: Purane shortcuts hato ─────────────────────────────────────────────────
Write-Host "[4/6] Purane shortcuts hata raha hun..." -ForegroundColor Yellow
$shortcuts = @(
    "$env:USERPROFILE\\Desktop\\SAI Rolotech Smart Engines.lnk",
    "$env:USERPROFILE\\Desktop\\SAI-Rolotech.lnk",
    "$env:APPDATA\\Microsoft\\Windows\\Start Menu\\Programs\\SAI Rolotech Smart Engines.lnk",
    "$env:APPDATA\\Microsoft\\Windows\\Start Menu\\Programs\\SAI Rolotech Smart Engines\\SAI Rolotech Smart Engines.lnk",
    "$env:PROGRAMDATA\\Microsoft\\Windows\\Start Menu\\Programs\\SAI Rolotech Smart Engines.lnk"
)
foreach ($lnk in $shortcuts) {
    if (Test-Path $lnk) { Remove-Item $lnk -Force -ErrorAction SilentlyContinue }
}
foreach ($smDir in @("$env:APPDATA\\Microsoft\\Windows\\Start Menu\\Programs\\SAI Rolotech Smart Engines","$env:PROGRAMDATA\\Microsoft\\Windows\\Start Menu\\Programs\\SAI Rolotech Smart Engines")) {
    if (Test-Path $smDir) { Remove-Item $smDir -Recurse -Force -ErrorAction SilentlyContinue }
}
Write-Host "  Shortcuts saaf!" -ForegroundColor Green

# ── 5: Naya Desktop shortcut banao (browser-based — hamesha latest) ──────────
Write-Host "[5/6] Naya shortcut bana raha hun..." -ForegroundColor Yellow
$WshShell = New-Object -comObject WScript.Shell

$Shortcut = $WshShell.CreateShortcut("$env:USERPROFILE\\Desktop\\SAI Rolotech Smart Engines.lnk")
$Shortcut.TargetPath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
$Shortcut.Arguments  = "--app=\`"$AppUrl\`" --window-size=1440,900"
$Shortcut.Description = "SAI Rolotech Smart Engines — Roll Forming Suite"
if (-not (Test-Path $Shortcut.TargetPath)) {
    $Shortcut.TargetPath = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"
    $Shortcut.Arguments  = "--app=\`"$AppUrl\`" --window-size=1440,900"
}
if (-not (Test-Path $Shortcut.TargetPath)) {
    $Shortcut.TargetPath = "explorer.exe"
    $Shortcut.Arguments  = "$AppUrl"
}
$Shortcut.Save()

$ShortcutSM = $WshShell.CreateShortcut("$env:APPDATA\\Microsoft\\Windows\\Start Menu\\Programs\\SAI Rolotech Smart Engines.lnk")
$ShortcutSM.TargetPath = $Shortcut.TargetPath
$ShortcutSM.Arguments  = $Shortcut.Arguments
$ShortcutSM.Description = "SAI Rolotech Smart Engines"
$ShortcutSM.Save()
Write-Host "  Shortcut bana diya!" -ForegroundColor Green

# ── 6: Browser mein seedha kholo ─────────────────────────────────────────────
Write-Host "[6/6] Browser mein app khol raha hun..." -ForegroundColor Yellow
Start-Process $AppUrl
Start-Sleep -Seconds 2

Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
Write-Host "  PURA SAAF + FRESH INSTALL COMPLETE!" -ForegroundColor Green
Write-Host "  Desktop shortcut bana diya: SAI Rolotech Smart Engines" -ForegroundColor White
Write-Host "  App URL: $AppUrl" -ForegroundColor Cyan
Write-Host "  Ab Desktop shortcut double-click karo!" -ForegroundColor Yellow
Write-Host "  Hamesha latest version milega — koi manual update nahi" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
Write-Host ""
Pause
`;

  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="SAI-PuraSaaf-NayaInstall.ps1"');
  res.setHeader("Cache-Control", "no-cache");
  res.send(script);
});

router.get("/download-script/fresh", (req: Request, res: Response) => {
  const appUrl = getAppUrl(req);
  const script = `# SAI Rolotech Smart Engines — Windows Quick Install
# PowerShell Script — Right-click → Run with PowerShell → Yes

$AppUrl = "${appUrl}"
Write-Host "====================================================" -ForegroundColor Cyan
Write-Host "  SAI Rolotech Smart Engines — Quick Install" -ForegroundColor Yellow
Write-Host "====================================================" -ForegroundColor Cyan

# Desktop shortcut banao
Write-Host "[1/2] Desktop shortcut bana raha hun..." -ForegroundColor Yellow
$WshShell = New-Object -comObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut("$env:USERPROFILE\\Desktop\\SAI Rolotech Smart Engines.lnk")
$chromeExe = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
$edgeExe   = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"
if (Test-Path $chromeExe) {
    $Shortcut.TargetPath = $chromeExe
    $Shortcut.Arguments  = "--app=\`"$AppUrl\`" --window-size=1440,900"
} elseif (Test-Path $edgeExe) {
    $Shortcut.TargetPath = $edgeExe
    $Shortcut.Arguments  = "--app=\`"$AppUrl\`" --window-size=1440,900"
} else {
    $Shortcut.TargetPath = "explorer.exe"
    $Shortcut.Arguments  = "$AppUrl"
}
$Shortcut.Description = "SAI Rolotech Smart Engines v2.2"
$Shortcut.Save()
Write-Host "  Desktop shortcut bana diya!" -ForegroundColor Green

# Browser mein kholo
Write-Host "[2/2] App browser mein khol raha hun..." -ForegroundColor Yellow
Start-Process $AppUrl

Write-Host ""
Write-Host "====================================================" -ForegroundColor Green
Write-Host "  INSTALL COMPLETE!" -ForegroundColor Green
Write-Host "  Desktop shortcut se seedha khulega SAI!" -ForegroundColor White
Write-Host "====================================================" -ForegroundColor Green
Pause
`;

  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="SAI-Install-Windows.ps1"');
  res.setHeader("Cache-Control", "no-cache");
  res.send(script);
});

export default router;
