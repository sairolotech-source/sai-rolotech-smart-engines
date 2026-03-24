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
