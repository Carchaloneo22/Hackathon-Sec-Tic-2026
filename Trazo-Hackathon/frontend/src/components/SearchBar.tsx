import { useEffect, useRef, useState } from "react";
import type { SearchCandidate, SearchKind } from "@shared/types";
import { useGraphStore } from "../store/graphStore";
import * as api from "../api/client";
import { RateLimitedError } from "../api/client";

export default function SearchBar() {
  const [kind, setKind] = useState<SearchKind>("proveedor");
  const [query, setQuery] = useState("");
  const [candidates, setCandidates] = useState<SearchCandidate[]>([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const ingest = useGraphStore((s) => s.ingest);
  const reset = useGraphStore((s) => s.reset);
  const setStatus = useGraphStore((s) => s.setStatus);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 3) {
      setCandidates([]);
      setOpen(false);
      setSearchError(null);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      setSearchError(null);
      try {
        const result = await api.search({ query: query.trim(), kind });
        setCandidates(result.candidates);
        setOpen(true);
      } catch (e) {
        if (e instanceof RateLimitedError) {
          setStatus("rate_limited", { retryAfter: e.retryAfter });
        } else {
          setSearchError(e instanceof Error ? e.message : "Error buscando");
          setCandidates([]);
          setOpen(true);
        }
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, kind, setStatus]);

  function selectCandidate(candidate: SearchCandidate) {
    reset();
    setStatus("loading");
    ingest(
      [
        {
          id: candidate.nit || candidate.id,
          type: candidate.type,
          label: candidate.label,
          raw: candidate,
          discovered_at: 0,
          expanded: false,
        },
      ],
      []
    );
    setStatus("idle");
    setOpen(false);
    setQuery("");
    setCandidates([]);
  }

  return (
    <div className="pointer-events-auto absolute left-4 top-4 z-30 w-full max-w-sm">
      <div className="flex overflow-hidden rounded-lg border border-white/10 bg-[#131318]/95 shadow-xl backdrop-blur">
        <div className="flex items-center border-r border-white/10">
          {(["proveedor", "entidad"] as SearchKind[]).map((k) => (
            <button
              key={k}
              onClick={() => setKind(k)}
              className={`px-3 py-2.5 text-xs font-medium transition ${
                kind === k ? "bg-white/10 text-white" : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {k === "proveedor" ? "Proveedor" : "Entidad"}
            </button>
          ))}
        </div>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => candidates.length > 0 && setOpen(true)}
          placeholder={kind === "proveedor" ? "Buscar empresa por nombre…" : "Buscar entidad pública…"}
          className="w-full bg-transparent px-3 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none"
        />
      </div>

      {open && candidates.length > 0 && (
        <ul className="mt-1 max-h-72 overflow-y-auto rounded-lg border border-white/10 bg-[#131318]/95 shadow-xl backdrop-blur">
          {candidates.map((c) => (
            <li key={c.id}>
              <button
                onClick={() => selectCandidate(c)}
                className="block w-full px-3 py-2 text-left text-sm text-zinc-200 hover:bg-white/10"
              >
                <span className="block font-medium">{c.label}</span>
                {c.meta && <span className="block text-xs text-zinc-500">{c.meta}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
      {open && !searching && searchError && (
        <div className="mt-1 rounded-lg border border-red-500/20 bg-[#131318]/95 px-3 py-2 text-sm text-red-400 shadow-xl backdrop-blur">
          {searchError}
        </div>
      )}
      {open && !searching && !searchError && candidates.length === 0 && query.trim().length >= 3 && (
        <div className="mt-1 rounded-lg border border-white/10 bg-[#131318]/95 px-3 py-2 text-sm text-zinc-500 shadow-xl backdrop-blur">
          Sin resultados
        </div>
      )}
    </div>
  );
}
