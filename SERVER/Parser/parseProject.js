/**
 * CLI: node parseProject.js <absoluteRootDir> <mode>
 * mode: "react" | "vanilla"
 *
 * Emits one JSON object: { "relative/path.js::fnName": { callees, code }, ... }
 */
const fs = require("fs");
const path = require("path");
const { parseSourceToFunctions } = require("./parserCore");
const { wireRoutesIntoMerged, resolveModuleToRelPath } = require("./routeExtractor");
const parser = require("@babel/parser");
const traverse = require("@babel/traverse").default;
const { getParserPlugins } = require("./parserCore");

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

function collectPathsReact() {
  const src = path.join(rootDir, "src");
  const start = fs.existsSync(src) && fs.statSync(src).isDirectory() ? src : rootDir;
  console.error(`[DEBUG] collectPathsReact: starting from ${start}`);
  const out = [];
  walkFiles(start, out);
  console.error(`[DEBUG] collectPathsReact: found ${out.length} JS-like files`);
  return out;
}

function collectPathsVanilla() {
  console.error(`[DEBUG] collectPathsVanilla: starting from ${rootDir}`);
  const out = [];
  walkFiles(rootDir, out);
  console.error(`[DEBUG] collectPathsVanilla: found ${out.length} JS-like files`);
  return out;
}

function buildImportMap(ast, fromRel, rootAbs) {
  /** @type {Record<string, string>} localName -> resolved rel path */
  const imports = {};
  traverse(ast, {
    ImportDeclaration(p) {
      const src = p.node.source && p.node.source.value;
      if (typeof src !== "string") return;
      const resolved = resolveModuleToRelPath(rootAbs, fromRel, src);
      if (!resolved) return;
      for (const spec of p.node.specifiers || []) {
        // Skip type imports - they can't be used in JSX
        if (spec.importKind === "type" || spec.importKind === "typeof") {
          continue;
        }
        if (spec.type === "ImportDefaultSpecifier") {
          imports[spec.local.name] = resolved;
        } else if (spec.type === "ImportSpecifier") {
          imports[spec.local.name] = resolved;
        } else if (spec.type === "ImportNamespaceSpecifier") {
          imports[spec.local.name] = resolved;
        }
      }
    },
  });
  return imports;
}

