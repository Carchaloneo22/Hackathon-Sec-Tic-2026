import { useRef, useState } from "react";
import { useGraphStore } from "../store/graphStore";
import { ensureAuthorName } from "../store/identityStore";
import { buildShareUrl } from "../lib/shareGraph";
import * as api from "../api/client";

export default function CaseControls() {
  const nodesMap = useGraphStore((s) => s.nodes);
  const edgesMap = useGraphStore((s) => s.edges);
  const storyMode = useGraphStore((s) => s.storyMode);
  const isRevealing = useGraphStore((s) => s.isRevealing());
  const caseId = useGraphStore((s) => s.caseId);
  const caseTitle = useGraphStore((s) => s.caseTitle);
  const attachCase = useGraphStore((s) => s.attachCase);

  const [copied, setCopied] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  if (nodesMap.size === 0 || storyMode || isRevealing) return null;

  function flashCopied() {
    setCopied(true);
    if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
    copiedTimerRef.current = setTimeout(() => setCopied(false), 2000);
  }

  async function copyText(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      flashCopied();
    } catch {
      window.prompt("Copiá el link:", text);
    }
  }

  async function handleShare() {
    const url = buildShareUrl(Array.from(nodesMap.values()), Array.from(edgesMap.values()));
    await copyText(url);
  }

  async function handleCreateCase() {
    const author = ensureAuthorName();
    const rootLabel = Array.from(nodesMap.values())[0]?.label ?? "Caso sin título";
    setCreating(true);
    setError(null);
    try {
      const { case: snapshot } = await api.createCase({
        title: rootLabel,
        author,
        nodes: Array.from(nodesMap.values()),
        edges: Array.from(edgesMap.values()),
      });
      attachCase(snapshot);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error creando la sala");
    } finally {
      setCreating(false);
    }
  }

  if (caseId) {
    return (
      <div className="pointer-events-auto absolute bottom-4 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full border border-emerald-500/30 bg-[#131318]/90 px-3 py-1.5 text-xs text-emerald-200 shadow-lg backdrop-blur">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
        <span className="max-w-[220px] truncate">Sala: {caseTitle}</span>
        <button
          onClick={() => copyText(window.location.href)}
          className="text-emerald-300 underline hover:text-emerald-100"
        >
          {copied ? "copiado ✓" : "copiar link"}
        </button>
      </div>
    );
  }

  return (
    <div className="pointer-events-auto absolute bottom-4 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2">
      <button
        onClick={handleShare}
        className="rounded-full border border-white/10 bg-[#131318]/90 px-3 py-1.5 text-xs text-zinc-300 shadow-lg backdrop-blur transition hover:bg-white/10"
      >
        {copied ? "Link copiado ✓" : "🔗 Compartir grafo"}
      </button>
      <button
        onClick={handleCreateCase}
        disabled={creating}
        className="rounded-full border border-emerald-500/30 bg-[#131318]/90 px-3 py-1.5 text-xs text-emerald-300 shadow-lg backdrop-blur transition hover:bg-emerald-500/10 disabled:opacity-50"
      >
        {creating ? "Creando sala…" : "👥 Crear sala de investigación"}
      </button>
      {error && <span className="text-xs text-red-400">{error}</span>}
    </div>
  );
}
