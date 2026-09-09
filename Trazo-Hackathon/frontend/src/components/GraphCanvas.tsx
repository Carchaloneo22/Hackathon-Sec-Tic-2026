import { useEffect, useMemo, useRef } from "react";
import ForceGraph2D, { type ForceGraphMethods, type NodeObject, type LinkObject } from "react-force-graph-2d";
import { NODE_TYPE_COLOR, type NodeType } from "@shared/types";
import { useGraphStore, type StoredNode, type StoredEdge } from "../store/graphStore";

const DBLCLICK_THRESHOLD_MS = 350;

const APPEAR_MS = 500;
const MERGE_PULSE_MS = 1200;
const EDGE_DRAW_MS = 400;
const BOB_AMPLITUDE = 2.5;
const BOB_PERIOD_MS = 3000;
const ALERT_PULSE_PERIOD_MS = 1600;
const SHARED_PULSE_PERIOD_MS = 2000;
const ALERT_TYPES = new Set<NodeType>(["sancion", "alerta_fiscal", "alerta_disciplinaria"]);

// Fase estable por nodo (a partir de su id) para que el flotado idle no se vea sincronizado.
function bobPhase(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return ((h % 1000) / 1000) * Math.PI * 2;
}

function bobOffset(id: string, now: number): number {
  return Math.sin((now / BOB_PERIOD_MS) * 2 * Math.PI + bobPhase(id)) * BOB_AMPLITUDE;
}

