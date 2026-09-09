// Compartir grafo vía URL (CLAUDE.md sección 8, Fase 4): serializa el estado del grafo
// en el fragmento (#g=...) para que sea reconstruible sin backend. No es persistencia
// colaborativa (eso es Fase 5, sin confirmar) — es una foto puntual codificada en el link.
//
// Para mantener la URL corta, solo se preserva el `raw` completo de los tipos de nodo
// cuyo detalle no se puede volver a pedir de otra forma (sanción/alertas — el panel de
// detalle los muestra directo desde `raw`, sin llamar al backend). El resto (proveedor,
// entidad, contrato) se re-consulta en vivo contra /api/detail al seleccionarlos, como
// ya hace el flujo normal.

import type { GraphNode, GraphEdge, NodeType, EdgeType } from "@shared/types";

const RAW_PRESERVED_TYPES = new Set<NodeType>(["sancion", "alerta_fiscal", "alerta_disciplinaria"]);
const FORMAT_VERSION = 1;

interface SharedNode {
  id: string;
  type: NodeType;
  label: string;
  expanded: boolean;
  raw?: unknown;
}

interface SharedEdge {
  s: string;
  t: string;
  y: EdgeType;
}

interface SharedGraph {
  v: number;
  nodes: SharedNode[];
  edges: SharedEdge[];
}

function toBase64Url(json: string): string {
  const base64 = btoa(unescape(encodeURIComponent(json)));
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(encoded: string): string {
  const base64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  return decodeURIComponent(escape(atob(padded)));
}

export function encodeGraph(nodes: GraphNode[], edges: GraphEdge[]): string {
  const payload: SharedGraph = {
    v: FORMAT_VERSION,
    nodes: nodes.map((n) => ({
      id: n.id,
      type: n.type,
      label: n.label,
      expanded: n.expanded,
      ...(RAW_PRESERVED_TYPES.has(n.type) ? { raw: n.raw } : {}),
    })),
    edges: edges.map((e) => ({ s: e.source, t: e.target, y: e.type })),
  };
  return toBase64Url(JSON.stringify(payload));
}

export function decodeGraph(encoded: string): { nodes: GraphNode[]; edges: GraphEdge[] } | null {
  try {
    const payload = JSON.parse(fromBase64Url(encoded)) as SharedGraph;
    if (payload.v !== FORMAT_VERSION || !Array.isArray(payload.nodes) || !Array.isArray(payload.edges)) {
      return null;
    }

    const nodes: GraphNode[] = payload.nodes.map((n) => ({
      id: n.id,
      type: n.type,
      label: n.label,
      raw: n.raw ?? null,
      discovered_at: 0,
      expanded: n.expanded,
    }));
    const edges: GraphEdge[] = payload.edges.map((e) => ({
      id: `${e.s}->${e.t}:${e.y}`,
      source: e.s,
      target: e.t,
      type: e.y,
    }));
    return { nodes, edges };
  } catch {
    return null;
  }
}

export function buildShareUrl(nodes: GraphNode[], edges: GraphEdge[]): string {
  const url = new URL(window.location.href);
  url.hash = `g=${encodeGraph(nodes, edges)}`;
  return url.toString();
}

export function readGraphFromLocation(): { nodes: GraphNode[]; edges: GraphEdge[] } | null {
  const match = window.location.hash.match(/(?:^#|&)g=([^&]+)/);
  return match ? decodeGraph(match[1]) : null;
}
