import React from "react";
import type { NodeSelection } from "./graphModel";
import type { GraphTheme } from "./graphTheme";

type SourcePanelProps = {
  selection: NodeSelection | null;
  theme: GraphTheme;
};

export function SourcePanel({
  selection,
  theme,
}: SourcePanelProps): React.JSX.Element {
  const hasSelection = selection != null;

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
        maxHeight: "20vh",
        overflow: "auto",
      }}
    >
      <div
        style={{
          flexShrink: 0,
          paddingBottom: "0.5rem",
          fontSize: "0.875rem",
          fontWeight: 600,
          color: theme.text,
        }}
      >
        Node Info
      </div>

      {hasSelection ? (
        <div style={{ fontSize: "0.875rem", lineHeight: 1.5 }}>
          <div style={{ marginBottom: "0.5rem" }}>
            <strong>Node:</strong> {selection.label}
          </div>
          <div style={{ marginBottom: "0.5rem" }}>
            <strong>Type:</strong> {selection.external ? "External" : "Internal"}
          </div>
          <div style={{ marginBottom: "0.5rem" }}>
            <strong>ID:</strong> {selection.id}
          </div>
          {selection.code && (
            <div style={{ marginBottom: "0.5rem" }}>
              <strong>Code:</strong> Available in editor →
            </div>
          )}
        </div>
      ) : (
        <div style={{ color: theme.textMuted, fontSize: "0.875rem" }}>
          Click on a node in the graph to view its information and source code in the editor.
        </div>
      )}
    </section>
  );
}