const NODE_RADIUS: Record<NodeType, number> = {
  entidad_estatal: 9,
  proveedor: 8,
  contrato: 4,
  sancion: 6,
  alerta_fiscal: 6,
  alerta_disciplinaria: 6,
};

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export default function GraphCanvas() {
  const nodesMap = useGraphStore((s) => s.nodes);
  const edgesMap = useGraphStore((s) => s.edges);
  const selectedNodeId = useGraphStore((s) => s.selectedNodeId);
  const selectNode = useGraphStore((s) => s.selectNode);
  const hiddenTypes = useGraphStore((s) => s.hiddenTypes);
  const contractFilters = useGraphStore((s) => s.contractFilters);
  const focusRequest = useGraphStore((s) => s.focusRequest);

  const fgRef = useRef<ForceGraphMethods<NodeObject<StoredNode>, LinkObject<StoredNode, StoredEdge>> | undefined>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastClickRef = useRef<{ id: string; time: number } | null>(null);

  const graphData = useMemo(() => {
    const passesContractFilter = (n: StoredNode): boolean => {
      if (n.type !== "contrato") return true;
      const raw = n.raw as { value?: number | null; sign_date?: string | null } | null;
      if (contractFilters.minValue && (raw?.value ?? 0) < contractFilters.minValue) return false;
      if (contractFilters.dateFrom && (!raw?.sign_date || raw.sign_date < contractFilters.dateFrom)) return false;
      if (contractFilters.dateTo && (!raw?.sign_date || raw.sign_date > contractFilters.dateTo)) return false;
      return true;
    };

    const nodes = Array.from(nodesMap.values()).filter(
      (n) => !hiddenTypes.has(n.type) && passesContractFilter(n)
    );
    const visibleIds = new Set(nodes.map((n) => n.id));
    const links = Array.from(edgesMap.values())
      .filter((e) => visibleIds.has(e.source) && visibleIds.has(e.target))
      .map((e) => ({ ...e }));
    return { nodes, links };
  }, [nodesMap, edgesMap, hiddenTypes, contractFilters]);

  useEffect(() => {
    if (!focusRequest || !fgRef.current) return;
    const node = graphData.nodes.find((n) => n.id === focusRequest.id) as
      | (NodeObject<StoredNode> & { x?: number; y?: number })
      | undefined;
    if (!node || node.x === undefined || node.y === undefined) return;
    fgRef.current.centerAt(node.x, node.y, 600);
    fgRef.current.zoom(3, 600);
  }, [focusRequest, graphData.nodes]);

  return (
    <div ref={containerRef} className="h-full w-full bg-[#0d0d0f]">
      <ForceGraph2D
        ref={fgRef}
        graphData={graphData}
        backgroundColor="#0d0d0f"
        nodeRelSize={4}
        linkDirectionalArrowLength={0}
        nodeLabel={(node) => (node as StoredNode).label}
        onNodeClick={(node) => {
          const n = node as NodeObject<StoredNode>;
          const now = Date.now();
          const last = lastClickRef.current;
          const isDoubleClick = !!last && last.id === n.id && now - last.time < DBLCLICK_THRESHOLD_MS;
          lastClickRef.current = { id: n.id, time: now };

          if (isDoubleClick) {
            if (n.x === undefined || n.y === undefined || !fgRef.current) return;
            fgRef.current.centerAt(n.x, n.y, 600);
            fgRef.current.zoom(3, 600);
          } else {
            selectNode(n.id);
          }
        }}
        nodeCanvasObject={(node, ctx) => {
          const n = node as NodeObject<StoredNode>;
          if (n.x === undefined || n.y === undefined) return;
          const now = Date.now();
          const by = n.y + bobOffset(n.id, now);
          const appearT = Math.min(1, (now - n.discovered_at) / APPEAR_MS);
          const scale = easeOutCubic(appearT);
          const baseRadius = NODE_RADIUS[n.type] ?? 6;
          const radius = baseRadius * (0.3 + 0.7 * scale);
          const color = NODE_TYPE_COLOR[n.type] ?? "#888";
          const isSelected = n.id === selectedNodeId;

          const mergePulse = n.mergedAt ? 1 - Math.min(1, (now - n.mergedAt) / MERGE_PULSE_MS) : 0;
          const alertPulse = ALERT_TYPES.has(n.type)
            ? (Math.sin((now / ALERT_PULSE_PERIOD_MS) * 2 * Math.PI) + 1) / 2
            : 0;

          ctx.save();
          ctx.globalAlpha = 0.3 + 0.7 * scale;

          if (mergePulse > 0) {
            ctx.beginPath();
            ctx.arc(n.x, by, radius + mergePulse * 14, 0, 2 * Math.PI);
            ctx.strokeStyle = color;
            ctx.globalAlpha = mergePulse * 0.8;
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.globalAlpha = 0.3 + 0.7 * scale;
          }

          if (alertPulse > 0) {
            ctx.beginPath();
            ctx.arc(n.x, by, radius + 2 + alertPulse * 5, 0, 2 * Math.PI);
            ctx.strokeStyle = color;
            ctx.globalAlpha = (0.15 + 0.35 * alertPulse) * (0.3 + 0.7 * scale);
            ctx.lineWidth = 1.5;
            ctx.stroke();
            ctx.globalAlpha = 0.3 + 0.7 * scale;
          }

          ctx.shadowColor = color;
          ctx.shadowBlur = isSelected ? 22 : 10 + alertPulse * 8;
          ctx.beginPath();
          ctx.arc(n.x, by, radius, 0, 2 * Math.PI);
          ctx.fillStyle = color;
          ctx.fill();

          if (isSelected) {
            ctx.shadowBlur = 0;
            ctx.lineWidth = 1.5;
            ctx.strokeStyle = "#ffffff";
            ctx.stroke();
          }
          ctx.restore();

          if (scale > 0.7) {
            ctx.save();
            ctx.globalAlpha = (scale - 0.7) / 0.3;
            ctx.font = "3px ui-sans-serif, system-ui, sans-serif";
            ctx.fillStyle = "#c9c9d1";
            ctx.textAlign = "center";
            ctx.fillText(truncate(n.label, 28), n.x, by + radius + 5);
            ctx.restore();
          }
        }}
        linkCanvasObject={(link, ctx) => {
          const l = link as LinkObject<StoredNode, StoredEdge>;
          const source = l.source as NodeObject<StoredNode> | string;
          const target = l.target as NodeObject<StoredNode> | string;
          if (typeof source === "string" || typeof target === "string") return;
          if (source.x === undefined || source.y === undefined || target.x === undefined || target.y === undefined)
            return;

          const now = Date.now();
          const sourceBy = source.y + bobOffset(source.id, now);
          const targetBy = target.y + bobOffset(target.id, now);
          const revealedAt = (l as unknown as StoredEdge).revealedAt ?? 0;
          const t = Math.min(1, (now - revealedAt) / EDGE_DRAW_MS);
          const eased = easeOutCubic(t);

          const x = source.x + (target.x - source.x) * eased;
          const y = sourceBy + (targetBy - sourceBy) * eased;

          const isSharedProvider = (l as unknown as StoredEdge).type === "comparte_proveedor_con";

          ctx.save();
          if (isSharedProvider) {
            const glowT = (Math.sin((now / SHARED_PULSE_PERIOD_MS) * 2 * Math.PI) + 1) / 2;
            ctx.globalAlpha = (0.45 + 0.35 * glowT) * (0.3 + 0.7 * eased);
            ctx.strokeStyle = "#f5c542";
            ctx.shadowColor = "#f5c542";
            ctx.shadowBlur = 6;
            ctx.lineWidth = 2;
            ctx.setLineDash([4, 3]);
          } else {
            ctx.globalAlpha = 0.25 + 0.35 * eased;
            ctx.strokeStyle = "#54545e";
            ctx.lineWidth = 1;
          }
          ctx.beginPath();
          ctx.moveTo(source.x, sourceBy);
          ctx.lineTo(x, y);
          ctx.stroke();
          ctx.restore();
        }}
        cooldownTicks={Infinity}
        d3AlphaMin={0}
      />
    </div>
  );
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}
