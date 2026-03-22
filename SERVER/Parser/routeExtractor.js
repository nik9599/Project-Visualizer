/**
 * React Router–oriented route + import extraction for project graphs.
 */
const path = require("path");
const fs = require("fs");
const parser = require("@babel/parser");
const traverse = require("@babel/traverse").default;
const { getParserPlugins } = require("../Parser/parserCore");

const TRY_EXTS = ["", ".tsx", ".ts", ".jsx", ".js"];

/**
 * Resolve `fromRel` (posix, relative to project root) + import literal → relative file path under root.
 */
function resolveModuleToRelPath(rootAbs, fromRel, request) {
  if (!request || request.startsWith("@/")) return null;
  if (!request.startsWith(".")) return null;
  const dir = path.posix.dirname(fromRel);
  const joined = path.posix.normalize(path.posix.join(dir, request));
  const abs = path.join(rootAbs, ...joined.split("/"));

  for (const ext of TRY_EXTS) {
    const full = abs + ext;
    try {
      if (fs.existsSync(full) && fs.statSync(full).isFile()) {
        return path.relative(rootAbs, full).replace(/\\/g, "/");
      }
    } catch {
      /* ignore */
    }
  }
  try {
    if (fs.existsSync(abs) && fs.statSync(abs).isDirectory()) {
      for (const ix of ["index.tsx", "index.ts", "index.jsx", "index.js"]) {
        const full = path.join(abs, ix);
        if (fs.existsSync(full)) {
          return path.relative(rootAbs, full).replace(/\\/g, "/");
        }
      }
    }
  } catch {
    /* ignore */
  }
  return null;
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

/**
 * Extract { path, componentName } from <Route path="..." element={<X />} /> and legacy component={X}.
 */
function extractRoutesFromAst(ast) {
  const routes = [];
  traverse(ast, {
    JSXOpeningElement(p) {
      const el = jsxName(p.node.name);
      if (el !== "Route") return;

      let routePath = null;
      let componentName = null;

      for (const attr of p.node.attributes || []) {
        if (attr.type !== "JSXAttribute" || !attr.name) continue;
        const an = attr.name.name;
        if (an === "path" && attr.value) {
          if (attr.value.type === "StringLiteral") {
            routePath = attr.value.value;
          }
        }
        if (an === "index" && attr.value && attr.value.type === "JSXExpressionContainer") {
          if (attr.value.expression && attr.value.expression.value === true) {
            routePath = "/";
          }
        }
        if (an === "element" && attr.value?.type === "JSXExpressionContainer") {
          const ex = attr.value.expression;
          if (ex.type === "JSXElement") {
            componentName = jsxName(ex.openingElement.name);
          } else if (ex.type === "Identifier") {
            componentName = ex.name;
          }
        }
        if (an === "component" && attr.value?.type === "JSXExpressionContainer") {
          const ex = attr.value.expression;
          if (ex.type === "Identifier") {
            componentName = ex.name;
          }
        }
      }

      if (routePath != null && routePath !== "" && componentName) {
        routes.push({ path: String(routePath), componentName });
      }
    },
  });
  return routes;
}

function normalizeRouteId(p) {
  const s = p.startsWith("/") ? p : `/${p}`;
  return `route:${s}`;
}

/**
 * Pick graph key for component: exact file::Name, else unique suffix match.
 */
function findGraphKey(merged, resolvedFile, componentName) {
  console.error(`[ROUTE_DEBUG] Finding graph key for ${componentName}, resolvedFile: ${resolvedFile}`);
  if (resolvedFile) {
    const k = `${resolvedFile}::${componentName}`;
    console.error(`[ROUTE_DEBUG] Checking exact match: ${k}`);
    if (merged[k]) {
      console.error(`[ROUTE_DEBUG] Found exact match: ${k}`);
      return k;
    }
  }
  const suf = `::${componentName}`;
  const hits = Object.keys(merged).filter(
    (key) => key.endsWith(suf) && !key.startsWith("route:")
  );
  console.error(`[ROUTE_DEBUG] Found ${hits.length} suffix matches for ${componentName}:`, hits);
  if (hits.length === 1) {
    console.error(`[ROUTE_DEBUG] Using single suffix match: ${hits[0]}`);
    return hits[0];
  }
  if (hits.length > 1 && resolvedFile) {
    const pref = resolvedFile.replace(/\/[^/]+$/, "");
    console.error(`[ROUTE_DEBUG] Multiple matches, checking prefix ${pref}`);
    const prefer = hits.find((h) => h.startsWith(pref));
    if (prefer) {
      console.error(`[ROUTE_DEBUG] Found preferred match with prefix: ${prefer}`);
      return prefer;
    }
  }
  if (hits.length > 0) {
    console.error(`[ROUTE_DEBUG] Using first match: ${hits[0]}`);
    return hits[0];
  }
  console.error(`[ROUTE_DEBUG] No matches found for ${componentName}`);
  return null;
}

/**
 * @param {string} code
 * @param {string} ext
 * @param {string} fromRel posix path relative to project root
 * @param {string} rootAbs
 * @param {Record<string, object>} merged function graph keys
 */
function wireRoutesIntoMerged(code, ext, fromRel, rootAbs, merged) {
  let ast;
  try {
    ast = parser.parse(code, {
      sourceType: "module",
      allowImportExportEverywhere: true,
      plugins: getParserPlugins(ext),
    });
  } catch {
    return;
  }

  const imports = buildImportMap(ast, fromRel, rootAbs);
  const routes = extractRoutesFromAst(ast);

  console.error(`[ROUTE_DEBUG] Processing routes in ${fromRel}`);
  console.error(`[ROUTE_DEBUG] Found ${routes.length} routes:`, routes);
  console.error(`[ROUTE_DEBUG] Import map:`, imports);

  for (const r of routes) {
    const resolvedFile = imports[r.componentName] || null;
    const targetId = findGraphKey(merged, resolvedFile, r.componentName);
    console.error(`[ROUTE_DEBUG] Route ${r.path} -> ${r.componentName}: resolvedFile=${resolvedFile}, targetId=${targetId}`);

    if (!targetId) {
      console.error(`[ROUTE_DEBUG] WARNING: Could not find target for route ${r.path} component ${r.componentName}`);
      continue;
    }

    const routeId = normalizeRouteId(r.path);
    if (merged[routeId]) {
      console.error(`[ROUTE_DEBUG] WARNING: Route ${routeId} already exists!`);
      // Still try to add the callee if it's not already there
      if (!merged[routeId].callees.includes(targetId)) {
        merged[routeId].callees.push(targetId);
        console.error(`[ROUTE_DEBUG] Added additional callee ${targetId} to existing route ${routeId}`);
      }
    } else {
      merged[routeId] = {
        callees: [],
        code: `// Route entry → ${r.componentName}`,
        kind: "route",
      };
      console.error(`[ROUTE_DEBUG] Created route node: ${routeId}`);
      merged[routeId].callees.push(targetId);
      console.error(`[ROUTE_DEBUG] Linked ${routeId} -> ${targetId}`);
    }
  }
}

module.exports = {
  wireRoutesIntoMerged,
  resolveModuleToRelPath,
  normalizeRouteId,
};
