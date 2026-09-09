import { useEffect, useState } from "react";
import type { DetailResponse, NodeType } from "@shared/types";
import { NODE_TYPE_COLOR } from "@shared/types";
import { useGraphStore } from "../store/graphStore";
import { ensureAuthorName } from "../store/identityStore";
import * as api from "../api/client";
import { RateLimitedError } from "../api/client";

const NODE_TYPE_LABEL: Record<NodeType, string> = {
  entidad_estatal: "Entidad estatal",
  proveedor: "Proveedor",
  contrato: "Contrato",
  sancion: "Sanción",
  alerta_fiscal: "Alerta fiscal",
  alerta_disciplinaria: "Alerta disciplinaria",
};

const EXPANDABLE: NodeType[] = ["entidad_estatal", "proveedor"];

function formatCOP(value: number | null | undefined): string {
  if (!value) return "valor no reportado";
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(
    value
  );
}

/** Resumen en lenguaje natural para nodos cuyo detalle ya viene embebido (no requieren
 * una llamada extra al backend): sanciones y alertas fiscales/disciplinarias. */
function localSummaryFor(node: { type: NodeType; raw: unknown }): string {
  if (node.type === "sancion") {
    const s = node.raw as {
      sanctioning_entity?: string | null;
      resolution_number?: string | null;
      value?: number | null;
      published_date?: string | null;
    } | null;
    const parts = [
      s?.resolution_number ? `Sanción ${s.resolution_number}` : "Sanción",
      s?.sanctioning_entity ? `impuesta por ${s.sanctioning_entity}` : null,
      `por ${formatCOP(s?.value)}`,
      s?.published_date ? `(publicada ${s.published_date})` : null,
    ].filter(Boolean);
    return `${parts.join(" ")}.`;
  }

  if (node.type === "alerta_fiscal") {
    const r = node.raw as { status?: string } | null;
    return r?.status ?? "Responsabilidad fiscal reportada en el Boletín de Responsables Fiscales (Contraloría).";
  }

  if (node.type === "alerta_disciplinaria") {
    const r = node.raw as { records?: { category?: string }[] } | null;
    const categories = r?.records?.map((rec) => rec.category).filter(Boolean).join(", ");
    return `Antecedentes registrados en la Procuraduría (SIRI)${categories ? `: ${categories}` : ""}.`;
  }

  return "Detalle disponible en los datos del nodo.";
}

function formatWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" });
}

