import React, { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import { CallGraphCanvas } from "./CallGraphCanvas";
import { GraphToolbar } from "./GraphToolbar";
import { DebugLogsPanel } from "./DebugLogsPanel";
import { MonacoEditor } from "./MonacoEditor";
import { lightGraphTheme } from "./graphTheme";
import { inferPrismLanguage } from "./SourceCodeViewer";
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
  projectId?: string | null;
  onRefreshFromSavedProject?: () => Promise<void>;
}

const theme = lightGraphTheme;

export default function GraphGenerator({
  data,
  projectId,
  onRefreshFromSavedProject,
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
  const [editorContent, setEditorContent] = useState<string>("// Select a node to view its source code");
  const [refreshing, setRefreshing] = useState(false);

  const displayGraph = useMemo(() => {
    if (!parsed) return null;
    return internalsOnly ? filterInternalsOnly(parsed) : parsed;
  }, [parsed, internalsOnly]);

  const editorLanguage = useMemo(() => {
    if (!parsed?.filename) return "javascript";
    return inferPrismLanguage(parsed.filename);
  }, [parsed?.filename]);

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

  // Update editor content when selection changes
  useEffect(() => {
    if (selection && selection.code) {
      setEditorContent(selection.code);
    } else if (selection && selection.external) {
      setEditorContent(`// ${selection.label} is an external dependency\n// Source code not available`);
    } else {
      setEditorContent("// Select a node to view its source code");
    }
  }, [selection]);

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
      {projectId && onRefreshFromSavedProject && (
        <div
          style={{
            padding: "0.5rem 1rem",
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            borderBottom: `1px solid ${theme.panelBorder}`,
            background: theme.pageBg,
          }}
        >
          <span style={{ fontSize: "0.8rem", color: theme.textMuted }}>
            Saved project: <code style={{ color: theme.text }}>{projectId.slice(0, 8)}…</code>
          </span>
          <button
            type="button"
            disabled={refreshing}
            onClick={() => {
              setRefreshing(true);
              void onRefreshFromSavedProject().finally(() => setRefreshing(false));
            }}
            style={{
              fontSize: "0.8rem",
              fontWeight: 600,
              padding: "0.35rem 0.75rem",
              borderRadius: 8,
              border: `1px solid ${theme.panelBorder}`,
              background: "#fff",
              cursor: refreshing ? "wait" : "pointer",
              color: theme.text,
            }}
          >
            {refreshing ? "Refreshing…" : "Refresh graph from saved files"}
          </button>
        </div>
      )}

      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "row",
          minHeight: 0,
          minWidth: 0,
        }}
      >
        {/* Left side: Graph */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
            maxHeight: "80vh",
            borderRight: `1px solid ${theme.panelBorder}`,
          }}
        >
          <div
            style={{
              position: "relative",
              flex: 1,
              display: "flex",
              flexDirection: "column",
              minHeight: 0,
              maxHeight: "70vh",
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

          <DebugLogsPanel
            debug_logs={parsed.debug_logs}
            theme={theme}
          />
        </div>

        {/* Right side: Editor */}
        <div
          style={{
            width: "50%",
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
            padding: "0.5rem",
          }}
        >
          <div
            style={{
              marginBottom: "0.5rem",
              fontSize: "0.875rem",
              fontWeight: 600,
              color: theme.text,
            }}
          >
            Code Editor
            {selection && (
              <span style={{ fontWeight: 400, marginLeft: "0.5rem", color: theme.textMuted }}>
                - {selection.label}
              </span>
            )}
          </div>
          <div style={{ height: "400px", minHeight: 0 }}>
            <MonacoEditor
              value={editorContent}
              onChange={(value) => setEditorContent(value || "")}
              language={editorLanguage}
              theme="light"
              readOnly={false}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
