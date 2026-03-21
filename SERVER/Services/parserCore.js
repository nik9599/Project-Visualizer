const parser = require("@babel/parser");
const traverse = require("@babel/traverse").default;

/**
 * Babel parser plugins by extension.
 */
function getParserPlugins(extension) {
  switch (extension) {
    case ".ts":
    case ".mts":
    case ".cts":
      return ["typescript"];
    case ".tsx":
      return [["typescript", { isTSX: true }], "jsx"];
    case ".jsx":
    case ".js":
    case ".mjs":
    case ".cjs":
      return ["jsx"];
    default:
      return ["jsx"];
  }
}

function getMethodKeyName(key) {
  if (!key) return null;
  if (key.type === "Identifier") return key.name;
  if (key.type === "StringLiteral") return key.value;
  return null;
}

/**
 * Parse one source file and return { fnName: { callees: string[], code: string } }.
 * Includes function declarations, const/let fn = () => {}, class methods, and object methods.
 */
function parseSourceToFunctions(code, ext) {
  const ast = parser.parse(code, {
    sourceType: "module",
    allowImportExportEverywhere: true,
    plugins: getParserPlugins(ext),
  });

  const functions = {};
  const fnStack = [];

  function enterFn(name, node) {
    if (!name) return;
    fnStack.push(name);
    functions[name] = {
      callees: [],
      code: code.slice(node.start, node.end),
    };
  }

  function exitFn() {
    fnStack.pop();
  }

  function currentFn() {
    return fnStack.length ? fnStack[fnStack.length - 1] : null;
  }

  function classQualifiedName(path) {
    const cls = path.findParent((p) => p.isClassDeclaration());
    const keyName = getMethodKeyName(path.node.key);
    if (!keyName) return null;
    if (cls && cls.node.id && cls.node.id.name) {
      return `${cls.node.id.name}.${keyName}`;
    }
    return keyName;
  }

  traverse(ast, {
    FunctionDeclaration: {
      enter(path) {
        const id = path.node.id;
        if (!id || !id.name) return;
        enterFn(id.name, path.node);
      },
      exit(path) {
        const id = path.node.id;
        if (!id || !id.name) return;
        exitFn();
      },
    },
    FunctionExpression: {
      enter(path) {
        let name = null;
        if (
          path.parent.type === "VariableDeclarator" &&
          path.parent.id &&
          path.parent.id.type === "Identifier"
        ) {
          name = path.parent.id.name;
        } else if (path.node.id && path.node.id.type === "Identifier") {
          name = path.node.id.name;
        }
        if (!name) return;
        enterFn(name, path.node);
      },
      exit(path) {
        let name = null;
        if (
          path.parent.type === "VariableDeclarator" &&
          path.parent.id &&
          path.parent.id.type === "Identifier"
        ) {
          name = path.parent.id.name;
        } else if (path.node.id && path.node.id.type === "Identifier") {
          name = path.node.id.name;
        }
        if (!name) return;
        exitFn();
      },
    },
    ArrowFunctionExpression: {
      enter(path) {
        if (
          path.parent.type !== "VariableDeclarator" ||
          !path.parent.id ||
          path.parent.id.type !== "Identifier"
        ) {
          return;
        }
        enterFn(path.parent.id.name, path.node);
      },
      exit(path) {
        if (
          path.parent.type !== "VariableDeclarator" ||
          !path.parent.id ||
          path.parent.id.type !== "Identifier"
        ) {
          return;
        }
        exitFn();
      },
    },
    ObjectMethod: {
      enter(path) {
        const name = getMethodKeyName(path.node.key);
        if (!name) return;
        enterFn(name, path.node);
      },
      exit(path) {
        const name = getMethodKeyName(path.node.key);
        if (!name) return;
        exitFn();
      },
    },
    ClassMethod: {
      enter(path) {
        const name = classQualifiedName(path);
        if (!name) return;
        enterFn(name, path.node);
      },
      exit(path) {
        const name = classQualifiedName(path);
        if (!name) return;
        exitFn();
      },
    },
    CallExpression(path) {
      const cf = currentFn();
      if (!cf) return;
      const callee = path.node.callee;
      if (callee.type === "Identifier" && callee.name) {
        functions[cf].callees.push(callee.name);
      }
    },
  });

  return functions;
}

module.exports = {
  getParserPlugins,
  parseSourceToFunctions,
};
