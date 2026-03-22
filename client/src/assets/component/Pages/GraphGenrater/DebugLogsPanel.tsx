import React, { useState, useMemo } from "react";
import type { GraphTheme } from "./graphTheme";

type DebugLogsPanelProps = {
  debug_logs: string | undefined;
  theme: GraphTheme;
};

export function DebugLogsPanel({
  debug_logs,
  theme,
}: DebugLogsPanelProps): React.JSX.Element | null {
  const [isExpanded, setIsExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  if (!debug_logs) return null;

  const filteredLogs = useMemo(() => {
    if (!searchQuery.trim()) return debug_logs;
    
    const lines = debug_logs.split('\n');
    const filteredLines = lines.filter(line => 
      line.toLowerCase().includes(searchQuery.toLowerCase())
    );
    return filteredLines.join('\n');
  }, [debug_logs, searchQuery]);

  return (
    <section
      style={{
        padding: "0.75rem 1rem 1rem",
        borderTop: `1px solid ${theme.panelBorder}`,
        background: theme.panelBg,
        flexShrink: 0,
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        maxHeight: isExpanded ? "80vh" : "8rem",
        overflow: "hidden",
        transition: "max-height 0.2s ease-in-out",
      }}
    >
      <div
        style={{
          flexShrink: 0,
          paddingBottom: "0.5rem",
          fontSize: "0.875rem",
          fontWeight: 600,
          color: theme.text,
          borderBottom: `1px solid ${theme.panelBorder}`,
          marginBottom: "0.65rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "0.5rem",
        }}
      >
        <span>Debug Logs</span>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <input
            type="text"
            placeholder="Search logs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              padding: "0.25rem 0.5rem",
              fontSize: "0.75rem",
              border: `1px solid ${theme.panelBorder}`,
              borderRadius: 4,
              background: theme.pageBg,
              color: theme.text,
              minWidth: "120px",
              outline: "none",
            }}
          />
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            style={{
              background: "none",
              border: "none",
              color: theme.textMuted,
              cursor: "pointer",
              fontSize: "0.75rem",
              padding: "0.25rem 0.5rem",
              borderRadius: 4,
              transition: "background-color 0.1s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = theme.panelBorder;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            {isExpanded ? "Collapse" : "Expand"}
          </button>
        </div>
      </div>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflow: "auto",
          fontSize: "0.75rem",
          fontFamily: "ui-monospace, 'Cascadia Code', 'Source Code Pro', Menlo, Consolas, 'DejaVu Sans Mono', monospace",
          background: theme.pageBg,
          border: `1px solid ${theme.panelBorder}`,
          borderRadius: 4,
          padding: "0.5rem",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          color: theme.text,
        }}
      >
        {filteredLogs}
      </div>
    </section>
  );
}