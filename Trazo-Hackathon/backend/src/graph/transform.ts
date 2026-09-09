import type { GraphNode, GraphEdge } from "../../../shared/types.js";
import type {
  SecopContract,
  SecopProcessSummary,
  SecopProcessResponse,
  SecopSanction,
  RuesEntitySummary,
  ContraloriaFiscalRecordResponse,
  ProcuraduriaDisciplinaryRecordResponse,
} from "../services/croma-types.js";

function edgeId(source: string, target: string, type: GraphEdge["type"]): string {
  return `${source}->${target}:${type}`;
}

/** Ruta principal de expansión: proveedor -> sus contratos -> entidades que lo contrataron. */
export function providerContractsToGraph(
  providerNit: string,
  providerLabel: string,
  contracts: SecopContract[]
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const seenEntities = new Set<string>();
  const entityOrder: string[] = [];

  for (const contract of contracts) {
    if (!seenEntities.has(contract.entity_nit)) {
      seenEntities.add(contract.entity_nit);
      entityOrder.push(contract.entity_nit);
      nodes.push({
        id: contract.entity_nit,
        type: "entidad_estatal",
        label: contract.entity,
        raw: { entity: contract.entity, entity_nit: contract.entity_nit },
        discovered_at: 0,
        expanded: false,
      });
    }

    nodes.push({
      id: contract.contract_id,
      type: "contrato",
      label: contract.object ?? contract.contract_id,
      raw: contract,
      discovered_at: 0,
      expanded: true,
    });

    edges.push({
      id: edgeId(contract.entity_nit, providerNit, "contrató_a"),
      source: contract.entity_nit,
      target: providerNit,
      type: "contrató_a",
      raw: { contract_id: contract.contract_id, value: contract.value },
    });
    edges.push({
      id: edgeId(providerNit, contract.contract_id, "ejecuta"),
      source: providerNit,
      target: contract.contract_id,
      type: "ejecuta",
    });
  }

  // El momento "wow" de la demo: cuando este proveedor tiene contratos con más de
  // una entidad, esas entidades quedan conectadas entre sí — es la red de
  // contratistas recurrentes que el grafo hace visible (ver CLAUDE.md sección 4).
  for (let i = 0; i < entityOrder.length; i++) {
    for (let j = i + 1; j < entityOrder.length; j++) {
      edges.push({
        id: edgeId(entityOrder[i], entityOrder[j], "comparte_proveedor_con"),
        source: entityOrder[i],
        target: entityOrder[j],
        type: "comparte_proveedor_con",
        raw: { via_provider: providerNit, via_provider_label: providerLabel },
      });
    }
  }

  return { nodes, edges };
}

/** Ruta de expansión desde una entidad: procesos con notice_uid ya resueltos vía secop_process. */
export function entityProcessesToGraph(
  entityNit: string,
  processDetails: SecopProcessResponse[]
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const seenProviders = new Set<string>();

  for (const detail of processDetails) {
    if (!detail.found || !detail.contracts) continue;

    for (const contract of detail.contracts) {
      if (!seenProviders.has(contract.provider_document)) {
        seenProviders.add(contract.provider_document);
        nodes.push({
          id: contract.provider_document,
          type: "proveedor",
          label: contract.provider,
          raw: { provider: contract.provider, provider_document: contract.provider_document },
          discovered_at: 0,
          expanded: false,
        });
      }

      nodes.push({
        id: contract.contract_id,
        type: "contrato",
        label: contract.object ?? contract.contract_id,
        raw: contract,
        discovered_at: 0,
        expanded: true,
      });

      edges.push({
        id: edgeId(entityNit, contract.provider_document, "contrató_a"),
        source: entityNit,
        target: contract.provider_document,
        type: "contrató_a",
        raw: { contract_id: contract.contract_id, value: contract.value },
      });
      edges.push({
        id: edgeId(contract.provider_document, contract.contract_id, "ejecuta"),
        source: contract.provider_document,
        target: contract.contract_id,
        type: "ejecuta",
      });
    }
  }

  return { nodes, edges };
}

/** Prioriza contratos que introducen una entidad contratante nueva, para maximizar
 * la diversidad de `comparte_proveedor_con` en vez de repetir siempre la misma entidad. */
export function pickDiverseContracts(contracts: SecopContract[], limit: number): SecopContract[] {
  const seenEntities = new Set<string>();
  const withNewEntity: SecopContract[] = [];
  const rest: SecopContract[] = [];

  for (const contract of contracts) {
    if (!seenEntities.has(contract.entity_nit)) {
      seenEntities.add(contract.entity_nit);
      withNewEntity.push(contract);
    } else {
      rest.push(contract);
    }
  }

  return [...withNewEntity, ...rest].slice(0, limit);
}

