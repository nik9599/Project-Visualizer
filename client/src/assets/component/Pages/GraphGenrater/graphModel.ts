import type { SimulationNodeDatum, SimulationLinkDatum } from "d3";

export type GraphNodeDatum = SimulationNodeDatum & {
  id: string;
  label: string;
  external: boolean;
  code?: string;
  isEntry: boolean;
  /** Set for synthetic nodes, e.g. React Router entries */
  kind?: string;
};

export type RawEdge = { source: string; target: string };

export type RawNode = {
  id: string;
  label?: string;
  external?: boolean;
  code?: string;
  kind?: string;
};

export type GraphLink = SimulationLinkDatum<GraphNodeDatum>;

export type NodeSelection = {
  id: string;
  label: string;
  external: boolean;
  code?: string;
};

export type ParsedGraph = {
  filename: string;
  nodes: GraphNodeDatum[];
  links: RawEdge[];
  /** Optional server message when the graph is empty or ambiguous */
  hint?: string;
  /** Debug logs from the parser */
  debug_logs?: string;
};

export function parseGraphPayload(data: unknown): ParsedGraph | null {
  if (!data || typeof data !== "object") return null;
  const o = data as Record<string, unknown>;
  const graph = o.graph as Record<string, unknown> | undefined;
  if (!graph || !Array.isArray(graph.edges)) return null;

  const rawEdges = graph.edges as RawEdge[];
  const rawNodes = Array.isArray(graph.nodes) ? (graph.nodes as RawNode[]) : [];

  const nodeMap = new Map<string, GraphNodeDatum>();

  for (const n of rawNodes) {
    nodeMap.set(n.id, {
      id: n.id,
      label: n.label ?? n.id,
      external: Boolean(n.external),
      code: typeof n.code === "string" ? n.code : undefined,
      isEntry: false,
      ...(typeof n.kind === "string" ? { kind: n.kind } : {}),
    });
  }

  for (const e of rawEdges) {
    if (!nodeMap.has(e.source)) {
      nodeMap.set(e.source, {
        id: e.source,
        label: e.source,
        external: true,
        isEntry: false,
      });
    }
    if (!nodeMap.has(e.target)) {
      nodeMap.set(e.target, {
        id: e.target,
        label: e.target,
        external: true,
        isEntry: false,
      });
    }
  }

  for (const n of nodeMap.values()) {
    if (n.id.startsWith("route:")) {
      const pathPart = n.id.slice("route:".length);
      nodeMap.set(n.id, {
        ...n,
        label: pathPart ? `Route ${pathPart}` : "Route /",
        kind: n.kind ?? "route",
      });
    } else if (n.id.includes("::import_")) {
      // Handle import nodes: format is "file::import_componentName"
      const parts = n.id.split("::import_");
      if (parts.length === 2) {
        const componentName = parts[1];
        nodeMap.set(n.id, {
          ...n,
          label: `Import ${componentName}`,
          kind: n.kind ?? "import",
        });
      }
    }
  }

  const filename =
    typeof o.filename === "string" ? o.filename : "call graph";

  const hint = typeof o.hint === "string" ? o.hint : undefined;

  const debug_logs = typeof o.debug_logs === "string" ? o.debug_logs : undefined;

  return {
    filename,
    nodes: Array.from(nodeMap.values()),
    links: rawEdges.map((e) => ({ source: e.source, target: e.target })),
    ...(hint ? { hint } : {}),
    ...(debug_logs ? { debug_logs } : {}),
  };
}

export function filterInternalsOnly(parsed: ParsedGraph): ParsedGraph {
  const internalIds = new Set(
    parsed.nodes.filter((n) => !n.external).map((n) => n.id)
  );
  const nodes = parsed.nodes.filter((n) => internalIds.has(n.id));
  const links = parsed.links.filter(
    (l) => internalIds.has(l.source) && internalIds.has(l.target)
  );
  return { ...parsed, nodes, links };
}

export function degreeMap(links: RawEdge[]): Map<string, number> {
  const m = new Map<string, number>();
  const bump = (id: string) => m.set(id, (m.get(id) ?? 0) + 1);
  for (const l of links) {
    bump(l.source);
    bump(l.target);
  }
  return m;
}

export function computeEntryPointIds(
  nodes: { id: string }[],
  links: RawEdge[]
): Set<string> {
  const ids = new Set(nodes.map((n) => n.id));
  const hasIncoming = new Set<string>();
  for (const l of links) {
    if (ids.has(l.target)) hasIncoming.add(l.target);
  }
  const roots = new Set<string>();
  for (const id of ids) {
    if (!hasIncoming.has(id)) roots.add(id);
  }
  return roots;
}

export function linkEndpointId(
  end: GraphNodeDatum | string | number
): string {
  if (typeof end === "object" && end !== null && "id" in end) {
    return end.id;
  }
  return String(end);
}

export function nodeRadius(d: GraphNodeDatum, deg: Map<string, number>): number {
  const n = deg.get(d.id) ?? 0;
  return Math.min(28, 9 + Math.sqrt(n + 1) * 2.4);
}

export function truncateLabel(name: string, maxChars: number): string {
  if (name.length <= maxChars) return name;
  return `${name.slice(0, Math.max(0, maxChars - 1))}…`;
}
