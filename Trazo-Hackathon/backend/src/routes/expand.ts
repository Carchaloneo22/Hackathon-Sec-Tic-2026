import { Router } from "express";
import type { ExpandRequest, ExpandResponse } from "../../../shared/types.js";
import { MAX_NODES_PER_EXPANSION } from "../../../shared/types.js";
import {
  secopContractsByProvider,
  secopSanctionsByProvider,
  secopProcessesByEntity,
  secopProcess,
  ruesEntityByNit,
  procuraduriaDisciplinaryRecords,
  contraloriaFiscalRecords,
  CromaRateLimitError,
} from "../services/data-source.js";
import {
  providerContractsToGraph,
  entityProcessesToGraph,
  sanctionsToGraph,
  fiscalAlertToGraph,
  disciplinaryAlertToGraph,
  pickDiverseContracts,
  pickCandidateProcesses,
  dedupeAndCap,
} from "../graph/transform.js";

const PROCESS_CANDIDATE_LIMIT = 8;
const CONTRACT_CANDIDATE_LIMIT = 12;
const PROCESS_DETAIL_CONCURRENCY = 4;

const router = Router();

/** Resuelve `items` en lotes de tamaño `limit` en vez de todos a la vez — demasiadas
 * requests concurrentes contra Croma son justo lo que dispara ECONNRESET. Además, si un
 * ítem falla incluso después de los reintentos de `post()`, se omite en vez de tumbar
 * toda la expansión (mejor un proceso menos que un 502 completo). */
async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += limit) {
    const batch = items.slice(i, i + limit);
    const settled = await Promise.allSettled(batch.map(fn));
    for (const outcome of settled) {
      if (outcome.status === "fulfilled") {
        results.push(outcome.value);
      } else {
        console.warn("[expand] se omitió un proceso tras fallo persistente:", outcome.reason);
      }
    }
  }
  return results;
}

router.post("/", async (req, res) => {
  const { nodeId, nodeType, document_number, existingProviderNits, existingEntityNits } =
    req.body as ExpandRequest;

  if (!document_number) {
    return res.status(400).json({ error: "document_number requerido" });
  }

  // El propio nodo que se está expandiendo siempre debe quedar "existente", para que
  // las aristas hacia/desde él sobrevivan al filtro de dedupeAndCap aunque el cliente
  // no lo haya incluido en sus arrays de nodos actuales.
  const existingIds = new Set([nodeId, ...(existingProviderNits ?? []), ...(existingEntityNits ?? [])]);

  try {
    if (nodeType === "proveedor") {
      const [contractsResponse, sanctionsResponse, registryResponse, disciplinaryResponse] = await Promise.all([
        secopContractsByProvider(document_number),
        secopSanctionsByProvider(document_number),
        ruesEntityByNit(document_number),
        procuraduriaDisciplinaryRecords(document_number, "NIT"),
      ]);
      const contracts = pickDiverseContracts(contractsResponse.data.contracts, CONTRACT_CANDIDATE_LIMIT);
      const providerLabel = contracts[0]?.provider ?? registryResponse.data.entity?.name ?? nodeId;
      const { nodes: contractNodes, edges: contractEdges } = providerContractsToGraph(
        document_number,
        providerLabel,
        contracts
      );
      const { nodes: sanctionNodes, edges: sanctionEdges } = sanctionsToGraph(
        document_number,
        sanctionsResponse.data.sanctions
      );
      const { nodes: disciplinaryNodes, edges: disciplinaryEdges } = disciplinaryAlertToGraph(
        document_number,
        disciplinaryResponse.data
      );

      // La responsabilidad fiscal (Contraloría) se consulta por persona, no por NIT — solo
      // se dispara si RUES nos dio un representante legal identificado para este proveedor.
      let fiscalNodes: typeof sanctionNodes = [];
      let fiscalEdges: typeof sanctionEdges = [];
      const legalRep = registryResponse.data.related_parties?.find((p) => /representante legal/i.test(p.role));
      if (legalRep) {
        const fiscalResponse = await contraloriaFiscalRecords(legalRep.document_number, "CC");
        ({ nodes: fiscalNodes, edges: fiscalEdges } = fiscalAlertToGraph(
          document_number,
          legalRep.name,
          fiscalResponse.data
        ));
      }

      // Las alertas van primero: son pocas y valiosas, no deben perderse si el tope
      // de nodos nuevos recorta la cola de contratos.
      const result = dedupeAndCap(
        [...sanctionNodes, ...disciplinaryNodes, ...fiscalNodes, ...contractNodes],
        [...sanctionEdges, ...disciplinaryEdges, ...fiscalEdges, ...contractEdges],
        existingIds,
        MAX_NODES_PER_EXPANSION
      );
      return res.json(result satisfies ExpandResponse);
    }

    if (nodeType === "entidad_estatal") {
      const fromDate = new Date();
      fromDate.setFullYear(fromDate.getFullYear() - 3);
      const listResponse = await secopProcessesByEntity(document_number, {
        from_date: fromDate.toISOString().slice(0, 10),
      });
      const candidates = pickCandidateProcesses(listResponse.data.processes, PROCESS_CANDIDATE_LIMIT);

      const details = await mapWithConcurrency(candidates, PROCESS_DETAIL_CONCURRENCY, (c) =>
        secopProcess(c.notice_uid as string).then((r) => r.data)
      );

      const { nodes, edges } = entityProcessesToGraph(document_number, details);
      const result = dedupeAndCap(nodes, edges, existingIds, MAX_NODES_PER_EXPANSION);
      return res.json(result satisfies ExpandResponse);
    }

    return res.status(400).json({ error: `nodeType "${nodeType}" no es expandible` });
  } catch (error) {
    if (error instanceof CromaRateLimitError) {
      return res.status(429).json({ status: "rate_limited", retry_after: error.retryAfter });
    }
    console.error("[expand] error", error);
    return res.status(502).json({ error: "Error consultando Croma" });
  }
});

export default router;
