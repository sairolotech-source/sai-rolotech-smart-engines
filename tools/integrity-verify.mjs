#!/usr/bin/env node
/**
 * FILE INTEGRITY VERIFIER
 * Compares every source file against its saved SHA-256 hash.
 * Run: node tools/integrity-verify.mjs
 * Flags: --repair  (auto-restore corrupted files from git)
 */
import { createHash } from "crypto";
import { readFileSync, statSync, existsSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";

const ROOT = process.cwd();
const MANIFEST = join(ROOT, "file-integrity.json");
const REPAIR = process.argv.includes("--repair");

if (!existsSync(MANIFEST)) {
  console.error("\n❌ No manifest found. Run: node tools/integrity-generate.mjs first.\n");
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(MANIFEST, "utf-8"));
const entries = Object.entries(manifest.files);

let ok = 0;
let missing = [];
let corrupted = [];
let sizeChanged = [];

function sha256(filePath) {
  const content = readFileSync(filePath);
  return createHash("sha256").update(content).digest("hex");
}

for (const [rel, { hash: expected, size: expectedSize }] of entries) {
  const full = join(ROOT, rel);

  if (!existsSync(full)) {
    missing.push(rel);
    continue;
  }

  const actualSize = statSync(full).size;
  const actualHash = sha256(full);

  if (actualHash !== expected) {
    corrupted.push({ file: rel, expected, actual: actualHash });
  } else if (actualSize !== expectedSize) {
    sizeChanged.push({ file: rel, expectedSize, actualSize });
  } else {
    ok++;
  }
}

console.log("\n═══════════════════════════════════════════════");
console.log("   SAI ROLOTECH — File Integrity Verification  ");
console.log(`   Manifest: ${manifest.generated}`);
console.log("═══════════════════════════════════════════════\n");

console.log(`  ✅ OK          : ${ok}`);
console.log(`  ❌ Corrupted   : ${corrupted.length}`);
console.log(`  🚫 Missing     : ${missing.length}`);
console.log(`  ⚠️  Size changed: ${sizeChanged.length}`);
console.log("");

if (corrupted.length > 0) {
  console.log("━━━ CORRUPTED FILES ━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  for (const { file, expected, actual } of corrupted) {
    console.log(`  ❌ ${file}`);
    console.log(`     Expected: ${expected}`);
    console.log(`     Got     : ${actual}`);
    if (REPAIR) {
      try {
        execSync(`git checkout HEAD -- "${file}"`, { cwd: ROOT, stdio: "pipe" });
        console.log(`     ♻️  Restored from git`);
      } catch {
        console.log(`     ⚠️  Git restore failed — commit the file first`);
      }
    }
  }
  console.log("");
}

if (missing.length > 0) {
  console.log("━━━ MISSING FILES ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  for (const file of missing) {
    console.log(`  🚫 ${file}`);
    if (REPAIR) {
      try {
        execSync(`git checkout HEAD -- "${file}"`, { cwd: ROOT, stdio: "pipe" });
        console.log(`     ♻️  Restored from git`);
      } catch {
        console.log(`     ⚠️  Git restore failed — file may not be committed yet`);
      }
    }
  }
  console.log("");
}

if (sizeChanged.length > 0) {
  console.log("━━━ SIZE CHANGED (suspicious) ━━━━━━━━━━━━━━━━━");
  for (const { file, expectedSize, actualSize } of sizeChanged) {
    console.log(`  ⚠️  ${file} (${expectedSize} → ${actualSize} bytes)`);
  }
  console.log("");
}

const totalIssues = corrupted.length + missing.length;
if (totalIssues === 0) {
  console.log("  🛡️  All files are intact. No corruption detected.\n");
} else {
  if (!REPAIR) {
    console.log(`  💡 Tip: Run with --repair to auto-restore from git:\n`);
    console.log(`     node tools/integrity-verify.mjs --repair\n`);
  }
  process.exit(1);
}
