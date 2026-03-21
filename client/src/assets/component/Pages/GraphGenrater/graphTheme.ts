/**
 * Light UI + graph colors for D3 rendering and focus/search states.
 */
export const lightGraphTheme = {
  pageBg: "#f1f5f9",
  panelBg: "#ffffff",
  panelBorder: "#e2e8f0",
  text: "#0f172a",
  textMuted: "#64748b",
  textSubtle: "#475569",

  svgBg: "#f8fafc",
  hoverBannerBg: "rgba(255, 255, 255, 0.95)",
  hoverBannerBorder: "#e2e8f0",
  hoverBannerText: "#0f172a",

  linkBase: "#cbd5e1",
  linkBaseOpacity: 0.35,
  linkFocus: "#0284c7",
  linkDim: "#94a3b8",
  linkSearch: "#ca8a04",
  linkSearchDim: "#cbd5e1",

  marker: "#64748b",

  nodeExternal: "#64748b",
  /** Synthetic React Router path entries */
  nodeRoute: "#059669",
  nodeInternal: "#0ea5e9",
  nodeStroke: "#ffffff",
  nodeStrokeStrong: "#e2e8f0",

  labelFill: "#0f172a",
  labelHalo: "#f8fafc",

  entryRing: "#9333ea",
  searchRing: "#ca8a04",

  selectedStroke: "#d97706",
  focusNeighborStroke: "#334155",
  defaultNodeStroke: "#e2e8f0",
} as const;

export type GraphTheme = typeof lightGraphTheme;
