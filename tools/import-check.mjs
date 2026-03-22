#!/usr/bin/env node
/**
 * IMPORT CHECKER
 * Scans ALL TypeScript/TSX source files (including dynamic imports)
 * and reports any import paths that point to non-existent files.
 * Run: node tools/import-check.mjs
 */
import { readFileSync, existsSync, readdirSync, statSync } from "fs";
import { join, dirname, relative } from "path";

const ROOT = process.cwd();
const SCAN_DIRS = [
  "artifacts/design-tool/src",
  "artifacts/api-server/src",
];

const ALIAS_MAP = {
  "@/": "artifacts/design-tool/src/",
  "@assets/": "attached_assets/",
};

function getAllTsFiles(dir) {
  const files = [];
  if (!existsSync(dir)) return files;
  for (const f of readdirSync(dir)) {
    if (f === "node_modules" || f.startsWith(".")) continue;
    const full = join(dir, f);
    if (statSync(full).isDirectory()) files.push(...getAllTsFiles(full));
    else if (f.endsWith(".tsx") || f.endsWith(".ts")) files.push(full);
  }
  return files;
}

function resolveAlias(imp) {
  for (const [alias, target] of Object.entries(ALIAS_MAP)) {
    if (imp.startsWith(alias)) return join(ROOT, imp.replace(alias, target));
  }
  return null;
}

function fileExists(resolved) {
  const exts = ["", ".tsx", ".ts", ".jsx", ".js", "/index.tsx", "/index.ts"];
  if (exts.some((e) => existsSync(resolved + e))) return true;
  // TypeScript ESM: import './foo.js' actually resolves to './foo.ts'
  if (resolved.endsWith(".js")) {
    const tsVariant = resolved.slice(0, -3);
    if (exts.some((e) => existsSync(tsVariant + e))) return true;
  }
  return false;
}

function resolveImport(imp, fromFile) {
  let resolved;
  if (imp.startsWith("@/") || imp.startsWith("@assets/")) {
    resolved = resolveAlias(imp);
  } else if (imp.startsWith(".")) {
    resolved = join(dirname(fromFile), imp);
  } else {
    return null;
  }
  return fileExists(resolved) ? null : resolved;
}

const missing = [];

for (const scanDir of SCAN_DIRS) {
  const files = getAllTsFiles(join(ROOT, scanDir));
  for (const file of files) {
    try {
      const content = readFileSync(file, "utf-8");
      const imports = [
        ...[...content.matchAll(/from ["']([^"']+)["']/g)].map((m) => m[1]),
        ...[...content.matchAll(/import\(["']([^"']+)["']\)/g)].map((m) => m[1]),
      ];
      for (const imp of imports) {
        if (!imp.startsWith(".") && !imp.startsWith("@/") && !imp.startsWith("@assets/")) continue;
        const miss = resolveImport(imp, file);
        if (miss) {
          missing.push({
            from: relative(ROOT, file),
            import: imp,
            resolved: relative(ROOT, miss),
          });
        }
      }
    } catch {}
  }
}

console.log("\n═══════════════════════════════════════════════");
console.log("   SAI ROLOTECH — Import Path Checker         ");
console.log("═══════════════════════════════════════════════\n");

if (missing.length === 0) {
  console.log("  ✅ All imports resolve correctly. No missing files.\n");
} else {
  console.log(`  ❌ ${missing.length} missing import(s) found:\n`);
  for (const { from, import: imp, resolved } of missing) {
    console.log(`  File : ${from}`);
    console.log(`  Import: ${imp}`);
    console.log(`  Missing: ${resolved}`);
    console.log("");
  }
  process.exit(1);
}
