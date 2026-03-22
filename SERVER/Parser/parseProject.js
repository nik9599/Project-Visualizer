/**
 * CLI: node parseProject.js <absoluteRootDir> <mode>
 * mode: "react" | "vanilla"
 *
 * Generates D3.js compatible dependency graph for React projects
 * Supports: Create React App, Vite + React, Next.js
 */
const fs = require("fs");
const path = require("path");
const { parseSourceToFunctions } = require("./parserCore");
const { wireRoutesIntoMerged, resolveModuleToRelPath } = require("./routeExtractor");
const parser = require("@babel/parser");
const traverse = require("@babel/traverse").default;
const { getParserPlugins } = require("./parserCore");

// Project type detection
function detectProjectType(rootDir) {
  // Check client/package.json first (for monorepo setups)
  const clientPackageJson = path.join(rootDir, "client", "package.json");
  if (fs.existsSync(clientPackageJson)) {
    try {
      const packageJson = JSON.parse(fs.readFileSync(clientPackageJson, "utf-8"));
      const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

      if (deps["next"]) return "next";
      if (deps["vite"]) return "vite";
      if (deps["react-scripts"]) return "cra";
      return "unknown";
    } catch {
      // Fall through to root package.json
    }
  }

  // Check root package.json
  const rootPackageJson = path.join(rootDir, "package.json");
  try {
    const packageJson = JSON.parse(fs.readFileSync(rootPackageJson, "utf-8"));
    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

    if (deps["next"]) return "next";
    if (deps["vite"]) return "vite";
    if (deps["react-scripts"]) return "cra";
    return "unknown";
  } catch {
    return "unknown";
  }
}

// Find entry point based on project type
function findEntryPoint(rootDir, projectType) {
  // Check if there's a client directory (monorepo setup)
  const clientSrcDir = path.join(rootDir, "client", "src");
  const hasClientDir = fs.existsSync(clientSrcDir);
  const srcDir = hasClientDir ? clientSrcDir : path.join(rootDir, "src");

  switch (projectType) {
    case "vite":
      // Vite: src/main.jsx or src/main.tsx
      const viteMainTsx = path.join(srcDir, "main.tsx");
      const viteMainJsx = path.join(srcDir, "main.jsx");
      if (fs.existsSync(viteMainTsx)) return path.relative(rootDir, viteMainTsx).replace(/\\/g, "/");
      if (fs.existsSync(viteMainJsx)) return path.relative(rootDir, viteMainJsx).replace(/\\/g, "/");
      break;

    case "cra":
      // CRA: src/index.js or src/index.tsx
      const craIndexTsx = path.join(srcDir, "index.tsx");
      const craIndexJs = path.join(srcDir, "index.js");
      if (fs.existsSync(craIndexTsx)) return path.relative(rootDir, craIndexTsx).replace(/\\/g, "/");
      if (fs.existsSync(craIndexJs)) return path.relative(rootDir, craIndexJs).replace(/\\/g, "/");
      break;

    case "next":
      // Next.js: pages/_app.js or app/layout.tsx
      const nextAppRouter = path.join(rootDir, "app", "layout.tsx");
      const nextPagesRouter = path.join(rootDir, "pages", "_app.js");
      if (fs.existsSync(nextAppRouter)) return path.relative(rootDir, nextAppRouter).replace(/\\/g, "/");
      if (fs.existsSync(nextPagesRouter)) return path.relative(rootDir, nextPagesRouter).replace(/\\/g, "/");
      break;
  }

  // Fallback: try common entry points
  const commonEntries = hasClientDir
    ? ["client/src/main.tsx", "client/src/main.jsx", "client/src/index.tsx", "client/src/index.js"]
    : ["src/main.tsx", "src/main.jsx", "src/index.tsx", "src/index.js"];

  for (const entry of commonEntries) {
    const fullPath = path.join(rootDir, entry);
    if (fs.existsSync(fullPath)) return entry;
  }

  return null;
}

