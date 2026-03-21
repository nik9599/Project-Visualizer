/**
 * CLI: node parseProject.js <absoluteRootDir> <mode>
 * mode: "react" | "vanilla"
 *
 * Emits one JSON object: { "relative/path.js::fnName": { callees, code }, ... }
 */
const fs = require("fs");
const path = require("path");
const { parseSourceToFunctions } = require("./parserCore");
const { wireRoutesIntoMerged } = require("./routeExtractor");

const rootDir = process.argv[2];
const mode = (process.argv[3] || "react").toLowerCase();

const IGNORE_DIRS = new Set([
  "node_modules",
  "dist",
  "build",
  ".git",
  ".next",
  "coverage",
  "out",
  ".cache",
  ".turbo",
  "vendor",
  "__pycache__",
]);

const JS_LIKE = new Set([
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".ts",
  ".tsx",
  ".mts",
  ".cts",
]);

function walkFiles(startDir, out) {
  let entries;
  try {
    entries = fs.readdirSync(startDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const ent of entries) {
    const full = path.join(startDir, ent.name);
    if (ent.isDirectory()) {
      if (IGNORE_DIRS.has(ent.name)) continue;
      if (ent.name.startsWith(".")) continue;
      walkFiles(full, out);
    } else {
      const ext = path.extname(ent.name).toLowerCase();
      if (JS_LIKE.has(ext)) out.push(full);
    }
  }
}

function collectPathsReact() {
  const src = path.join(rootDir, "src");
  const start = fs.existsSync(src) && fs.statSync(src).isDirectory() ? src : rootDir;
  const out = [];
  walkFiles(start, out);
  return out;
}

function collectPathsVanilla() {
  const out = [];
  walkFiles(rootDir, out);
  return out;
}

function main() {
  if (!rootDir || !fs.existsSync(rootDir)) {
    console.error(JSON.stringify({ error: "Invalid root directory" }));
    process.exit(1);
  }

  const files =
    mode === "vanilla" ? collectPathsVanilla() : collectPathsReact();

  const merged = {};
  const rootAbs = path.resolve(rootDir);

  for (const filePath of files) {
    const rel = path.relative(rootAbs, filePath).replace(/\\/g, "/");
    const ext = path.extname(filePath).toLowerCase();
    let code;
    try {
      code = fs.readFileSync(filePath, "utf-8");
    } catch {
      continue;
    }
    let partial;
    try {
      partial = parseSourceToFunctions(code, ext);
    } catch {
      continue;
    }
    for (const [fnName, data] of Object.entries(partial)) {
      const key = `${rel}::${fnName}`;
      merged[key] = {
        callees: data.callees,
        code: data.code,
      };
    }
  }

  // React Router: synthetic route:* entry nodes → component functions (tree roots)
  for (const filePath of files) {
    const rel = path.relative(rootAbs, filePath).replace(/\\/g, "/");
    const ext = path.extname(filePath).toLowerCase();
    let code;
    try {
      code = fs.readFileSync(filePath, "utf-8");
    } catch {
      continue;
    }
    if (!code.includes("Route")) continue;
    wireRoutesIntoMerged(code, ext, rel, rootAbs, merged);
  }

  console.log(JSON.stringify(merged));
}

main();
