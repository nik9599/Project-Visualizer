import React from "react";
import { MonacoEditor } from "./MonacoEditor";

export function inferPrismLanguage(filename: string): string {
  const lower = filename.toLowerCase();
  const dot = lower.lastIndexOf(".");
  const ext = dot >= 0 ? lower.slice(dot) : "";
  switch (ext) {
    case ".tsx":
      return "tsx";
    case ".ts":
    case ".mts":
    case ".cts":
      return "typescript";
    case ".jsx":
      return "jsx";
    case ".js":
    case ".mjs":
    case ".cjs":
    default:
      return "javascript";
  }
}

type SourceCodeViewerProps = {
  code: string;
  filename: string;
  /** Light = paper-style (default for call graph page). Dark = VS Code–style. */
  variant?: "light" | "dark";
  /** Scrollable viewport height when not filling a flex parent (CSS length). */
  maxHeight?: string;
  /**
   * Fill a flex parent with minHeight:0 so this pane scrolls internally
   * (used by SourcePanel).
   */
  fillContainer?: boolean;
};

export function SourceCodeViewer({
  code,
  filename,
  variant = "light",
  maxHeight = "min(40vh, 28rem)",
  fillContainer = false,
}: SourceCodeViewerProps): React.JSX.Element {
  const language = inferPrismLanguage(filename);
  const isLight = variant === "light";
  const bg = isLight ? "#fafafa" : "#0b1220";
  const border = isLight ? "rgba(15, 23, 42, 0.12)" : "rgba(148, 163, 184, 0.2)";

  const scrollBoxStyle: React.CSSProperties = fillContainer
    ? {
        flex: 1,
        minHeight: 0,
        maxHeight: "100%",
        height: "100%",
      }
    : {
        maxHeight,
      };

  return (
    <div
      style={{
        width: "100%",
        minWidth: 0,
        textAlign: "left",
        borderRadius: 8,
        overflowY: "auto",
        overflowX: "auto",
        overscrollBehavior: "contain",
        border: `1px solid ${border}`,
        background: bg,
        scrollbarGutter: "stable",
        WebkitOverflowScrolling: "touch",
        ...scrollBoxStyle,
      }}
    >
      {/* <SyntaxHighlighter
        language={language}
        style={style}
        showLineNumbers
        wrapLines
        wrapLongLines
        PreTag="div"
        customStyle={{
          margin: 0,
          padding: "12px 0 12px 0",
          background: bg,
          fontSize: "0.75rem",
          lineHeight: 1.55,
          textAlign: "left",
        }}
        lineNumberStyle={{
          minWidth: "2.75em",
          paddingRight: "1em",
          paddingLeft: "12px",
          color: lineNum,
          textAlign: "right",
          userSelect: "none",
          borderRight: `1px solid ${lineBorder}`,
          marginRight: "12px",
        }}
        codeTagProps={{
          style: {
            fontFamily:
              "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
            textAlign: "left",
            display: "block",
            paddingRight: "12px",
          },
        }}
      >
        {code}
      </SyntaxHighlighter> */}
      <MonacoEditor
       defaultValue={code}
       language={language}
       theme={isLight ? "light" : "vs-dark"}
      />
    </div>
  );
}