// Resolve path aliases from config files
function resolvePathAliases(rootDir, projectType) {
  const aliases = {};

  // Check for client directory
  const clientDir = path.join(rootDir, "client");
  const configDirs = [rootDir];
  if (fs.existsSync(clientDir)) {
    configDirs.push(clientDir);
  }

  for (const configDir of configDirs) {
    // Check tsconfig.json/jsconfig.json
    const configFiles = ["tsconfig.json", "jsconfig.json"];
    for (const configFile of configFiles) {
      try {
        const configPath = path.join(configDir, configFile);
        if (fs.existsSync(configPath)) {
          const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
          const paths = config.compilerOptions?.paths;
          if (paths) {
            for (const [alias, targets] of Object.entries(paths)) {
              if (Array.isArray(targets) && targets.length > 0) {
                const cleanAlias = alias.replace("/*", "");
                const cleanTarget = targets[0].replace("/*", "").replace("./", "");
                aliases[cleanAlias] = cleanTarget;
              }
            }
          }
        }
      } catch (e) {
        console.error(`[DEBUG] Failed to parse ${configFile}:`, e.message);
      }
    }

    // Check vite.config.js/ts
    if (projectType === "vite") {
      const viteConfigs = ["vite.config.js", "vite.config.ts"];
      for (const configFile of viteConfigs) {
        try {
          const configPath = path.join(configDir, configFile);
          if (fs.existsSync(configPath)) {
            const content = fs.readFileSync(configPath, "utf-8");
            // Simple regex to find alias definitions
            const aliasMatches = content.match(/alias:\s*{([^}]+)}/);
            if (aliasMatches) {
              const aliasBlock = aliasMatches[1];
              const aliasPairs = aliasBlock.match(/['"]([^'"]+)['"]\s*:\s*['"]([^'"]+)['"]/g);
              if (aliasPairs) {
                for (const pair of aliasPairs) {
                  const [, alias, target] = pair.match(/['"]([^'"]+)['"]\s*:\s*['"]([^'"]+)['"]/);
                  aliases[alias] = target.replace("./", "");
                }
              }
            }
          }
        } catch (e) {
          console.error(`[DEBUG] Failed to parse ${configFile}:`, e.message);
        }
      }
    }
  }

  console.error(`[DEBUG] Resolved path aliases:`, aliases);
  return aliases;
}

// Resolve import path with aliases
function resolveImportPath(importPath, fromFile, rootDir, aliases) {
  // Handle relative imports
  if (importPath.startsWith(".")) {
    const fromDir = path.dirname(fromFile);
    return path.resolve(rootDir, fromDir, importPath);
  }

  // Handle absolute imports with aliases
  for (const [alias, target] of Object.entries(aliases)) {
    if (importPath.startsWith(alias)) {
      const relativePath = importPath.slice(alias.length);
      const resolved = path.join(rootDir, target, relativePath);
      if (fs.existsSync(resolved) || fs.existsSync(resolved + ".js") || fs.existsSync(resolved + ".jsx") || fs.existsSync(resolved + ".ts") || fs.existsSync(resolved + ".tsx")) {
        return resolved;
      }
    }
  }

  // Handle node_modules (skip)
  if (!importPath.startsWith(".") && !importPath.startsWith("/")) {
    return null; // Skip external dependencies
  }

  return path.resolve(rootDir, importPath);
}

// Calculate D3 group number based on file path
function getGroupNumber(filePath) {
  const lowerPath = filePath.toLowerCase();

  if (lowerPath.includes("page") || lowerPath.includes("view") || lowerPath.includes("screen")) return 2;
  if (lowerPath.includes("component")) return 3;
  if (lowerPath.includes("hook") || lowerPath.includes("use")) return 4;
  if (lowerPath.includes("context") || lowerPath.includes("provider")) return 5;
  if (lowerPath.includes("util") || lowerPath.includes("helper") || lowerPath.includes("service")) return 6;
  if (lowerPath.includes("layout")) return 7;

  return 1; // Default to entry/root
}

