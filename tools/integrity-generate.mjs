#!/usr/bin/env node
/**
 * FILE INTEGRITY GENERATOR
 * Scans all source files and saves their SHA-256 hash to file-integrity.json
 * Run: node tools/integrity-generate.mjs
 */
import { createHash } from "crypto";
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from "fs";
import { join, relative } from "path";

const ROOT = process.cwd();
const MANIFEST = join(ROOT, "file-integrity.json");

const SCAN_DIRS = [
  "artifacts/design-tool/src",
  "artifacts/api-server/src",
  "lib/db/src",
];

const EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".json", ".css", ".sql"];

function getAllFiles(dir) {
  const results = [];
  if (!existsSync(dir)) return results;
  for (const entry of readdirSync(dir)) {
    if (entry.startsWith(".") || entry === "node_modules") continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) results.push(...getAllFiles(full));
    else if (EXTENSIONS.some((e) => full.endsWith(e))) results.push(full);
  }
  return results;
}

function sha256(filePath) {
  const content = readFileSync(filePath);
  return createHash("sha256").update(content).digest("hex");
}

const manifest = {
  generated: new Date().toISOString(),
  files: {},
};

let count = 0;
for (const dir of SCAN_DIRS) {
  const files = getAllFiles(join(ROOT, dir));
  for (const file of files) {
    const rel = relative(ROOT, file);
    const hash = sha256(file);
    manifest.files[rel] = { hash, size: statSync(file).size };
    count++;
  }
}

writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2), "utf-8");

console.log(`\n✅ Integrity manifest generated`);
console.log(`   Files hashed : ${count}`);
console.log(`   Manifest      : file-integrity.json`);
console.log(`   Generated at  : ${manifest.generated}\n`);
console.log(`Run 'node tools/integrity-verify.mjs' anytime to check for corruption.\n`);
