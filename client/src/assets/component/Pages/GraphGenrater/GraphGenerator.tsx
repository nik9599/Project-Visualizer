import React, { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import { CallGraphCanvas } from "./CallGraphCanvas";
import { GraphToolbar } from "./GraphToolbar";
import { SourcePanel } from "./SourcePanel";
import { DebugLogsPanel } from "./DebugLogsPanel";
import { lightGraphTheme } from "./graphTheme";
import {
  parseGraphPayload,
  filterInternalsOnly,
  type GraphLink,
  type GraphNodeDatum,
  type NodeSelection,
} from "./graphModel";

export type { NodeSelection } from "./graphModel";

interface GraphGeneratorProps {
  data: unknown;
}

const theme = lightGraphTheme;

export default function GraphGenerator({
  data,
}: GraphGeneratorProps): React.JSX.Element {
  const simulationRef = useRef<d3.Simulation<
    GraphNodeDatum,
    GraphLink
  > | null>(null);

  const parsed = useMemo(() => parseGraphPayload(data), [data]);

  const [internalsOnly, setInternalsOnly] = useState(true);
  const [selection, setSelection] = useState<NodeSelection | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [hoverBanner, setHoverBanner] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const displayGraph = useMemo(() => {
    if (!parsed) return null;
    return internalsOnly ? filterInternalsOnly(parsed) : parsed;
  }, [parsed, internalsOnly]);

  useEffect(() => {
    setSelection(null);
    setHoveredId(null);
    setHoverBanner(null);
  }, [parsed, internalsOnly]);

  const searchMatchIds = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q || !displayGraph) return null;
    const s = new Set<string>();
    for (const n of displayGraph.nodes) {
      if (
        n.id.toLowerCase().includes(q) ||
        n.label.toLowerCase().includes(q)
      ) {
        s.add(n.id);
      }
    }
    return s;
  }, [searchQuery, displayGraph]);

  useEffect(() => {
    setSearchQuery("");
  }, [parsed, internalsOnly]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelection(null);
        setHoveredId(null);
        setHoverBanner(null);
        setSearchQuery("");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!parsed) {
    return (
      <div
        style={{
          padding: "2rem",
          color: theme.textMuted,
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
          minHeight: "100vh",
          boxSizing: "border-box",
          background: theme.pageBg,
        }}
      >
        No graph data. Upload a JSON file with{" "}
        <code style={{ color: "#0369a1" }}>graph.edges</code>.
      </div>
    );
  }

  const emptyFiltered =
    Boolean(
      internalsOnly &&
        displayGraph !== null &&
        displayGraph.nodes.length === 0
    );

  const searchMatchCount = searchQuery.trim()
    ? searchMatchIds?.size ?? 0
    : 0;

  const emptyGraph = parsed.nodes.length === 0;

  return (
    <div
      style={{
        width: "100%",
        minHeight: "100vh",
        margin: 0,
        boxSizing: "border-box",
        fontFamily: "ui-sans-serif, system-ui, sans-serif",
        background: theme.pageBg,
        color: theme.text,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {emptyGraph && parsed.hint && (
        <div
          style={{
            padding: "0.75rem 1rem",
            margin: "0 0.5rem",
            borderRadius: 8,
            background: "#fffbeb",
            border: "1px solid #fcd34d",
            color: "#92400e",
            fontSize: "0.875rem",
            lineHeight: 1.5,
          }}
        >
          {parsed.hint}
        </div>
      )}
      <GraphToolbar
        filename={parsed.filename}
        theme={theme}
        internalsOnly={internalsOnly}
        setInternalsOnly={setInternalsOnly}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        searchMatchCount={searchMatchCount}
        onRerunLayout={() =>
          simulationRef.current?.alpha(0.45).restart()
        }
      />

      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
          minWidth: 0,
        }}
      >
        <div
          style={{
            position: "relative",
            flex: 1,
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
            padding: "0 0.5rem",
          }}
        >
          {hoverBanner && (
            <div
              style={{
                position: "absolute",
                top: 10,
                left: 12,
                right: 12,
                zIndex: 2,
                pointerEvents: "none",
                fontSize: "0.8rem",
                color: theme.hoverBannerText,
                background: theme.hoverBannerBg,
                border: `1px solid ${theme.hoverBannerBorder}`,
                borderRadius: 8,
                padding: "0.4rem 0.65rem",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
              }}
              title={hoverBanner}
            >
              {hoverBanner}
            </div>
          )}

          {displayGraph && (
            <CallGraphCanvas
              displayGraph={displayGraph}
              theme={theme}
              selection={selection}
              setSelection={setSelection}
              hoveredId={hoveredId}
              setHoveredId={setHoveredId}
              setHoverBanner={setHoverBanner}
              searchQuery={searchQuery}
              searchMatchIds={searchMatchIds}
              simulationRef={simulationRef}
              emptyFiltered={emptyFiltered}
              filename={parsed.filename}
            />
          )}
        </div>

        <SourcePanel
          selection={selection}
          filename={parsed.filename}
          theme={theme}
        />

        <DebugLogsPanel
          debug_logs={parsed.debug_logs}
          theme={theme}
        />
      </div>
    </div>
  );
}