// Check if file should be skipped
function shouldSkipFile(filePath) {
  const lowerPath = filePath.toLowerCase();
  const fileName = path.basename(filePath);

  // Skip test files
  if (fileName.includes(".test.") || fileName.includes(".spec.") || lowerPath.includes("__tests__")) return true;

  // Skip config files
  if (fileName.includes("config.") || fileName.includes(".config.")) return true;

  // Skip CSS and assets
  if (fileName.endsWith(".css") || fileName.endsWith(".scss") || fileName.endsWith(".png") ||
      fileName.endsWith(".jpg") || fileName.endsWith(".svg") || fileName.endsWith(".woff")) return true;

  return false;
}

// Comprehensive file analysis
function analyzeFile(filePath, rootDir, aliases) {
  const relPath = path.relative(rootDir, filePath).replace(/\\/g, "/");
  const ext = path.extname(filePath).toLowerCase();

  console.error(`[DEBUG] Analyzing file: ${relPath}`);

  let code;
  try {
    code = fs.readFileSync(filePath, "utf-8");
  } catch {
    return null;
  }

  // Count lines of code
  const loc = code.split("\n").length;

  let ast;
  try {
    ast = parser.parse(code, {
      sourceType: "module",
      allowImportExportEverywhere: true,
      plugins: getParserPlugins(ext),
    });
  } catch (e) {
    console.error(`[DEBUG] Failed to parse ${relPath}:`, e.message);
    return null;
  }

  const analysis = {
    filePath: relPath,
    exports: [],
    imports: [],
    components: [],
    hooks: [],
    contexts: [],
    renders: [],
    calls: [],
    provides: [],
    consumes: []
  };

  // Collect exports
  traverse(ast, {
    ExportNamedDeclaration(p) {
      if (p.declaration) {
        if (p.declaration.type === "FunctionDeclaration" && p.declaration.id) {
          analysis.exports.push(p.declaration.id.name);
        } else if (p.declaration.type === "VariableDeclaration") {
          for (const decl of p.declaration.declarations) {
            if (decl.id.type === "Identifier") {
              analysis.exports.push(decl.id.name);
            }
          }
        }
      }
    },
    ExportDefaultDeclaration(p) {
      if (p.declaration) {
        if (p.declaration.type === "FunctionDeclaration" && p.declaration.id) {
          analysis.exports.push(p.declaration.id.name);
        } else if (p.declaration.id && p.declaration.id.type === "Identifier") {
          analysis.exports.push(p.declaration.id.name);
        }
      }
    }
  });

  // Collect imports and their resolved paths
  traverse(ast, {
    ImportDeclaration(p) {
      const importPath = p.node.source.value;
      const resolvedPath = resolveImportPath(importPath, relPath, rootDir, aliases);

      for (const spec of p.node.specifiers) {
        if (spec.type === "ImportSpecifier") {
          analysis.imports.push({
            name: spec.imported.name,
            local: spec.local.name,
            from: resolvedPath ? path.relative(rootDir, resolvedPath).replace(/\\/g, "/") : importPath,
            type: "named"
          });
        } else if (spec.type === "ImportDefaultSpecifier") {
          analysis.imports.push({
            name: spec.local.name,
            local: spec.local.name,
            from: resolvedPath ? path.relative(rootDir, resolvedPath).replace(/\\/g, "/") : importPath,
            type: "default"
          });
        }
      }
    }
  });

  // Find component definitions
  traverse(ast, {
    FunctionDeclaration(p) {
      if (p.node.id && /^[A-Z]/.test(p.node.id.name)) {
        // Check if it returns JSX
        let hasJSX = false;
        traverse(p.node, {
          JSXElement() { hasJSX = true; },
          JSXFragment() { hasJSX = true; }
        }, p.scope);

        if (hasJSX) {
          analysis.components.push({
            name: p.node.id.name,
            type: "function",
            loc: p.node.loc.end.line - p.node.loc.start.line
          });
        }
      }
    },
    VariableDeclarator(p) {
      if (p.node.id.type === "Identifier" && /^[A-Z]/.test(p.node.id.name)) {
        if (p.node.init && (p.node.init.type === "ArrowFunctionExpression" || p.node.init.type === "FunctionExpression")) {
          let hasJSX = false;
          traverse(p.node.init, {
            JSXElement() { hasJSX = true; },
            JSXFragment() { hasJSX = true; }
          }, p.scope);

          if (hasJSX) {
            analysis.components.push({
              name: p.node.id.name,
              type: "arrow",
              loc: p.node.loc.end.line - p.node.loc.start.line
            });
          }
        }
      }
    },
    ClassDeclaration(p) {
      if (p.node.id && /^[A-Z]/.test(p.node.id.name) && p.node.superClass) {
        // Check if it extends React.Component or Component
        const superClass = p.node.superClass;
        if (superClass.type === "MemberExpression" &&
            superClass.object.name === "React" &&
            superClass.property.name === "Component") {
          analysis.components.push({
            name: p.node.id.name,
            type: "class",
            loc: p.node.loc.end.line - p.node.loc.start.line
          });
        } else if (superClass.type === "Identifier" && superClass.name === "Component") {
          analysis.components.push({
            name: p.node.id.name,
            type: "class",
            loc: p.node.loc.end.line - p.node.loc.start.line
          });
        }
      }
    }
  });

  // Find hook definitions
  traverse(ast, {
    FunctionDeclaration(p) {
      if (p.node.id && p.node.id.name.startsWith("use")) {
        analysis.hooks.push({
          name: p.node.id.name,
          loc: p.node.loc.end.line - p.node.loc.start.line
        });
      }
    },
    VariableDeclarator(p) {
      if (p.node.id.type === "Identifier" && p.node.id.name.startsWith("use")) {
        if (p.node.init && (p.node.init.type === "ArrowFunctionExpression" || p.node.init.type === "FunctionExpression")) {
          analysis.hooks.push({
            name: p.node.id.name,
            loc: p.node.loc.end.line - p.node.loc.start.line
          });
        }
      }
    }
  });

  // Find JSX usage (component rendering)
  traverse(ast, {
    JSXElement(p) {
      const elementName = jsxName(p.node.openingElement.name);
      if (elementName && /^[A-Z]/.test(elementName)) {
        analysis.renders.push(elementName);
      }
    }
  });

  // Find function calls (hooks, utilities)
  traverse(ast, {
    CallExpression(p) {
      const callee = p.node.callee;
      if (callee.type === "Identifier") {
        if (callee.name.startsWith("use")) {
          analysis.calls.push(callee.name);
        }
      }
    }
  });

  return { ...analysis, loc, code };
}

