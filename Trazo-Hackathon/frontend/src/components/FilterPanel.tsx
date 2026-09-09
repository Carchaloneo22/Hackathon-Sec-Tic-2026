import { useState } from "react";
import type { NodeType } from "@shared/types";
import { NODE_TYPE_COLOR } from "@shared/types";
import { useGraphStore } from "../store/graphStore";

const NODE_TYPE_LABEL: Record<NodeType, string> = {
  entidad_estatal: "Entidades",
  proveedor: "Proveedores",
  contrato: "Contratos",
  sancion: "Sanciones",
  alerta_fiscal: "Alertas fiscales",
  alerta_disciplinaria: "Alertas disciplinarias",
};

const ALL_TYPES = Object.keys(NODE_TYPE_LABEL) as NodeType[];

export default function FilterPanel() {
  const nodes = useGraphStore((s) => s.nodes);
  const hiddenTypes = useGraphStore((s) => s.hiddenTypes);
  const toggleTypeVisibility = useGraphStore((s) => s.toggleTypeVisibility);
  const contractFilters = useGraphStore((s) => s.contractFilters);
  const setContractFilters = useGraphStore((s) => s.setContractFilters);
  const requestFocus = useGraphStore((s) => s.requestFocus);
  const [collapsed, setCollapsed] = useState(true);
  const [focusQuery, setFocusQuery] = useState("");

  if (nodes.size === 0) return null;

  const focusMatches =
    focusQuery.trim().length >= 2
      ? Array.from(nodes.values())
          .filter((n) => n.label.toLowerCase().includes(focusQuery.trim().toLowerCase()))
          .slice(0, 8)
      : [];

  return (
    <div className="pointer-events-auto absolute right-4 top-4 z-30 w-56 rounded-lg border border-white/10 bg-[#131318]/95 text-sm shadow-xl backdrop-blur">
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="flex w-full items-center justify-between px-3 py-2.5 text-xs font-medium text-zinc-300 hover:text-white"
      >
        <span>Filtros</span>
        <span className="text-zinc-500">{collapsed ? "▾" : "▴"}</span>
      </button>

      {!collapsed && (
        <div className="space-y-3 border-t border-white/10 px-3 py-3">
          <div>
            <p className="mb-1.5 text-xs font-medium text-zinc-400">Buscar en el grafo</p>
            <input
              type="text"
              value={focusQuery}
              onChange={(e) => setFocusQuery(e.target.value)}
              placeholder="Nombre del nodo…"
              className="w-full rounded border border-white/10 bg-black/30 px-2 py-1 text-xs text-white placeholder:text-zinc-600 focus:outline-none"
            />
            {focusMatches.length > 0 && (
              <ul className="mt-1 max-h-32 overflow-y-auto rounded border border-white/10 bg-black/30">
                {focusMatches.map((n) => (
                  <li key={n.id}>
                    <button
                      onClick={() => {
                        requestFocus(n.id);
                        setFocusQuery("");
                      }}
                      className="block w-full truncate px-2 py-1 text-left text-xs text-zinc-300 hover:bg-white/10"
                    >
                      {n.label}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="space-y-1.5 border-t border-white/10 pt-3">
            {ALL_TYPES.map((type) => (
              <label key={type} className="flex cursor-pointer items-center gap-2 text-xs text-zinc-300">
                <input
                  type="checkbox"
                  checked={!hiddenTypes.has(type)}
                  onChange={() => toggleTypeVisibility(type)}
                  className="accent-current"
                  style={{ color: NODE_TYPE_COLOR[type] }}
                />
                <span
                  className="inline-block h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: NODE_TYPE_COLOR[type] }}
                />
                {NODE_TYPE_LABEL[type]}
              </label>
            ))}
          </div>

          <div className="border-t border-white/10 pt-3">
            <p className="mb-1.5 text-xs font-medium text-zinc-400">Contratos</p>
            <label className="mb-1.5 block text-xs text-zinc-500">
              Valor mínimo (COP)
              <input
                type="number"
                min={0}
                placeholder="0"
                value={contractFilters.minValue ?? ""}
                onChange={(e) =>
                  setContractFilters({ minValue: e.target.value ? Number(e.target.value) : undefined })
                }
                className="mt-1 w-full rounded border border-white/10 bg-black/30 px-2 py-1 text-xs text-white focus:outline-none"
              />
            </label>
            <div className="flex gap-1.5">
              <label className="flex-1 text-xs text-zinc-500">
                Desde
                <input
                  type="date"
                  value={contractFilters.dateFrom ?? ""}
                  onChange={(e) => setContractFilters({ dateFrom: e.target.value || undefined })}
                  className="mt-1 w-full rounded border border-white/10 bg-black/30 px-1.5 py-1 text-xs text-white focus:outline-none"
                />
              </label>
              <label className="flex-1 text-xs text-zinc-500">
                Hasta
                <input
                  type="date"
                  value={contractFilters.dateTo ?? ""}
                  onChange={(e) => setContractFilters({ dateTo: e.target.value || undefined })}
                  className="mt-1 w-full rounded border border-white/10 bg-black/30 px-1.5 py-1 text-xs text-white focus:outline-none"
                />
              </label>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
