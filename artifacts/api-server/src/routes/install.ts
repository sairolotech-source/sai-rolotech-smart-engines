import { Router, type Request, type Response } from "express";

const router = Router();
const GITHUB_REPO = "sairolotech-source/sai-rolotech-smart-engines";

function getSetupAsset(assets: { name: string; browser_download_url: string; size: number }[]) {
  // Always prefer "Setup" installer — never Portable
  return assets?.find((a) => a.name.includes("Setup") && a.name.endsWith(".exe"))
    ?? assets?.find((a) => a.name.endsWith(".exe") && !a.name.endsWith(".blockmap") && !a.name.includes("Portable"));
}

// Public endpoint — no auth required
// PowerShell (as Admin): irm https://<domain>:8080/api/install | iex
router.get("/install", async (_req: Request, res: Response) => {
  try {
    const ghRes = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, {
      headers: { "User-Agent": "SAI-Rolotech-UpdateAgent/1.0" }
    });
    const release = await ghRes.json() as {
      tag_name: string;
      assets: { name: string; browser_download_url: string; size: number }[];
    };

    const tag = release.tag_name ?? "v2.2.11";
    const asset = getSetupAsset(release.assets ?? []);
    const url = asset?.browser_download_url ??
      `https://github.com/${GITHUB_REPO}/releases/download/${tag}/SAI-Rolotech-Smart-Engines-Setup-${tag.replace("v", "")}.exe`;
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
    const ghRes = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, {
      headers: { "User-Agent": "SAI-Rolotech-UpdateAgent/1.0" }
    });
    const release = await ghRes.json() as {
      tag_name: string;
      assets: { name: string; browser_download_url: string; size: number }[];
    };
    const asset = getSetupAsset(release.assets ?? []);
    if (!asset) {
      res.status(404).json({ error: "Installer not found in latest release" });
      return;
    }
    // Redirect directly to GitHub download → browser auto-downloads
    res.redirect(302, asset.browser_download_url);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ── Download page — HTML page with auto-download + all file links ─────────────
router.get("/download-page", async (_req: Request, res: Response) => {
  try {
    const ghRes = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, {
      headers: { "User-Agent": "SAI-Rolotech-UpdateAgent/1.0" }
    });
    const release = await ghRes.json() as {
      tag_name: string;
      name: string;
      assets: { name: string; browser_download_url: string; size: number }[];
    };

    const tag = release.tag_name ?? "v2.2.15";
    const setupAsset   = getSetupAsset(release.assets ?? []);
    const portableAsset = release.assets?.find(a => a.name.includes("Portable") && a.name.endsWith(".exe"));
    const setupUrl    = setupAsset?.browser_download_url ?? "";
    const portableUrl = portableAsset?.browser_download_url ?? "";
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
router.get("/install/info", async (_req: Request, res: Response) => {
  try {
    const ghRes = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, {
      headers: { "User-Agent": "SAI-Rolotech-UpdateAgent/1.0" }
    });
    const release = await ghRes.json() as {
      tag_name: string; name: string; published_at: string;
      assets: { name: string; browser_download_url: string; size: number }[];
    };
    const asset = getSetupAsset(release.assets ?? []);
    res.json({
      version: release.tag_name,
      name: release.name,
      publishedAt: release.published_at,
      downloadUrl: asset?.browser_download_url,
      fileName: asset?.name,
      sizeMB: asset ? Math.round(asset.size / 1024 / 1024) : null,
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
