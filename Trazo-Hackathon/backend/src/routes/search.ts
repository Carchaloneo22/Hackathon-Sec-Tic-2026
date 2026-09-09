import { Router } from "express";
import type { SearchRequest, SearchResponse, SearchCandidate } from "../../../shared/types.js";
import { ruesEntitiesByName, CromaRateLimitError } from "../services/data-source.js";
import { ruesSummaryToCandidate } from "../graph/transform.js";
import knownEntities from "../data/known-entities.json" with { type: "json" };

const NIT_PATTERN = /^\d{4,15}$/;

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

const router = Router();

router.post("/", async (req, res) => {
  const { query, kind } = req.body as SearchRequest;

  if (!query || query.trim().length < 3) {
    return res.status(400).json({ error: "query debe tener al menos 3 caracteres" });
  }

  try {
    if (kind === "proveedor") {
      const response = await ruesEntitiesByName(query.trim());
      const candidates: SearchCandidate[] = response.data.entities
        .filter((e) => e.nit)
        .map(ruesSummaryToCandidate);
      return res.json({ candidates } satisfies SearchResponse);
    }

    // kind === "entidad": lista semilla curada (Croma no expone búsqueda de
    // entidades públicas por nombre — RUES solo indexa registro mercantil privado).
    const normalized = normalize(query.trim());
    const candidates: SearchCandidate[] = (
      knownEntities as { nit: string; name: string; meta?: string }[]
    )
      .filter((e) => normalize(e.name).includes(normalized))
      .map((e) => ({
        id: e.nit,
        label: e.name,
        nit: e.nit,
        type: "entidad_estatal" as const,
        meta: e.meta,
      }));

    if (NIT_PATTERN.test(query.trim()) && !candidates.some((c) => c.nit === query.trim())) {
      candidates.push({
        id: query.trim(),
        label: `NIT ${query.trim()}`,
        nit: query.trim(),
        type: "entidad_estatal",
        meta: "Entidad fuera de la lista curada — verificar al expandir",
      });
    }

    return res.json({ candidates } satisfies SearchResponse);
  } catch (error) {
    if (error instanceof CromaRateLimitError) {
      return res.status(429).json({ status: "rate_limited", retry_after: error.retryAfter });
    }
    console.error("[search] error", error);
    return res.status(502).json({ error: "Error consultando Croma" });
  }
});

export default router;
