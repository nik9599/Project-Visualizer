import React from "react";
import { SourceCodeViewer } from "./SourceCodeViewer";
import type { NodeSelection } from "./graphModel";
import type { GraphTheme } from "./graphTheme";

type SourcePanelProps = {
  selection: NodeSelection | null;
  filename: string;
  theme: GraphTheme;
};

export function SourcePanel({
  selection,
  filename,
  theme,
}: SourcePanelProps): React.JSX.Element {
  const hasScrollableCode =
    selection != null &&
    !selection.external &&
    Boolean(selection.code);

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
        ...(hasScrollableCode
          ? {
              height: "min(42vh, 26rem)",
              maxHeight: "42vh",
              overflow: "hidden",
            }
          : {
              maxHeight: "42vh",
              overflow: "auto",
            }),
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
        }}
      >
        {selection ? selection.label : "Source"}
      </div>

      {!selection && (
        <p style={{ margin: 0, color: theme.textMuted, fontSize: "0.875rem" }}>
          Click a node to see its source when the analyzer provides it.
        </p>
      )}
      {selection && selection.external && (
        <p style={{ margin: 0, color: theme.textMuted, fontSize: "0.875rem" }}>
          This name is external or a builtin (e.g.{" "}
          <code style={{ color: "#0369a1" }}>jQuery</code>). There is no
          single function body in the uploaded file.
        </p>
      )}
      {selection && !selection.external && !selection.code && (
        <p style={{ margin: 0, color: theme.textMuted, fontSize: "0.875rem" }}>
          No source was included for this node. Re-analyze with an updated
          server that sends <code style={{ color: "#0369a1" }}>code</code> per
          node.
        </p>
      )}
      {hasScrollableCode && selection.code && (
        <div
          style={{
            flex: 1,
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          <SourceCodeViewer
            code={selection.code}
            filename={filename}
            variant="light"
            fillContainer
          />
        </div>
      )}
    </section>
  );
}
