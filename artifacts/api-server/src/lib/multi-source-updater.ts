/**
 * Multi-Source Updater — agar GitHub fail ho tab bhi update milega
 *
 * Priority order:
 *   1. git pull (standard)
 *   2. GitHub Archive ZIP download (HTTPS, git protocol bypass)
 *   3. Google Drive archive (user-uploaded backup package)
 */

import { exec } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs";
import https from "https";
import { ReplitConnectors } from "@replit/connectors-sdk";

const execAsync = promisify(exec);

const REPO_ROOT = path.resolve("/home/runner/workspace");
const GITHUB_REPO = "sairolotech-source/sai-rolotech-smart-engines";

export type UpdateSource = "git-pull" | "github-archive" | "google-drive";

export interface UpdateAttempt {
  source: UpdateSource;
  ok: boolean;
  message: string;
  filesChanged?: number;
}

export interface MultiSourceResult {
  updated: boolean;
  sourceUsed: UpdateSource | null;
  attempts: UpdateAttempt[];
  finalMessage: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildGitEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env, GIT_TERMINAL_PROMPT: "0" };
  if (process.env["REPLIT_SESSION"]) {
    env["REPLIT_SESSION"] = process.env["REPLIT_SESSION"];
    env["REPLIT_ASKPASS_PID2_SESSION"] = process.env["REPLIT_SESSION"];
  }
  if (process.env["GIT_ASKPASS"]) env["GIT_ASKPASS"] = process.env["GIT_ASKPASS"];
  return env;
}

async function runGit(cmd: string): Promise<{ stdout: string; stderr: string; ok: boolean }> {
  try {
    const { stdout, stderr } = await execAsync(`git -C "${REPO_ROOT}" ${cmd}`, {
      timeout: 45000,
      env: buildGitEnv(),
    });
    return { stdout: stdout.trim(), stderr: stderr.trim(), ok: true };
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; message?: string };
    return { stdout: e.stdout?.trim() ?? "", stderr: e.stderr?.trim() ?? e.message ?? "unknown", ok: false };
  }
}

async function runShell(cmd: string, timeoutMs = 120000): Promise<{ stdout: string; ok: boolean }> {
  try {
    const { stdout } = await execAsync(cmd, { timeout: timeoutMs, cwd: REPO_ROOT, env: { ...process.env } });
    return { stdout: stdout.trim(), ok: true };
  } catch (err: unknown) {
    const e = err as { stdout?: string; message?: string };
    return { stdout: e.stdout?.trim() ?? e.message ?? "error", ok: false };
  }
}

function httpsGet(url: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { "User-Agent": "SAI-Rolotech-Updater/2.0" } }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        resolve(httpsGet(res.headers.location!));
        res.resume();
        return;
      }
      if (!res.statusCode || res.statusCode >= 400) {
        reject(new Error(`HTTP ${res.statusCode}`));
        res.resume();
        return;
      }
      const chunks: Buffer[] = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => resolve(Buffer.concat(chunks)));
      res.on("error", reject);
    });
    req.on("error", reject);
    req.setTimeout(60000, () => { req.destroy(); reject(new Error("HTTPS timeout")); });
  });
}

// ── Source 1: Standard Git Pull ───────────────────────────────────────────────