function analyzeComponentImports(code, ext, fromRel, rootAbs, merged) {
  let ast;
  try {
    ast = parser.parse(code, {
      sourceType: "module",
      allowImportExportEverywhere: true,
      plugins: getParserPlugins(ext),
    });
  } catch {
    return {};
  }

  const imports = buildImportMap(ast, fromRel, rootAbs);
  console.error(`[DEBUG] Found imports in ${fromRel}:`, imports);

  const usageMap = new Map(); // Track which imported items are actually used and where

  // Find all usages of imported identifiers and track the containing function
  traverse(ast, {
    Identifier(p) {
      const name = p.node.name;
      if (imports[name]) {
        // Check if this is not a declaration/binding
        let isBinding = false;
        let scope = p.scope;
        while (scope) {
          if (scope.hasBinding(name)) {
            isBinding = true;
            break;
          }
          scope = scope.parent;
        }

        if (!isBinding) {
          // Find the containing function/component where this import is used
          let containingFunction = null;
          let current = p.parent; // Start from parent to avoid the identifier itself
          while (current && !containingFunction) {
            if (current.node && current.node.type === "FunctionDeclaration" && current.node.id) {
              containingFunction = current.node.id.name;
            } else if (current.node && current.node.type === "VariableDeclarator" && current.node.id && current.node.id.type === "Identifier") {
              // Check if this is a function expression or arrow function
              if (current.node.init && (
                current.node.init.type === "FunctionExpression" ||
                current.node.init.type === "ArrowFunctionExpression"
              )) {
                containingFunction = current.node.id.name;
              }
            } else if (current.node && current.node.type === "ClassDeclaration" && current.node.id) {
              containingFunction = current.node.id.name;
            }
            current = current.parent;
          }

          if (containingFunction) {
            const importedFile = imports[name];
            const componentKey = `${importedFile}::${name}`;
            const usageKey = `${fromRel}::${containingFunction}`;

            if (!usageMap.has(name)) {
              usageMap.set(name, { componentKey, usageLocations: new Set() });
            }
            usageMap.get(name).usageLocations.add(usageKey);

            console.error(`[DEBUG] Found usage of imported ${name} from ${importedFile} in function ${containingFunction} (${usageKey})`);
          } else {
            console.error(`[DEBUG] Found usage of imported ${name} from ${imports[name]} but couldn't determine containing function`);
          }
        }
      }
    },
    JSXElement(p) {
      // Check if this JSX element uses an imported component
      const elementName = jsxName(p.node.openingElement.name);
      if (elementName && imports[elementName]) {
        // Find the containing function/component where this JSX element is used
        let containingFunction = null;
        
        // Try to find a function declaration in the ancestors
        const functionDecl = p.findParent((path) => 
          path.node.type === "FunctionDeclaration" && path.node.id
        );
        if (functionDecl) {
          containingFunction = functionDecl.node.id.name;
        } else {
          // Try arrow function or function expression
          const arrowFunc = p.findParent((path) => 
            path.node.type === "VariableDeclarator" && 
            path.node.id && 
            path.node.id.type === "Identifier" &&
            path.node.init && (
              path.node.init.type === "FunctionExpression" ||
              path.node.init.type === "ArrowFunctionExpression"
            )
          );
          if (arrowFunc) {
            containingFunction = arrowFunc.node.id.name;
          } else {
            // Try class method
            const classMethod = p.findParent((path) => 
              path.node.type === "ClassMethod" || 
              path.node.type === "ClassDeclaration"
            );
            if (classMethod && classMethod.node.id) {
              containingFunction = classMethod.node.id.name;
            }
          }
        }

        if (containingFunction) {
          const importedFile = imports[elementName];
          const componentKey = `${importedFile}::${elementName}`;
          const usageKey = `${fromRel}::${containingFunction}`;

          if (!usageMap.has(elementName)) {
            usageMap.set(elementName, { componentKey, usageLocations: new Set() });
          }
          usageMap.get(elementName).usageLocations.add(usageKey);

          console.error(`[DEBUG] Found JSX usage of imported ${elementName} from ${importedFile} in function ${containingFunction} (${usageKey})`);
        } else {
          console.error(`[DEBUG] Found JSX usage of imported ${elementName} from ${imports[elementName]} but couldn't determine containing function`);
        }
      }
    },
  });

  console.error(`[DEBUG] Usage map for ${fromRel}:`, Object.fromEntries(
    Array.from(usageMap.entries()).map(([name, data]) => [
      name,
      { componentKey: data.componentKey, usageLocations: Array.from(data.usageLocations) }
    ])
  ));

  // Create import relationship nodes for all used imports
  let relationshipsCreated = 0;
  for (const [name, data] of usageMap) {
    const importKey = `${fromRel}::import_${name}`;
    if (merged[importKey]) {
      console.error(`[DEBUG] WARNING: Import relationship ${importKey} already exists!`);
      continue;
    }
    merged[importKey] = {
      callees: [],
      code: `// Import: ${name} from ${imports[name]}`,
      kind: "import",
    };

    // Connect import to the actual component
    if (!merged[importKey].callees.includes(data.componentKey)) {
      merged[importKey].callees.push(data.componentKey);
      relationshipsCreated++;
    }

    // Connect the functions that use this import to the import node
    for (const usageLocation of data.usageLocations) {
      if (merged[usageLocation]) {
        if (!merged[usageLocation].callees.includes(importKey)) {
          merged[usageLocation].callees.push(importKey);
          console.error(`[DEBUG] Connected usage location ${usageLocation} to import ${importKey}`);
        }
      } else {
        console.error(`[DEBUG] WARNING: Usage location ${usageLocation} not found in merged graph`);
      }
    }
  }

  console.error(`[DEBUG] Created ${relationshipsCreated} import relationships from ${usageMap.size} used imports in ${fromRel}`);

  // Also identify exported functions as potential entry points
  traverse(ast, {
    ExportNamedDeclaration(p) {
      if (p.declaration && p.declaration.type === "FunctionDeclaration") {
        const fnName = p.declaration.id.name;
        const exportKey = `${fromRel}::${fnName}`;
        if (merged[exportKey]) {
          // Mark as potential entry point
          merged[exportKey].code = merged[exportKey].code.replace(/^\/\//, "// [EXPORT] ");
        }
      }
    },
    ExportDefaultDeclaration(p) {
      if (p.declaration && p.declaration.type === "FunctionDeclaration") {
        const fnName = p.declaration.id.name;
        const exportKey = `${fromRel}::${fnName}`;
        if (merged[exportKey]) {
          merged[exportKey].code = merged[exportKey].code.replace(/^\/\//, "// [DEFAULT EXPORT] ");
        }
      }
    },
  });

  return imports;
}

function main() {
  console.error(`[DEBUG] Starting parseProject with rootDir: ${rootDir}, mode: ${mode}`);
  if (!rootDir || !fs.existsSync(rootDir)) {
    console.error(JSON.stringify({ error: "Invalid root directory" }));
    process.exit(1);
  }

  const files =
    mode === "vanilla" ? collectPathsVanilla() : collectPathsReact();
  console.error(`[DEBUG] Collected ${files.length} files to parse:`, files.map(f => path.relative(rootDir, f)));

  const merged = {};
  const rootAbs = path.resolve(rootDir);
  console.error(`[DEBUG] Root absolute path: ${rootAbs}`);

  // Step 1: First identify and process routing files to create route nodes
  console.error(`[DEBUG] Step 1: Identifying routing files and creating route nodes...`);
  const routingFiles = [];
  const nonRoutingFiles = [];

  for (const filePath of files) {
    let code;
    try {
      code = fs.readFileSync(filePath, "utf-8");
    } catch {
      continue;
    }
    if (code.includes("Route") || code.includes("BrowserRouter") || code.includes("Routes")) {
      routingFiles.push(filePath);
    } else {
      nonRoutingFiles.push(filePath);
    }
  }

  console.error(`[DEBUG] Found ${routingFiles.length} routing files and ${nonRoutingFiles.length} non-routing files`);

  // Create main route entry point '/'
  const mainRouteId = "route:/";
  merged[mainRouteId] = {
    callees: [],
    code: "// Main application entry route",
    kind: "route",
  };
  console.error(`[DEBUG] Created main route node: ${mainRouteId}`);

  // Process routing files first to extract routes
  for (const filePath of routingFiles) {
    const rel = path.relative(rootAbs, filePath).replace(/\\/g, "/");
    const ext = path.extname(filePath).toLowerCase();
    console.error(`[DEBUG] Processing routing file: ${rel}`);
    let code;
    try {
      code = fs.readFileSync(filePath, "utf-8");
    } catch {
      console.error(`[DEBUG] Failed to read routing file: ${rel}`);
      continue;
    }

    // Extract routes and create route nodes
    wireRoutesIntoMerged(code, ext, rel, rootAbs, merged);

    // Also extract functions from routing files
    let partial;
    try {
      partial = parseSourceToFunctions(code, ext);
      console.error(`[DEBUG] Parsed ${Object.keys(partial).length} functions from routing file ${rel}:`, Object.keys(partial));
    } catch (e) {
      console.error(`[DEBUG] Failed to parse routing file: ${rel}, error: ${e.message}`);
      continue;
    }
    for (const [fnName, data] of Object.entries(partial)) {
      const key = `${rel}::${fnName}`;
      if (merged[key]) {
        console.error(`[DEBUG] WARNING: Duplicate function key ${key} already exists in routing files!`);
        console.error(`[DEBUG] Existing:`, merged[key]);
        console.error(`[DEBUG] New:`, data);
        continue;
      }
      merged[key] = {
        callees: data.callees,
        code: data.code,
      };
      console.error(`[DEBUG] Added function: ${key} with ${data.callees.length} callees:`, data.callees);
    }

    // Analyze component imports in routing files
    const beforeCount = Object.keys(merged).filter(k => merged[k].kind === "import").length;
    const importMap = analyzeComponentImports(code, ext, rel, rootAbs, merged);
    const afterCount = Object.keys(merged).filter(k => merged[k].kind === "import").length;
    console.error(`[DEBUG] Analyzed ${Object.keys(importMap).length} imports in routing file ${rel}, created ${afterCount - beforeCount} import relationships`);
  }

  // Step 2: Process remaining files for function extraction
  console.error(`[DEBUG] Step 2: Processing remaining files for function extraction...`);
  for (const filePath of nonRoutingFiles) {
    const rel = path.relative(rootAbs, filePath).replace(/\\/g, "/");
    const ext = path.extname(filePath).toLowerCase();
    console.error(`[DEBUG] Processing file: ${rel}`);
    let code;
    try {
      code = fs.readFileSync(filePath, "utf-8");
    } catch {
      console.error(`[DEBUG] Failed to read file: ${rel}`);
      continue;
    }
    let partial;
    try {
      partial = parseSourceToFunctions(code, ext);
      console.error(`[DEBUG] Parsed ${Object.keys(partial).length} functions from ${rel}:`, Object.keys(partial));
    } catch (e) {
      console.error(`[DEBUG] Failed to parse file: ${rel}, error: ${e.message}`);
      continue;
    }
    for (const [fnName, data] of Object.entries(partial)) {
      const key = `${rel}::${fnName}`;
      if (merged[key]) {
        console.error(`[DEBUG] WARNING: Duplicate function key ${key} already exists in non-routing files!`);
        console.error(`[DEBUG] Existing:`, merged[key]);
        console.error(`[DEBUG] New:`, data);
        continue;
      }
      merged[key] = {
        callees: data.callees,
        code: data.code,
      };
      console.error(`[DEBUG] Added function: ${key} with ${data.callees.length} callees:`, data.callees);
    }

    // Analyze component imports
    const beforeCount = Object.keys(merged).filter(k => merged[k].kind === "import").length;
    const importMap = analyzeComponentImports(code, ext, rel, rootAbs, merged);
    const afterCount = Object.keys(merged).filter(k => merged[k].kind === "import").length;
    console.error(`[DEBUG] Analyzed ${Object.keys(importMap).length} imports in ${rel}, created ${afterCount - beforeCount} import relationships`);
  }

  console.error(`[DEBUG] Finished function extraction. Total merged functions: ${Object.keys(merged).length}`);

  // Step 3: Final route wiring pass to ensure all route-component links are established
  console.error(`[DEBUG] Step 3: Final route wiring pass...`);
  let routeWiringCount = 0;
  for (const filePath of files) {
    const rel = path.relative(rootAbs, filePath).replace(/\\/g, "/");
    const ext = path.extname(filePath).toLowerCase();
    let code;
    try {
      code = fs.readFileSync(filePath, "utf-8");
    } catch {
      continue;
    }
    if (!code.includes("Route")) {
      console.error(`[DEBUG] Skipping ${rel} for route wiring (no 'Route' found)`);
      continue;
    }
    console.error(`[DEBUG] Processing route wiring for file: ${rel}`);
    routeWiringCount++;
    const routeWiringResult = wireRoutesIntoMerged(code, ext, rel, rootAbs, merged);
    console.error(`[DEBUG] Route wiring completed for ${rel}`);
  }
  console.error(`[DEBUG] Processed route wiring for ${routeWiringCount} files`);

  // Link main route to the first route found or main App component
  const routeKeys = Object.keys(merged).filter(k => k.startsWith("route:") && k !== mainRouteId);
  console.error(`[DEBUG] Available route keys:`, routeKeys);
  if (routeKeys.length > 0) {
    // Link main route to the first route (usually '/' or index route)
    const firstRoute = routeKeys.find(k => k === "route:/") || routeKeys[0];
    console.error(`[DEBUG] Selected first route: ${firstRoute}`);
    if (firstRoute && !merged[mainRouteId].callees.includes(firstRoute)) {
      merged[mainRouteId].callees.push(firstRoute);
      console.error(`[DEBUG] Linked main route ${mainRouteId} to: ${firstRoute}`);
    }
  } else {
    console.error(`[DEBUG] WARNING: No route keys found to link to main route`);
  }

  console.error(`[DEBUG] Finished route wiring. Final merged functions: ${Object.keys(merged).length}`);

  // Count import relationships
  const importNodes = Object.keys(merged).filter(k => merged[k].kind === "import");
  console.error(`[DEBUG] Created ${importNodes.length} import relationship nodes`);

  // Identify potential entry points (functions with no callers)
  const allCallers = new Set();
  for (const [key, data] of Object.entries(merged)) {
    for (const callee of data.callees || []) {
      allCallers.add(callee);
    }
  }

  const potentialEntryPoints = Object.keys(merged).filter(
    k => !allCallers.has(k) && !k.startsWith("route:") && merged[k].kind !== "import"
  );
  console.error(`[DEBUG] Identified ${potentialEntryPoints.length} potential entry points (functions with no callers):`, potentialEntryPoints);

  // Identify orphaned functions (functions that call others but are not called)
  const allFunctions = Object.keys(merged).filter(k => !k.startsWith("route:") && merged[k].kind !== "import");
  const orphanedFunctions = allFunctions.filter(k => !allCallers.has(k));
  console.error(`[DEBUG] Orphaned functions (potential entry points):`, orphanedFunctions);

  // Show all connections
  console.error(`[DEBUG] === CONNECTION SUMMARY ===`);
  for (const [key, data] of Object.entries(merged)) {
    if (data.callees && data.callees.length > 0) {
      console.error(`[DEBUG] ${key} calls:`, data.callees);
    } else if (!key.startsWith("route:") || key === "route:/") {
      console.error(`[DEBUG] ${key} has no outgoing connections`);
    }
  }

  // Identify truly unconnected functions (no incoming OR outgoing connections)
  const unconnectedFunctions = [];
  for (const [key, data] of Object.entries(merged)) {
    if (key.startsWith("route:") && key !== "route:/") continue;
    if (data.kind === "import") continue;
    const hasOutgoing = (data.callees || []).length > 0;
    const hasIncoming = allCallers.has(key);
    if (!hasOutgoing && !hasIncoming) {
      unconnectedFunctions.push(key);
    }
  }
  console.error(`[DEBUG] Truly unconnected functions (${unconnectedFunctions.length}):`, unconnectedFunctions);

  console.error(`[DEBUG] === FINAL STATS ===`);
  console.error(`[DEBUG] Total functions: ${Object.keys(merged).length}`);
  console.error(`[DEBUG] Route nodes: ${Object.keys(merged).filter(k => k.startsWith("route:")).length}`);
  console.error(`[DEBUG] Import nodes: ${Object.keys(merged).filter(k => merged[k].kind === "import").length}`);
  console.error(`[DEBUG] Regular functions: ${Object.keys(merged).filter(k => !k.startsWith("route:") && merged[k].kind !== "import").length}`);
  console.error(`[DEBUG] Functions with outgoing connections: ${Object.keys(merged).filter(k => (merged[k].callees || []).length > 0).length}`);
  console.error(`[DEBUG] Functions with incoming connections: ${Array.from(allCallers).length}`);
  console.error(`[DEBUG] Truly unconnected functions: ${unconnectedFunctions.length}`);

  console.error(`[DEBUG] === FINAL VALIDATION ===`);
  const allKeys = Object.keys(merged);
  const uniqueKeys = new Set(allKeys);
  if (allKeys.length !== uniqueKeys.size) {
    console.error(`[DEBUG] ERROR: Found duplicate keys in merged object!`);
    const keyCounts = {};
    for (const key of allKeys) {
      keyCounts[key] = (keyCounts[key] || 0) + 1;
    }
    const duplicates = Object.entries(keyCounts).filter(([_, count]) => count > 1);
    console.error(`[DEBUG] Duplicate keys:`, duplicates);
  } else {
    console.error(`[DEBUG] All ${allKeys.length} keys are unique ✓`);
  }

  console.error(`[DEBUG] Outputting final JSON result...`);
  console.log(JSON.stringify(merged));
}

main();
