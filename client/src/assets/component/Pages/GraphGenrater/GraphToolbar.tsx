import React from "react";
import type { GraphTheme } from "./graphTheme";

type GraphToolbarProps = {
  filename: string;
  theme: GraphTheme;
  internalsOnly: boolean;
  setInternalsOnly: (v: boolean) => void;
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  searchMatchCount: number;
  onRerunLayout: () => void;
};

export function GraphToolbar({
  filename,
  theme,
  internalsOnly,
  setInternalsOnly,
  searchQuery,
  setSearchQuery,
  searchMatchCount,
  onRerunLayout,
}: GraphToolbarProps): React.JSX.Element {
  const inputStyle: React.CSSProperties = {
    width: 220,
    maxWidth: "min(42vw, 320px)",
    background: theme.panelBg,
    border: `1px solid ${theme.panelBorder}`,
    borderRadius: 8,
    padding: "0.4rem 0.65rem",
    fontSize: "0.8rem",
    color: theme.text,
    outline: "none",
  };

  return (
    <header
      style={{
        flexShrink: 0,
        padding: "0.75rem 1rem",
        borderBottom: `1px solid ${theme.panelBorder}`,
        background: theme.panelBg,
      }}
    >
      <h1
        style={{
          margin: 0,
          fontSize: "1.15rem",
          fontWeight: 600,
          color: theme.text,
          letterSpacing: "-0.02em",
        }}
      >
        Call graph
      </h1>
      <p
        style={{
          margin: "0.35rem 0 0",
          fontSize: "0.8125rem",
          color: theme.textMuted,
        }}
      >
        <span style={{ color: theme.text }}>{filename}</span>
        {" · "}
        Caller → callee (arrows).{" "}
        <span style={{ color: theme.entryRing }}>Purple</span> = entry,{" "}
        <span style={{ color: theme.searchRing }}>yellow</span> = search match.
        Esc clears selection and search.
      </p>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: "0.65rem 1rem",
          marginTop: "0.65rem",
          fontSize: "0.8rem",
          color: theme.textMuted,
        }}
      >
        <label
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            cursor: "pointer",
            userSelect: "none",
          }}
        >
          <input
            type="checkbox"
            checked={internalsOnly}
            onChange={(e) => setInternalsOnly(e.target.checked)}
          />
          In-file functions only (hides externals / builtins)
        </label>

        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <label htmlFor="graph-node-search" style={{ whiteSpace: "nowrap" }}>
            Search
          </label>
          <input
            id="graph-node-search"
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Function name…"
            autoComplete="off"
            spellCheck={false}
            style={inputStyle}
          />
          {searchQuery.trim() ? (
            <span style={{ whiteSpace: "nowrap" }}>
              {searchMatchCount} match{searchMatchCount !== 1 ? "es" : ""}
            </span>
          ) : null}
        </div>

        <button
          type="button"
          onClick={onRerunLayout}
          style={{
            background: "#e0f2fe",
            border: `1px solid #7dd3fc`,
            color: "#0369a1",
            borderRadius: 8,
            padding: "0.35rem 0.75rem",
            fontSize: "0.8rem",
            cursor: "pointer",
          }}
        >
          Re-run layout
        </button>

        <LegendDot fill="#0ea5e9" label="In-file" theme={theme} />
        <LegendDot fill="#64748b" label="External" theme={theme} />
        <LegendRing
          border="#9333ea"
          label="Entry (no caller in graph)"
          theme={theme}
        />
        <LegendRing
          border="#ca8a04"
          label="Search match"
          theme={theme}
        />
      </div>
    </header>
  );
}

function LegendDot({
  fill,
  label,
  theme,
}: {
  fill: string;
  label: string;
  theme: GraphTheme;
}): React.JSX.Element {
  return (
    <span style={{ color: theme.textMuted }}>
      <span
        style={{
          display: "inline-block",
          width: 10,
          height: 10,
          borderRadius: "50%",
          background: fill,
          marginRight: 6,
          verticalAlign: "middle",
        }}
      />
      {label}
    </span>
  );
}

function LegendRing({
  border,
  label,
  theme,
}: {
  border: string;
  label: string;
  theme: GraphTheme;
}): React.JSX.Element {
  return (
    <span style={{ color: theme.textMuted }}>
      <span
        style={{
          display: "inline-block",
          width: 14,
          height: 14,
          borderRadius: "50%",
          border: `2px solid ${border}`,
          marginRight: 6,
          verticalAlign: "middle",
          boxSizing: "border-box",
        }}
      />
      {label}
    </span>
  );
}