export async function tryGitPull(): Promise<UpdateAttempt> {
  try {
    const localRes = await runGit("rev-parse HEAD");
    const localCommit = localRes.stdout.slice(0, 10);

    const fetchRes = await runGit("fetch origin main --prune");
    if (!fetchRes.ok) {
      return {
        source: "git-pull",
        ok: false,
        message: `git fetch failed: ${fetchRes.stderr.slice(0, 200)}`,
      };
    }

    const behindRes = await runGit("rev-list HEAD..origin/main --count");
    const behindCount = parseInt(behindRes.stdout) || 0;

    if (behindCount === 0) {
      return { source: "git-pull", ok: true, message: "Already up to date (git)", filesChanged: 0 };
    }

    const lockPath = path.join(REPO_ROOT, ".git", "index.lock");
    if (fs.existsSync(lockPath)) {
      try { fs.unlinkSync(lockPath); } catch { /* ignore */ }
    }

    const localChangesRes = await runGit("diff --name-only");
    const hasLocalChanges = !!localChangesRes.stdout.trim();

    if (hasLocalChanges) {
      await runGit("reset --hard origin/main");
    } else {
      const pullRes = await runGit("pull origin main --ff-only");
      if (!pullRes.ok) {
        await runGit("reset --hard origin/main");
      }
    }

    const newCommit = (await runGit("rev-parse HEAD")).stdout.slice(0, 10);
    const pendingFiles = (await runGit("diff --name-only HEAD~1..HEAD")).stdout.split("\n").filter(Boolean);

    return {
      source: "git-pull",
      ok: true,
      message: `Git pull: ${localCommit} → ${newCommit} (${pendingFiles.length} files)`,
      filesChanged: pendingFiles.length,
    };
  } catch (err) {
    return { source: "git-pull", ok: false, message: String(err) };
  }
}

// ── Source 2: GitHub Archive ZIP (bypasses git protocol) ─────────────────────

export async function tryGitHubArchive(): Promise<UpdateAttempt> {
  const tmpDir = path.join(REPO_ROOT, ".tmp-update-archive");
  const zipPath = path.join(REPO_ROOT, ".tmp-archive.zip");

  try {
    const archiveUrl = `https://codeload.github.com/${GITHUB_REPO}/zip/refs/heads/main`;
    console.log(`[multi-updater] GitHub Archive download: ${archiveUrl}`);

    const zipBuffer = await httpsGet(archiveUrl);
    fs.writeFileSync(zipPath, zipBuffer);
    console.log(`[multi-updater] Archive downloaded: ${Math.round(zipBuffer.length / 1024)}KB`);

    if (fs.existsSync(tmpDir)) {
      await runShell(`rm -rf "${tmpDir}"`);
    }
    fs.mkdirSync(tmpDir, { recursive: true });

    const unzipRes = await runShell(`unzip -q "${zipPath}" -d "${tmpDir}"`, 60000);
    if (!unzipRes.ok) {
      return { source: "github-archive", ok: false, message: `Unzip failed: ${unzipRes.stdout.slice(0, 200)}` };
    }

    // GitHub archive puts files in a subfolder like "repo-main/"
    const [extractedFolder] = fs.readdirSync(tmpDir);
    if (!extractedFolder) {
      return { source: "github-archive", ok: false, message: "Archive extract empty" };
    }
    const srcDir = path.join(tmpDir, extractedFolder);

    // Sync files excluding .git, node_modules, .env files
    const rsyncRes = await runShell(
      `rsync -a --delete \
        --exclude='.git' \
        --exclude='node_modules' \
        --exclude='.env' \
        --exclude='.env.local' \
        --exclude='*.local' \
        "${srcDir}/" "${REPO_ROOT}/"`,
      60000,
    );

    if (!rsyncRes.ok) {
      return { source: "github-archive", ok: false, message: `rsync failed: ${rsyncRes.stdout.slice(0, 200)}` };
    }

    // Count changed files approximately
    const lsRes = await runShell(`find "${srcDir}" -type f | wc -l`);
    const fileCount = parseInt(lsRes.stdout) || 0;

    return {
      source: "github-archive",
      ok: true,
      message: `Archive sync complete — ${fileCount} files synced from GitHub`,
      filesChanged: fileCount,
    };
  } catch (err) {
    return { source: "github-archive", ok: false, message: String(err) };
  } finally {
    try {
      if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
      if (fs.existsSync(tmpDir)) await runShell(`rm -rf "${tmpDir}"`);
    } catch { /* cleanup ignore */ }
  }
}