function jsxName(node) {
  if (!node) return null;
  if (node.type === "JSXIdentifier") return node.name;
  if (node.type === "JSXMemberExpression") {
    const o = jsxName(node.object);
    const prop = node.property && node.property.name;
    return o && prop ? `${o}.${prop}` : null;
  }
  return null;
}

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

function main() {
  console.error(`[DEBUG] Starting enhanced parseProject with rootDir: ${rootDir}, mode: ${mode}`);

  if (!rootDir || !fs.existsSync(rootDir)) {
    console.error(JSON.stringify({ error: "Invalid root directory" }));
    process.exit(1);
  }

  // Step 1: Detect project type and find entry point
  const projectType = detectProjectType(rootDir);
  console.error(`[DEBUG] Detected project type: ${projectType}`);

  const entryPoint = findEntryPoint(rootDir, projectType);
  if (!entryPoint) {
    console.error(JSON.stringify({ error: "Could not find entry point for project type: " + projectType }));
    process.exit(1);
  }
  console.error(`[DEBUG] Found entry point: ${entryPoint}`);

  // Step 2: Resolve path aliases
  const aliases = resolvePathAliases(rootDir, projectType);

  // Step 3: Collect all relevant files
  const files = [];
  function collectFiles(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!IGNORE_DIRS.has(entry.name) && !entry.name.startsWith(".")) {
          collectFiles(fullPath);
        }
      } else {
        const ext = path.extname(entry.name).toLowerCase();
        if (JS_LIKE.has(ext) && !shouldSkipFile(fullPath)) {
          files.push(fullPath);
        }
      }
    }
  }

  const clientSrcDir = path.join(rootDir, "client", "src");
  const srcDir = path.join(rootDir, "src");

  // Collect files from client/src if it exists (monorepo), otherwise from src/
  if (fs.existsSync(clientSrcDir)) {
    collectFiles(clientSrcDir);
  } else if (fs.existsSync(srcDir)) {
    collectFiles(srcDir);
  } else {
    collectFiles(rootDir);
  }

  console.error(`[DEBUG] Collected ${files.length} files to analyze`);

  // Step 4: Analyze all files
  const fileAnalyses = new Map();
  const allImports = new Map(); // import name -> Set of files that import it

  for (const filePath of files) {
    const analysis = analyzeFile(filePath, rootDir, aliases);
    if (analysis) {
      const relPath = path.relative(rootDir, filePath).replace(/\\/g, "/");
      fileAnalyses.set(relPath, analysis);

      // Track imports for cross-referencing
      for (const imp of analysis.imports) {
        if (!allImports.has(imp.name)) {
          allImports.set(imp.name, new Set());
        }
        allImports.get(imp.name).add(relPath);
      }
    }
  }

  console.error(`[DEBUG] Analyzed ${fileAnalyses.size} files successfully`);

  // Step 5: Build D3.js graph structure
  const nodes = [];
  const links = [];
  const visited = new Set();
  const nodeIdMap = new Map(); // file path -> node id

  // Create root node
  const rootNode = {
    id: entryPoint,
    label: path.basename(entryPoint),
    type: "file",
    group: 1,
    depth: 0,
    loc: fileAnalyses.get(entryPoint)?.loc || 0,
    exports: fileAnalyses.get(entryPoint)?.exports || [],
    code: fileAnalyses.get(entryPoint)?.code || ""
  };
  nodes.push(rootNode);
  nodeIdMap.set(entryPoint, entryPoint);
  visited.add(entryPoint);

  // BFS to build graph
  const queue = [{ file: entryPoint, depth: 0 }];
  let queueIndex = 0;

  while (queueIndex < queue.length) {
    const { file, depth } = queue[queueIndex++];
    const analysis = fileAnalyses.get(file);

    if (!analysis) continue;

    // Process imports
    for (const imp of analysis.imports) {
      if (!imp.from || imp.from.includes("node_modules")) continue;

      // Resolve barrel files
      let targetFile = imp.from;
      if (targetFile.endsWith("/index")) {
        // Look for actual file in the directory
        const dirPath = path.join(rootDir, targetFile);
        if (fs.existsSync(dirPath + ".js")) targetFile += ".js";
        else if (fs.existsSync(dirPath + ".jsx")) targetFile += ".jsx";
        else if (fs.existsSync(dirPath + ".ts")) targetFile += ".ts";
        else if (fs.existsSync(dirPath + ".tsx")) targetFile += ".tsx";
      }

      // Create target node if it doesn't exist
      if (!nodeIdMap.has(targetFile) && fileAnalyses.has(targetFile)) {
        const targetAnalysis = fileAnalyses.get(targetFile);
        const nodeType = targetAnalysis.components.length > 0 ? "component" :
                        targetAnalysis.hooks.length > 0 ? "hook" : "file";

        const newNode = {
          id: targetFile,
          label: path.basename(targetFile),
          type: nodeType,
          group: getGroupNumber(targetFile),
          depth: depth + 1,
          loc: targetAnalysis.loc,
          exports: targetAnalysis.exports,
          code: targetAnalysis.code || ""
        };

        nodes.push(newNode);
        nodeIdMap.set(targetFile, targetFile);
        queue.push({ file: targetFile, depth: depth + 1 });
      }

      // Create import link
      if (nodeIdMap.has(targetFile)) {
        links.push({
          source: file,
          target: targetFile,
          type: "imports",
          value: 1
        });
      }
    }

    // Process component renders
    for (const render of analysis.renders) {
      // Find which file exports this component
      for (const [otherFile, otherAnalysis] of fileAnalyses) {
        if (otherAnalysis.exports.includes(render) || otherAnalysis.components.some(c => c.name === render)) {
          if (!nodeIdMap.has(otherFile)) {
            const nodeType = otherAnalysis.components.length > 0 ? "component" : "file";
            const newNode = {
              id: otherFile,
              label: path.basename(otherFile),
              type: nodeType,
              group: getGroupNumber(otherFile),
              depth: depth + 1,
              loc: otherAnalysis.loc,
              exports: otherAnalysis.exports,
              code: otherAnalysis.code || ""
            };
            nodes.push(newNode);
            nodeIdMap.set(otherFile, otherFile);
            queue.push({ file: otherFile, depth: depth + 1 });
          }

          links.push({
            source: file,
            target: otherFile,
            type: "renders",
            value: 3
          });
          break;
        }
      }
    }

    // Process hook calls
    for (const call of analysis.calls) {
      // Find which file exports this hook
      for (const [otherFile, otherAnalysis] of fileAnalyses) {
        if (otherAnalysis.exports.includes(call) || otherAnalysis.hooks.some(h => h.name === call)) {
          if (!nodeIdMap.has(otherFile)) {
            const newNode = {
              id: otherFile,
              label: path.basename(otherFile),
              type: "hook",
              group: 4,
              depth: depth + 1,
              loc: otherAnalysis.loc,
              exports: otherAnalysis.exports,
              code: otherAnalysis.code || ""
            };
            nodes.push(newNode);
            nodeIdMap.set(otherFile, otherFile);
            queue.push({ file: otherFile, depth: depth + 1 });
          }

          links.push({
            source: file,
            target: otherFile,
            type: "calls",
            value: 2
          });
          break;
        }
      }
    }
  }

  // Step 6: Detect circular imports
  const circularLinks = [];
  for (const link of links) {
    // Simple cycle detection - check if target eventually leads back to source
    const visitedInPath = new Set();
    const stack = [link.target];

    while (stack.length > 0) {
      const current = stack.pop();
      if (visitedInPath.has(current)) continue;
      visitedInPath.add(current);

      if (current === link.source) {
        // Found cycle
        link.circular = true;
        circularLinks.push(link);
        break;
      }

      // Add predecessors
      for (const otherLink of links) {
        if (otherLink.target === current) {
          stack.push(otherLink.source);
        }
      }
    }
  }

  console.error(`[DEBUG] Detected ${circularLinks.length} circular import links`);

  // Step 7: Final output
  const result = {
    projectType,
    entryPoint,
    nodes,
    links,
    stats: {
      totalFiles: files.length,
      analyzedFiles: fileAnalyses.size,
      totalNodes: nodes.length,
      totalLinks: links.length,
      circularLinks: circularLinks.length,
      maxDepth: Math.max(...nodes.map(n => n.depth))
    }
  };

  console.error(`[DEBUG] === FINAL STATS ===`);
  console.error(`[DEBUG] Project type: ${projectType}`);
  console.error(`[DEBUG] Entry point: ${entryPoint}`);
  console.error(`[DEBUG] Total files collected: ${files.length}`);
  console.error(`[DEBUG] Files successfully analyzed: ${fileAnalyses.size}`);
  console.error(`[DEBUG] Graph nodes: ${nodes.length}`);
  console.error(`[DEBUG] Graph links: ${links.length}`);
  console.error(`[DEBUG] Circular links detected: ${circularLinks.length}`);
  console.error(`[DEBUG] Maximum depth: ${result.stats.maxDepth}`);

  console.log(JSON.stringify(result, null, 2));
}

main();
