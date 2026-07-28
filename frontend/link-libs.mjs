import { readdirSync, readFileSync, statSync, existsSync, mkdirSync, symlinkSync, rmSync, lstatSync } from "node:fs";
import { join, dirname } from "node:path";

const frontend = import.meta.dirname;
const libsRoot = join(frontend, "libs");
const nmRoot = join(frontend, "node_modules");

// Recursively find every package.json under libs/ (skip nested node_modules)
function findPkgs(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules") continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) findPkgs(full, out);
    else if (entry.name === "package.json") out.push(full);
  }
  return out;
}

const pkgs = findPkgs(libsRoot);
let linked = 0, skipped = 0;

for (const pkgPath of pkgs) {
  let json;
  try { json = JSON.parse(readFileSync(pkgPath, "utf8")); } catch { continue; }
  const name = json.name;
  if (!name || !name.startsWith("@")) { skipped++; continue; }
  const libDir = dirname(pkgPath);
  const target = join(nmRoot, name);           // e.g. node_modules/@storyteller/soundboard
  mkdirSync(dirname(target), { recursive: true });
  // Remove any stale entry
  try { if (lstatSync(target)) rmSync(target, { recursive: true, force: true }); } catch {}
  symlinkSync(libDir, target, "junction");
  linked++;
  console.log(`${name} -> ${libDir}`);
}

console.log(`\nLinked ${linked}, skipped ${skipped} (no @scope name).`);