// ── Source 3: Google Drive Archive ───────────────────────────────────────────

const DRIVE_UPDATE_FOLDER = "SAI-Rolotech-Updates";
const DRIVE_MANIFEST_NAME = "update-manifest.json";

export interface DriveUpdateManifest {
  version: string;
  timestamp: string;
  archiveName: string;
  archiveFileId: string;
  sha256?: string;
}

export async function getDriveManifest(): Promise<DriveUpdateManifest | null> {
  try {
    const connectors = new ReplitConnectors();

    // Find the folder
    const folderRes = await connectors.proxy(
      "google-drive",
      `/drive/v3/files?q=${encodeURIComponent(`name='${DRIVE_UPDATE_FOLDER}' and mimeType='application/vnd.google-apps.folder' and trashed=false`)}&fields=files(id,name)`,
      { method: "GET" }
    );
    const folderData = await folderRes.json() as { files?: { id: string }[] };
    if (!folderData.files?.length) return null;

    const folderId = folderData.files[0].id;

    // Find manifest JSON
    const manifestRes = await connectors.proxy(
      "google-drive",
      `/drive/v3/files?q=${encodeURIComponent(`name='${DRIVE_MANIFEST_NAME}' and '${folderId}' in parents and trashed=false`)}&fields=files(id,name)`,
      { method: "GET" }
    );
    const manifestData = await manifestRes.json() as { files?: { id: string }[] };
    if (!manifestData.files?.length) return null;

    const fileId = manifestData.files[0].id;
    const contentRes = await connectors.proxy(
      "google-drive",
      `/drive/v3/files/${fileId}?alt=media`,
      { method: "GET" }
    );
    const manifest = await contentRes.json() as DriveUpdateManifest;
    return manifest;
  } catch {
    return null;
  }
}

export async function tryGoogleDriveUpdate(): Promise<UpdateAttempt> {
  const tmpDir = path.join(REPO_ROOT, ".tmp-drive-update");
  const zipPath = path.join(REPO_ROOT, ".tmp-drive-archive.zip");

  try {
    const connectors = new ReplitConnectors();
    const manifest = await getDriveManifest();
    if (!manifest) {
      return { source: "google-drive", ok: false, message: "No update package found in Google Drive" };
    }

    console.log(`[multi-updater] Drive manifest found: v${manifest.version} — ${manifest.archiveName}`);

    // Download the archive
    const fileRes = await connectors.proxy(
      "google-drive",
      `/drive/v3/files/${manifest.archiveFileId}?alt=media`,
      { method: "GET" }
    );

    const arrayBuffer = await fileRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    fs.writeFileSync(zipPath, buffer);

    if (fs.existsSync(tmpDir)) await runShell(`rm -rf "${tmpDir}"`);
    fs.mkdirSync(tmpDir, { recursive: true });

    const unzipRes = await runShell(`unzip -q "${zipPath}" -d "${tmpDir}"`, 60000);
    if (!unzipRes.ok) {
      return { source: "google-drive", ok: false, message: `Drive archive unzip failed: ${unzipRes.stdout.slice(0, 200)}` };
    }

    const entries = fs.readdirSync(tmpDir);
    const srcDir = entries.length === 1 && fs.statSync(path.join(tmpDir, entries[0])).isDirectory()
      ? path.join(tmpDir, entries[0])
      : tmpDir;

    const rsyncRes = await runShell(
      `rsync -a --delete \
        --exclude='.git' \
        --exclude='node_modules' \
        --exclude='.env' \
        --exclude='.env.local' \
        "${srcDir}/" "${REPO_ROOT}/"`,
      60000,
    );

    if (!rsyncRes.ok) {
      return { source: "google-drive", ok: false, message: `Drive rsync failed: ${rsyncRes.stdout.slice(0, 200)}` };
    }

    return {
      source: "google-drive",
      ok: true,
      message: `Google Drive update v${manifest.version} applied — ${manifest.archiveName}`,
    };
  } catch (err) {
    return { source: "google-drive", ok: false, message: String(err) };
  } finally {
    try {
      if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
      if (fs.existsSync(tmpDir)) await runShell(`rm -rf "${tmpDir}"`);
    } catch { /* cleanup */ }
  }
}