export default function NodeDetailPanel() {
  const selectedNodeId = useGraphStore((s) => s.selectedNodeId);
  const node = useGraphStore((s) => (selectedNodeId ? s.nodes.get(selectedNodeId) : undefined));
  const selectNode = useGraphStore((s) => s.selectNode);
  const ingest = useGraphStore((s) => s.ingest);
  const markExpanded = useGraphStore((s) => s.markExpanded);
  const setStatus = useGraphStore((s) => s.setStatus);
  const allNodes = useGraphStore((s) => s.nodes);
  const storyMode = useGraphStore((s) => s.storyMode);
  const caseId = useGraphStore((s) => s.caseId);
  const caseNodeMeta = useGraphStore((s) => s.caseNodeMeta);
  const caseNotes = useGraphStore((s) => s.caseNotes);
  const appendCaseNote = useGraphStore((s) => s.appendCaseNote);

  const [detail, setDetail] = useState<DetailResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanding, setExpanding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");
  const [addingNote, setAddingNote] = useState(false);

  useEffect(() => {
    if (!node) return;
    setDetail(null);
    setError(null);

    // En Modo Historia el caso es un guion precargado: el resumen ya viene embebido
    // en el nodo y no debe depender de una llamada al backend (la gracia de este modo
    // es funcionar aunque Croma esté caído o rate-limited).
    if (storyMode) {
      const raw = node.raw as { summary?: string } | null;
      setDetail({ summary: raw?.summary ?? "Nodo de este caso del Modo Historia.", raw: node.raw });
      return;
    }

    if (node.type === "sancion" || node.type === "alerta_fiscal" || node.type === "alerta_disciplinaria") {
      setDetail({ summary: localSummaryFor(node), raw: node.raw });
      return;
    }

    setLoading(true);
    api
      .detail(node.id, { nodeType: node.type, document_number: node.id })
      .then(setDetail)
      .catch((e) => setError(e instanceof Error ? e.message : "Error cargando detalle"))
      .finally(() => setLoading(false));
  }, [node?.id, storyMode]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") selectNode(null);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectNode]);

  if (!node) return null;

  async function handleExpand() {
    if (!node) return;
    setExpanding(true);
    try {
      const providerIds = Array.from(allNodes.values())
        .filter((n) => n.type === "proveedor")
        .map((n) => n.id);
      const entityIds = Array.from(allNodes.values())
        .filter((n) => n.type === "entidad_estatal")
        .map((n) => n.id);

      const result = await api.expand({
        nodeId: node.id,
        nodeType: node.type,
        document_number: node.id,
        existingProviderNits: providerIds,
        existingEntityNits: entityIds,
      });
      ingest(result.nodes, result.edges, result.mergedNodeIds);
      markExpanded(node.id);

      if (caseId && (result.nodes.length > 0 || result.edges.length > 0)) {
        api
          .addCaseItems(caseId, { author: ensureAuthorName(), nodes: result.nodes, edges: result.edges })
          .catch(() => {
            // Best-effort: si falla la sincronización, el grafo local ya se actualizó;
            // solo el resto del equipo no ve estos nodos hasta el próximo intento.
          });
      }
    } catch (e) {
      if (e instanceof RateLimitedError) {
        setStatus("rate_limited", { retryAfter: e.retryAfter });
      } else {
        setError(e instanceof Error ? e.message : "Error expandiendo el nodo");
      }
    } finally {
      setExpanding(false);
    }
  }

  async function handleAddNote() {
    if (!caseId || !node || !noteText.trim()) return;
    setAddingNote(true);
    try {
      const { note } = await api.addCaseNote(caseId, {
        nodeId: node.id,
        text: noteText.trim(),
        author: ensureAuthorName(),
      });
      appendCaseNote(note);
      setNoteText("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error agregando la nota");
    } finally {
      setAddingNote(false);
    }
  }

  const color = NODE_TYPE_COLOR[node.type];

  return (
    <aside
      key={node.id}
      style={{ borderLeftColor: color }}
      className="animate-panel-in fixed right-0 top-0 z-20 h-full w-full max-w-md overflow-y-auto border-l-[3px] bg-[#131318] p-6 shadow-2xl"
    >
      <div className="mb-1 flex items-start justify-between gap-3">
        <div>
          <span
            className="inline-block rounded-full px-2 py-0.5 text-xs font-medium"
            style={{ backgroundColor: `${color}22`, color }}
          >
            {NODE_TYPE_LABEL[node.type]}
          </span>
          <h2 className="mt-2 text-lg font-semibold text-white">{node.label}</h2>
          <p className="mt-0.5 font-mono text-xs text-zinc-500">{node.id}</p>
          {caseId && caseNodeMeta[node.id] && (
            <p className="mt-1 text-xs text-zinc-600">
              Traído por <span className="text-zinc-500">{caseNodeMeta[node.id].discovered_by}</span> ·{" "}
              {formatWhen(caseNodeMeta[node.id].discovered_at)}
            </p>
          )}
        </div>
        <button
          onClick={() => selectNode(null)}
          className="rounded-md p-1 text-zinc-400 hover:bg-white/10 hover:text-white"
          aria-label="Cerrar"
        >
          ✕
        </button>
      </div>
      <div className="my-4 h-px bg-white/10" />

      {loading && <p className="text-sm text-zinc-400">Cargando detalle…</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}

      {detail && <p className="mb-4 text-sm leading-relaxed text-zinc-300">{detail.summary}</p>}

      {storyMode ? (
        EXPANDABLE.includes(node.type) && (
          <p className="mb-4 text-xs text-zinc-500">
            Este nodo es parte del Modo Historia — usá "Siguiente" en el panel de abajo para continuar la
            investigación.
          </p>
        )
      ) : (
        <>
          {EXPANDABLE.includes(node.type) && !node.expanded && (
            <button
              onClick={handleExpand}
              disabled={expanding}
              className="mb-4 w-full rounded-md bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/20 disabled:opacity-50"
            >
              {expanding ? "Expandiendo…" : "Expandir"}
            </button>
          )}
          {node.expanded && EXPANDABLE.includes(node.type) && (
            <p className="mb-4 text-xs text-zinc-500">Este nodo ya fue expandido.</p>
          )}
        </>
      )}

      {detail?.sourceUrl && (
        <a
          href={detail.sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="mb-4 block text-sm text-blue-400 hover:underline"
        >
          Ver fuente oficial ↗
        </a>
      )}

      {caseId && (
        <div className="mb-4">
          <div className="mb-2 h-px bg-white/10" />
          <p className="mb-2 text-xs font-medium text-zinc-400">Notas del equipo sobre este nodo</p>
          {caseNotes.filter((n) => n.nodeId === node.id).length === 0 && (
            <p className="mb-2 text-xs text-zinc-600">Nadie dejó notas todavía.</p>
          )}
          <ul className="mb-2 space-y-2">
            {caseNotes
              .filter((n) => n.nodeId === node.id)
              .map((n) => (
                <li key={n.id} className="rounded border border-white/10 bg-black/20 p-2">
                  <p className="text-sm text-zinc-200">{n.text}</p>
                  <p className="mt-1 text-[10px] text-zinc-600">
                    {n.author} · {formatWhen(n.created_at)}
                  </p>
                </li>
              ))}
          </ul>
          <textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="Ej: esto huele raro, revisar el contrato…"
            className="h-16 w-full resize-none rounded border border-white/10 bg-black/30 p-2 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none"
          />
          <button
            onClick={handleAddNote}
            disabled={addingNote || !noteText.trim()}
            className="mt-1.5 rounded-md bg-white/10 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-white/20 disabled:opacity-50"
          >
            {addingNote ? "Agregando…" : "Agregar nota"}
          </button>
        </div>
      )}

      <details className="text-xs text-zinc-400">
        <summary className="cursor-pointer select-none text-zinc-300">Datos crudos</summary>
        <pre className="mt-2 max-h-96 overflow-auto rounded bg-black/40 p-2">
          {JSON.stringify(detail?.raw ?? node.raw, null, 2)}
        </pre>
      </details>
    </aside>
  );
}