export function pickCandidateProcesses(
  processes: SecopProcessSummary[],
  limit: number
): SecopProcessSummary[] {
  const withNotice = processes.filter(
    (p) => p.notice_uid && p.procedure_status !== "Cancelado" && p.procedure_status !== "Borrador"
  );
  return withNotice.slice(0, limit);
}

export function sanctionsToGraph(
  providerNit: string,
  sanctions: SecopSanction[]
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  sanctions.forEach((sanction, index) => {
    const id = `sancion:${providerNit}:${sanction.resolution_number ?? index}`;
    nodes.push({
      id,
      type: "sancion",
      label: sanction.resolution_number
        ? `Sanción ${sanction.resolution_number}`
        : "Sanción sin número de resolución",
      raw: sanction,
      discovered_at: 0,
      expanded: true,
    });
    edges.push({
      id: edgeId(providerNit, id, "sancionado_en"),
      source: providerNit,
      target: id,
      type: "sancionado_en",
    });
  });

  return { nodes, edges };
}

/** Contraloría (SIBOR): responsabilidad fiscal del representante legal del proveedor.
 * No hay tipo de nodo "persona" en el modelo (ver CLAUDE.md sección 9) — la alerta
 * cuelga directo del proveedor, con el nombre de la persona como contexto en el label. */
export function fiscalAlertToGraph(
  providerNit: string,
  legalRepName: string,
  record: ContraloriaFiscalRecordResponse
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  if (!record.is_fiscal_responsible) return { nodes: [], edges: [] };

  const id = `alerta_fiscal:${providerNit}`;
  return {
    nodes: [
      {
        id,
        type: "alerta_fiscal",
        label: `Responsabilidad fiscal — ${legalRepName}`,
        raw: record,
        discovered_at: 0,
        expanded: true,
      },
    ],
    edges: [{ id: edgeId(providerNit, id, "tiene_alerta"), source: providerNit, target: id, type: "tiene_alerta" }],
  };
}

/** Procuraduría (SIRI): antecedentes disciplinarios/penales/contractuales del proveedor,
 * consultados directamente por su NIT. */
export function disciplinaryAlertToGraph(
  providerNit: string,
  record: ProcuraduriaDisciplinaryRecordResponse
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  if (!record.has_records) return { nodes: [], edges: [] };

  const id = `alerta_disciplinaria:${providerNit}`;
  const categories = record.records.map((r) => r.category).join(", ");
  return {
    nodes: [
      {
        id,
        type: "alerta_disciplinaria",
        label: categories ? `Antecedente: ${categories}` : "Antecedente disciplinario",
        raw: record,
        discovered_at: 0,
        expanded: true,
      },
    ],
    edges: [{ id: edgeId(providerNit, id, "tiene_alerta"), source: providerNit, target: id, type: "tiene_alerta" }],
  };
}

export function ruesSummaryToCandidate(entity: RuesEntitySummary) {
  return {
    id: entity.nit ?? entity.registry_id ?? entity.name ?? "",
    label: entity.name ?? "(sin nombre)",
    nit: entity.nit ?? "",
    type: "proveedor" as const,
    meta: entity.chamber_name ?? undefined,
  };
}

/**
 * Dado un nuevo lote de nodos y los NITs que el cliente ya tiene en su grafo,
 * separa los que hay que fusionar (ya existen) de los realmente nuevos, y aplica
 * el tope de nodos nuevos por expansión priorizando diversidad de entidad_nit.
 */
export function dedupeAndCap(
  newNodes: GraphNode[],
  newEdges: GraphEdge[],
  existingIds: Set<string>,
  maxNewNodes: number
): { nodes: GraphNode[]; edges: GraphEdge[]; mergedNodeIds: string[]; truncated: boolean } {
  const mergedNodeIds: string[] = [];
  const freshNodes: GraphNode[] = [];
  const seen = new Set<string>();

  for (const node of newNodes) {
    if (seen.has(node.id)) continue;
    seen.add(node.id);
    if (existingIds.has(node.id)) {
      mergedNodeIds.push(node.id);
    } else {
      freshNodes.push(node);
    }
  }

  const truncated = freshNodes.length > maxNewNodes;
  const cappedFresh = freshNodes.slice(0, maxNewNodes);
  const keptIds = new Set([...cappedFresh.map((n) => n.id), ...existingIds]);

  const edges = newEdges.filter((e) => keptIds.has(e.source) && keptIds.has(e.target));

  return { nodes: cappedFresh, edges, mergedNodeIds, truncated };
}