// ── Upload current code to Google Drive as update package ────────────────────

export async function uploadUpdateToDrive(version: string): Promise<{ ok: boolean; message: string; fileId?: string }> {
  const zipPath = path.join(REPO_ROOT, `.tmp-upload-${Date.now()}.zip`);

  try {
    const connectors = new ReplitConnectors();

    // Create ZIP of the project (excluding node_modules, .git, etc.)
    const zipCmd = `cd "${REPO_ROOT}" && zip -r "${zipPath}" . \
      --exclude "*/node_modules/*" \
      --exclude ".git/*" \
      --exclude ".env" \
      --exclude ".env.local" \
      --exclude "*.local" \
      --exclude ".tmp-*"`;

    const zipRes = await runShell(zipCmd, 120000);
    if (!zipRes.ok) {
      return { ok: false, message: `ZIP creation failed: ${zipRes.stdout.slice(0, 200)}` };
    }

    const zipBuffer = fs.readFileSync(zipPath);
    const sizeMB = Math.round(zipBuffer.length / 1024 / 1024);
    console.log(`[multi-updater] Upload archive size: ${sizeMB}MB`);

    // Find or create folder
    const folderRes = await connectors.proxy(
      "google-drive",
      `/drive/v3/files?q=${encodeURIComponent(`name='${DRIVE_UPDATE_FOLDER}' and mimeType='application/vnd.google-apps.folder' and trashed=false`)}&fields=files(id,name)`,
      { method: "GET" }
    );
    const folderData = await folderRes.json() as { files?: { id: string }[] };

    let folderId: string;
    if (folderData.files?.length) {
      folderId = folderData.files[0].id;
    } else {
      const createRes = await connectors.proxy(
        "google-drive",
        "/drive/v3/files",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: DRIVE_UPDATE_FOLDER, mimeType: "application/vnd.google-apps.folder" }),
        }
      );
      const createData = await createRes.json() as { id: string };
      folderId = createData.id;
    }

    // Upload ZIP file using multipart upload
    const archiveName = `sai-rolotech-${version}-${Date.now()}.zip`;
    const boundary = `----SAIRolotechBoundary${Date.now()}`;
    const metadata = JSON.stringify({ name: archiveName, parents: [folderId] });
    const metaPart = Buffer.from(
      `--${boundary}\r\nContent-Type: application/json\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: application/zip\r\n\r\n`
    );
    const endPart = Buffer.from(`\r\n--${boundary}--`);
    const body = Buffer.concat([metaPart, zipBuffer, endPart]);

    const uploadRes = await connectors.proxy(
      "google-drive",
      "/upload/drive/v3/files?uploadType=multipart",
      {
        method: "POST",
        headers: { "Content-Type": `multipart/related; boundary="${boundary}"` },
        body,
      }
    );

    const uploadData = await uploadRes.json() as { id?: string; error?: { message: string } };
    if (!uploadData.id) {
      return { ok: false, message: `Upload failed: ${uploadData.error?.message ?? "unknown"}` };
    }

    // Save manifest
    const manifest: DriveUpdateManifest = {
      version,
      timestamp: new Date().toISOString(),
      archiveName,
      archiveFileId: uploadData.id,
    };

    const manifestBoundary = `----SAIManifestBoundary${Date.now()}`;
    const manifestJson = JSON.stringify(manifest, null, 2);
    const manifestMetadata = JSON.stringify({ name: DRIVE_MANIFEST_NAME, parents: [folderId] });
    const mMetaPart = Buffer.from(
      `--${manifestBoundary}\r\nContent-Type: application/json\r\n\r\n${manifestMetadata}\r\n--${manifestBoundary}\r\nContent-Type: application/json\r\n\r\n${manifestJson}\r\n--${manifestBoundary}--`
    );

    await connectors.proxy(
      "google-drive",
      "/upload/drive/v3/files?uploadType=multipart",
      {
        method: "POST",
        headers: { "Content-Type": `multipart/related; boundary="${manifestBoundary}"` },
        body: mMetaPart,
      }
    );

    return {
      ok: true,
      message: `Uploaded v${version} (${sizeMB}MB) to Google Drive — '${DRIVE_UPDATE_FOLDER}/${archiveName}'`,
      fileId: uploadData.id,
    };
  } catch (err) {
    return { ok: false, message: String(err) };
  } finally {
    try { if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath); } catch { /* ignore */ }
  }
}

