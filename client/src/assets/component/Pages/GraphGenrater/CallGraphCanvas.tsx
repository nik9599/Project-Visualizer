import React, { useEffect, useRef } from "react";
import * as d3 from "d3";
import type { GraphTheme } from "./graphTheme";
import {
  type GraphLink,
  type GraphNodeDatum,
  type NodeSelection,
  type ParsedGraph,
  computeEntryPointIds,
  degreeMap,
  linkEndpointId,
  nodeRadius,
  truncateLabel,
} from "./graphModel";

export const VIEW_W = 1400;
export const VIEW_H = 640;

type CallGraphCanvasProps = {
  displayGraph: ParsedGraph | null;
  theme: GraphTheme;
  selection: NodeSelection | null;
  setSelection: React.Dispatch<React.SetStateAction<NodeSelection | null>>;
  hoveredId: string | null;
  setHoveredId: (id: string | null) => void;
  setHoverBanner: (s: string | null) => void;
  searchQuery: string;
  searchMatchIds: Set<string> | null;
  simulationRef: React.MutableRefObject<
    d3.Simulation<GraphNodeDatum, GraphLink> | null
  >;
  emptyFiltered: boolean;
  filename: string;
};

export function CallGraphCanvas({
  displayGraph,
  theme,
  selection,
  setSelection,
  hoveredId,
  setHoveredId,
  setHoverBanner,
  searchQuery,
  searchMatchIds,
  simulationRef,
  emptyFiltered,
  filename,
}: CallGraphCanvasProps): React.JSX.Element {
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (!displayGraph || !svgRef.current) return;
    const svg = d3.select(svgRef.current);
    if (displayGraph.nodes.length === 0) {
      svg.selectAll("*").remove();
      simulationRef.current = null;
      return;
    }

    svg.selectAll("*").remove();

    const entryIds = computeEntryPointIds(
      displayGraph.nodes,
      displayGraph.links
    );
    const nodes = displayGraph.nodes.map((n) => ({
      ...n,
      isEntry: entryIds.has(n.id),
    }));
    const linkData: GraphLink[] = displayGraph.links.map((l) => ({
      source: l.source,
      target: l.target,
    }));

    const deg = degreeMap(displayGraph.links);

    const simulation = d3
      .forceSimulation<GraphNodeDatum>(nodes)
      .force(
        "link",
        d3
          .forceLink<GraphNodeDatum, GraphLink>(linkData)
          .id((d) => d.id)
          .distance((d) => {
            const sid = linkEndpointId(d.source);
            return 72 + Math.min(deg.get(sid) ?? 0, 24);
          })
          .strength(0.22)
      )
      .force("charge", d3.forceManyBody().strength(-520))
      .force("center", d3.forceCenter(VIEW_W / 2, VIEW_H / 2))
      .force(
        "collide",
        d3
          .forceCollide<GraphNodeDatum>()
          .radius((d) => nodeRadius(d, deg) + 18)
          .iterations(2)
      )
      .alphaDecay(0.02)
      .velocityDecay(0.4);

    simulationRef.current = simulation;

    const root = svg.append("g").attr("class", "zoom-root");

    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.06, 6])
      .on("zoom", (event) => {
        root.attr("transform", event.transform.toString());
      });
    svg.call(zoom);

    const defs = svg.append("defs");
    defs
      .append("marker")
      .attr("id", "arrow-call")
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 30)
      .attr("refY", 0)
      .attr("markerWidth", 7)
      .attr("markerHeight", 7)
      .attr("markerUnits", "userSpaceOnUse")
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M0,-5L10,0L0,5")
      .attr("fill", theme.marker);

    const linkG = root.append("g").attr("class", "graph-links");

    const link = linkG
      .selectAll("line")
      .data(linkData)
      .join("line")
      .attr("class", "graph-link")
      .attr("stroke", theme.linkBase)
      .attr("stroke-opacity", theme.linkBaseOpacity)
      .attr("stroke-width", 1.35)
      .attr("marker-end", "url(#arrow-call)");

    const dragBehavior = d3
      .drag<SVGGElement, GraphNodeDatum>()
      .on("start", (event, d) => {
        if (!event.active) simulation.alphaTarget(0.35).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on("drag", (event, d) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on("end", (event, d) => {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      });

    const nodeG = root
      .append("g")
      .attr("class", "graph-nodes")
      .selectAll<SVGGElement, GraphNodeDatum>("g")
      .data(nodes)
      .join("g")
      .style("cursor", "pointer")
      .call(dragBehavior)
      .on("mouseenter", (_event, d) => {
        setHoveredId(d.id);
        const bits = [d.label];
        if (d.external) bits.push("external");
        if (d.isEntry) bits.push("entry");
        setHoverBanner(bits.join(" · "));
      })
      .on("mouseleave", () => {
        setHoveredId(null);
        setHoverBanner(null);
      })
      .on("click", (event, d) => {
        event.stopPropagation();
        setSelection((prev) => {
          if (prev?.id === d.id) return null;
          return {
            id: d.id,
            label: d.label,
            external: d.external,
            code: d.code,
          };
        });
      });

    nodeG
      .append("circle")
      .attr("class", "graph-node-entry-ring")
      .attr("r", (d) => nodeRadius(d, deg) + 6)
      .attr("fill", "none")
      .attr("stroke", (d) => (d.isEntry ? theme.entryRing : "transparent"))
      .attr("stroke-width", 2.5)
      .attr("opacity", (d) => (d.isEntry ? 1 : 0))
      .attr("pointer-events", "none");

    nodeG
      .append("circle")
      .attr("class", "graph-node-search-ring")
      .attr("r", (d) => nodeRadius(d, deg) + 4)
      .attr("fill", "none")
      .attr("stroke", theme.searchRing)
      .attr("stroke-width", 2.5)
      .attr("opacity", 0)
      .attr("pointer-events", "none");

    nodeG
      .append("circle")
      .attr("class", "graph-node")
      .attr("r", (d) => nodeRadius(d, deg))
      .attr("stroke", theme.nodeStrokeStrong)
      .attr("stroke-width", 1.5)
      .attr("fill", (d) => {
        if (d.kind === "route") return theme.nodeRoute;
        if (d.kind === "import") return theme.nodeImport;
        return d.external ? theme.nodeExternal : theme.nodeInternal;
      })
      .attr("opacity", 1);

    nodeG
      .append("text")
      .attr("class", "graph-node-label")
      .attr("text-anchor", "middle")
      .attr("dy", "0.35em")
      .attr("y", (d) => nodeRadius(d, deg) + 11)
      .attr("fill", theme.labelFill)
      .attr("font-size", 10)
      .attr("font-weight", 500)
      .attr("font-family", "ui-sans-serif, system-ui, sans-serif")
      .attr("pointer-events", "none")
      .attr("paint-order", "stroke fill")
      .attr("stroke", theme.labelHalo)
      .attr("stroke-width", 2.5)
      .attr("stroke-linejoin", "round")
      .text((d) => truncateLabel(d.label, 26));

    nodeG
      .append("title")
      .text((d) => {
        const parts = [d.label];
        if (d.kind === "route") parts.push("route entry");
        if (d.kind === "import") parts.push("import relationship");
        if (d.external) parts.push("external / builtin");
        if (d.isEntry) parts.push("entry — no caller in this graph");
        return parts.join(" — ");
      });

    simulation.on("tick", () => {
      link
        .attr("x1", (d) => (d.source as GraphNodeDatum).x ?? 0)
        .attr("y1", (d) => (d.source as GraphNodeDatum).y ?? 0)
        .attr("x2", (d) => (d.target as GraphNodeDatum).x ?? 0)
        .attr("y2", (d) => (d.target as GraphNodeDatum).y ?? 0);

      nodeG.attr("transform", (d) => `translate(${d.x ?? 0},${d.y ?? 0})`);
    });

    return () => {
      simulation.stop();
      simulationRef.current = null;
    };
  }, [displayGraph, setSelection, setHoveredId, setHoverBanner, theme]);

  useEffect(() => {
    if (!svgRef.current || !displayGraph || displayGraph.nodes.length === 0)
      return;

    const svg = d3.select(svgRef.current);
    const focusId = hoveredId ?? selection?.id ?? null;
    const searching =
      searchQuery.trim().length > 0 && searchMatchIds !== null;

    const neighborOfFocus = new Set<string>();
    if (focusId) {
      neighborOfFocus.add(focusId);
      for (const l of displayGraph.links) {
        if (l.source === focusId) neighborOfFocus.add(l.target);
        if (l.target === focusId) neighborOfFocus.add(l.source);
      }
    }

    svg.selectAll(".graph-link").each(function (d) {
      const L = d as GraphLink;
      const s = linkEndpointId(L.source);
      const t = linkEndpointId(L.target);
      const el = d3.select(this);

      if (focusId) {
        const touches = s === focusId || t === focusId;
        el.attr("stroke-opacity", touches ? 0.95 : 0.05)
          .attr("stroke-width", touches ? 2.4 : 0.9)
          .attr("stroke", touches ? theme.linkFocus : theme.linkDim);
      } else if (searching && searchMatchIds) {
        const hit = searchMatchIds.has(s) || searchMatchIds.has(t);
        el.attr("stroke-opacity", hit ? 0.88 : 0.06)
          .attr("stroke-width", hit ? 1.85 : 0.85)
          .attr("stroke", hit ? theme.linkSearch : theme.linkSearchDim);
      } else {
        el.attr("stroke-opacity", theme.linkBaseOpacity)
          .attr("stroke-width", 1.35)
          .attr("stroke", theme.linkBase);
      }
    });

    svg.selectAll("circle.graph-node").each(function () {
      const el = d3.select(this);
      const d = el.datum() as GraphNodeDatum;
      const isSel = selection?.id === d.id;

      if (focusId) {
        const isNeighbor = neighborOfFocus.has(d.id);
        el.attr("opacity", isNeighbor ? 1 : 0.22)
          .attr(
            "stroke",
            isSel
              ? theme.selectedStroke
              : isNeighbor
                ? theme.focusNeighborStroke
                : theme.nodeStrokeStrong
          )
          .attr(
            "stroke-width",
            isSel ? 3 : isNeighbor && d.id === focusId ? 2.2 : 1.4
          );
      } else if (searching && searchMatchIds) {
        const hit = searchMatchIds.has(d.id);
        el.attr("opacity", hit ? 1 : 0.2)
          .attr(
            "stroke",
            isSel
              ? theme.selectedStroke
              : hit
                ? theme.searchRing
                : theme.nodeStrokeStrong
          )
          .attr("stroke-width", isSel ? 3 : hit ? 2.6 : 1.2);
      } else {
        el.attr("opacity", 1)
          .attr("stroke", isSel ? theme.selectedStroke : theme.nodeStrokeStrong)
          .attr("stroke-width", isSel ? 3 : 1.5);
      }
    });

    svg.selectAll("text.graph-node-label").each(function () {
      const el = d3.select(this);
      const d = el.datum() as GraphNodeDatum;

      if (focusId) {
        const isNeighbor = neighborOfFocus.has(d.id);
        el.attr("opacity", isNeighbor ? 1 : 0.2);
      } else if (searching && searchMatchIds) {
        el.attr("opacity", searchMatchIds.has(d.id) ? 1 : 0.18);
      } else {
        el.attr("opacity", 1);
      }
    });

    svg.selectAll("circle.graph-node-entry-ring").each(function () {
      const el = d3.select(this);
      const d = el.datum() as GraphNodeDatum;
      if (!d.isEntry) {
        el.attr("opacity", 0);
        return;
      }

      if (focusId) {
        const isNeighbor = neighborOfFocus.has(d.id);
        el.attr("opacity", isNeighbor ? 1 : 0.18);
      } else if (searching && searchMatchIds) {
        el.attr("opacity", searchMatchIds.has(d.id) ? 1 : 0.15);
      } else {
        el.attr("opacity", 1);
      }
    });

    svg.selectAll("circle.graph-node-search-ring").each(function () {
      const el = d3.select(this);
      const d = el.datum() as GraphNodeDatum;

      if (!searching || !searchMatchIds || !searchMatchIds.has(d.id)) {
        el.attr("opacity", 0);
        return;
      }

      if (focusId) {
        const isNeighbor = neighborOfFocus.has(d.id);
        el.attr("opacity", isNeighbor ? 1 : 0.3);
      } else {
        el.attr("opacity", 1);
      }
    });
  }, [
    selection,
    hoveredId,
    displayGraph,
    searchQuery,
    searchMatchIds,
    theme,
  ]);

  if (emptyFiltered) {
    return (
      <div
        style={{
          padding: "2rem",
          color: theme.textMuted,
          fontSize: "0.9rem",
          background: theme.svgBg,
          flex: 1,
          minHeight: 280,
        }}
      >
        No in-file functions found in this graph (everything is marked
        external). Turn off “In-file functions only” to see the full graph.
      </div>
    );
  }

  return (
    <div
      style={{
        position: "relative",
        flex: 1,
        minHeight: 320,
        minWidth: 0,
        background: theme.svgBg,
        border: `1px solid ${theme.panelBorder}`,
        borderRadius: 8,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        width="100%"
        height="100%"
        preserveAspectRatio="xMidYMid meet"
        style={{
          display: "block",
          flex: 1,
          minHeight: 280,
          cursor: "grab",
        }}
        role="img"
        aria-label={`Call graph for ${filename}`}
      />
    </div>
  );
}
