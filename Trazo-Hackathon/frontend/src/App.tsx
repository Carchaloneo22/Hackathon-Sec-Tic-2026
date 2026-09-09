import { useEffect } from "react";
import GraphCanvas from "./components/GraphCanvas";
import SearchBar from "./components/SearchBar";
import NodeDetailPanel from "./components/NodeDetailPanel";
import FilterPanel from "./components/FilterPanel";
import StoryMode from "./components/StoryMode";
import NotesPanel from "./components/NotesPanel";
import CaseControls from "./components/CaseControls";
import LoginScreen from "./components/LoginScreen";
import { useGraphStore } from "./store/graphStore";
import { useAuthStore } from "./store/authStore";
import { readGraphFromLocation } from "./lib/shareGraph";
import * as api from "./api/client";

const CASE_POLL_MS = 7000;

function DiscoveryIndicator() {
  const nodesCount = useGraphStore((s) => s.nodes.size);
  const pendingCount = useGraphStore((s) => s.pendingNodes.length + s.pendingEdges.length);
  const isRevealing = useGraphStore((s) => s.isRevealing());

  if (!isRevealing && nodesCount === 0) return null;

  return (
    <div className="pointer-events-none absolute bottom-4 left-4 z-30 flex items-center gap-2 rounded-full border border-white/10 bg-[#131318]/90 px-3 py-1.5 text-xs text-zinc-300 shadow-lg backdrop-blur">
      {isRevealing ? (
        <>
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
          <span>
            descubriendo conexiones… {nodesCount} nodo(s), {pendingCount} por revelar
          </span>
        </>
      ) : (
        <span>{nodesCount} nodo(s) en el grafo</span>
      )}
    </div>
  );
}

function RateLimitBanner() {
  const status = useGraphStore((s) => s.status);
  const retryAfter = useGraphStore((s) => s.retryAfter);
  const setStatus = useGraphStore((s) => s.setStatus);

  if (status !== "rate_limited") return null;

  return (
    <div className="pointer-events-none absolute top-4 left-1/2 z-40 -translate-x-1/2 rounded-full border border-amber-500/30 bg-amber-950/90 px-4 py-2 text-sm text-amber-200 shadow-lg backdrop-blur">
      Croma está ocupado, reintentando… {retryAfter ? `(${retryAfter}s)` : ""}
      <button
        onClick={() => setStatus("idle")}
        className="pointer-events-auto ml-3 underline hover:text-amber-100"
      >
        cerrar
      </button>
    </div>
  );
}

function LogoutButton() {
  const clear = useAuthStore((s) => s.clear);
  return (
    <button
      onClick={clear}
      className="pointer-events-auto absolute right-4 top-4 z-30 rounded-full border border-white/10 bg-[#131318]/90 px-3 py-1.5 text-xs text-zinc-400 shadow-lg backdrop-blur hover:text-zinc-200"
    >
      Salir
    </button>
  );
}

function App() {
  const token = useAuthStore((s) => s.token);
  const ingest = useGraphStore((s) => s.ingest);
  const hydrateCase = useGraphStore((s) => s.hydrateCase);
  const mergeCaseUpdate = useGraphStore((s) => s.mergeCaseUpdate);
  const caseId = useGraphStore((s) => s.caseId);

  // Al montar: si la URL trae ?case=<id> (sala de investigación persistida), la carga
  // desde el backend. Si no, cae al link efímero #g=... (compartir sin backend).
  useEffect(() => {
    if (!token) return;
    const caseParam = new URLSearchParams(window.location.search).get("case");
    if (caseParam) {
      api
        .getCase(caseParam)
        .then(({ case: snapshot }) => hydrateCase(snapshot))
        .catch(() => {
          const shared = readGraphFromLocation();
          if (shared) ingest(shared.nodes, shared.edges);
        });
      return;
    }
    const shared = readGraphFromLocation();
    if (shared) ingest(shared.nodes, shared.edges);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Sincronización simple por polling (Fase 5: no WebSockets) mientras haya una sala activa.
  useEffect(() => {
    if (!token || !caseId) return;
    const interval = setInterval(() => {
      api
        .getCase(caseId)
        .then(({ case: snapshot }) => mergeCaseUpdate(snapshot))
        .catch(() => {});
    }, CASE_POLL_MS);
    return () => clearInterval(interval);
  }, [token, caseId, mergeCaseUpdate]);

  if (!token) return <LoginScreen />;

  return (
    <div className="relative h-full w-full">
      <GraphCanvas />
      <SearchBar />
      <FilterPanel />
      <NotesPanel />
      <DiscoveryIndicator />
      <RateLimitBanner />
      <LogoutButton />
      <StoryMode />
      <CaseControls />
      <NodeDetailPanel />
    </div>
  );
}

export default App;