// ── Main: Multi-Source Update Orchestrator ────────────────────────────────────

export async function runMultiSourceUpdate(options?: {
  skipGit?: boolean;
  skipArchive?: boolean;
  skipDrive?: boolean;
  forceDrive?: boolean;
}): Promise<MultiSourceResult> {
  const attempts: UpdateAttempt[] = [];
  const { skipGit = false, skipArchive = false, skipDrive = false, forceDrive = false } = options ?? {};

  console.log("[multi-updater] Multi-source update start karega...");

  // Source 1: git pull
  if (!skipGit) {
    console.log("[multi-updater] Source 1: Git pull try kar raha...");
    const gitResult = await tryGitPull();
    attempts.push(gitResult);

    if (gitResult.ok) {
      return {
        updated: (gitResult.filesChanged ?? 0) > 0 || gitResult.message.includes("up to date"),
        sourceUsed: "git-pull",
        attempts,
        finalMessage: gitResult.message,
      };
    }
    console.log(`[multi-updater] Git pull fail (${gitResult.message.slice(0, 100)}) — next source try karta...`);
  }

  // Source 2: GitHub Archive ZIP
  if (!skipArchive) {
    console.log("[multi-updater] Source 2: GitHub Archive ZIP download try kar raha...");
    const archiveResult = await tryGitHubArchive();
    attempts.push(archiveResult);

    if (archiveResult.ok && !forceDrive) {
      // After archive sync, run pnpm install
      console.log("[multi-updater] Archive sync done — pnpm install chala raha...");
      try {
        await execAsync(
          "pnpm install --prefer-frozen-lockfile 2>&1 || pnpm install --no-frozen-lockfile 2>&1",
          { timeout: 120000, cwd: REPO_ROOT, env: { ...process.env } },
        );
      } catch { /* best effort */ }

      return {
        updated: true,
        sourceUsed: "github-archive",
        attempts,
        finalMessage: archiveResult.message,
      };
    }
    if (!archiveResult.ok) {
      console.log(`[multi-updater] Archive fail (${archiveResult.message.slice(0, 100)}) — next source try karta...`);
    }
  }

  // Source 3: Google Drive
  if (!skipDrive) {
    console.log("[multi-updater] Source 3: Google Drive archive try kar raha...");
    const driveResult = await tryGoogleDriveUpdate();
    attempts.push(driveResult);

    if (driveResult.ok) {
      try {
        await execAsync(
          "pnpm install --prefer-frozen-lockfile 2>&1 || pnpm install --no-frozen-lockfile 2>&1",
          { timeout: 120000, cwd: REPO_ROOT, env: { ...process.env } },
        );
      } catch { /* best effort */ }

      return {
        updated: true,
        sourceUsed: "google-drive",
        attempts,
        finalMessage: driveResult.message,
      };
    }
  }

  // All sources failed
  const failMessages = attempts.map(a => `${a.source}: ${a.message.slice(0, 80)}`).join(" | ");
  return {
    updated: false,
    sourceUsed: null,
    attempts,
    finalMessage: `All update sources failed — ${failMessages}`,
  };
}
