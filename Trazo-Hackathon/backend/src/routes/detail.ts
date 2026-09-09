import { Router } from "express";
import type { DetailRequest, DetailResponse } from "../../../shared/types.js";
import {
  ruesEntityByNit,
  secopContractsByProvider,
  secopSanctionsByProvider,
  secopProcessesByEntity,
  secopContract,
  procuraduriaDisciplinaryRecords,
  contraloriaFiscalRecords,
  CromaRateLimitError,
} from "../services/data-source.js";

const router = Router();

function formatCOP(value: number | null | undefined): string {
  if (!value) return "valor no reportado";
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(
    value
  );
}

router.post("/:nodeId", async (req, res) => {
  const { nodeType, document_number } = req.body as DetailRequest;

  try {
    if (nodeType === "proveedor") {
      const [registry, contracts, sanctions, disciplinary] = await Promise.all([
        ruesEntityByNit(document_number),
        secopContractsByProvider(document_number),
        secopSanctionsByProvider(document_number),
        procuraduriaDisciplinaryRecords(document_number, "NIT"),
      ]);

      const legalRep = registry.data.related_parties?.find((p) => /representante legal/i.test(p.role));
      const fiscal = legalRep ? await contraloriaFiscalRecords(legalRep.document_number, "CC") : null;

      const distinctEntities = new Set(contracts.data.contracts.map((c) => c.entity_nit)).size;
      const totalValue = contracts.data.contracts.reduce((sum, c) => sum + (c.value ?? 0), 0);
      const registered = registry.data.found;

      const summary = [
        registered
          ? `${registry.data.entity?.name ?? "Esta empresa"} está ${registry.data.entity?.registration_status?.toLowerCase() ?? "registrada"} en el registro mercantil (${registry.data.entity?.chamber_name ?? "cámara de comercio"}).`
          : `No se encontró registro mercantil (RUES) para el NIT ${document_number}.`,
        `Ha ganado ${contracts.data.contracts.length} contrato(s) públicos con ${distinctEntities} entidad(es) estatal(es) distinta(s), por un total de ${formatCOP(totalValue)}.`,
        sanctions.data.count > 0
          ? `Tiene ${sanctions.data.count} sanción(es) registrada(s) como contratista del Estado.`
          : "No tiene sanciones registradas como contratista del Estado.",
        disciplinary.data.has_records
          ? "Tiene antecedentes disciplinarios registrados en la Procuraduría."
          : "No tiene antecedentes disciplinarios registrados en la Procuraduría.",
        fiscal?.data.is_fiscal_responsible
          ? `Su representante legal (${legalRep!.name}) figura como responsable fiscal ante la Contraloría.`
          : null,
      ]
        .filter(Boolean)
        .join(" ");

      return res.json({
        summary,
        raw: { registry: registry.data, sanctions: sanctions.data, disciplinary: disciplinary.data, fiscal: fiscal?.data ?? null },
        sourceUrl: contracts.data.contracts[0]?.url ?? undefined,
      } satisfies DetailResponse);
    }

    if (nodeType === "entidad_estatal") {
      const fromDate = new Date();
      fromDate.setFullYear(fromDate.getFullYear() - 3);
      const processes = await secopProcessesByEntity(document_number, {
        from_date: fromDate.toISOString().slice(0, 10),
      });

      const summary = `Esta entidad ha publicado ${processes.data.count} proceso(s) de contratación en los últimos 3 años (según SECOP II)${processes.data.capped ? ", puede haber más" : ""}.`;

      return res.json({
        summary,
        raw: { processes_sample: processes.data.processes.slice(0, 20), count: processes.data.count },
      } satisfies DetailResponse);
    }

    if (nodeType === "contrato") {
      const detail = await secopContract(document_number);
      const c = detail.data.contract;
      const summary = c
        ? `Contrato ${c.contract_type ?? ""} entre ${c.entity} y ${c.provider}, por ${formatCOP(c.value)}, estado: ${c.status ?? "no reportado"}.`
        : "No se encontró el detalle completo de este contrato.";

      return res.json({
        summary,
        raw: detail.data,
        sourceUrl: c?.url ?? undefined,
      } satisfies DetailResponse);
    }

    // sancion / alerta_fiscal / alerta_disciplinaria: el frontend ya tiene el `raw`
    // del nodo (viene embebido desde la expansión) y no requiere otra llamada a Croma.
    return res.json({
      summary: "Detalle disponible en los datos del nodo.",
      raw: null,
    } satisfies DetailResponse);
  } catch (error) {
    if (error instanceof CromaRateLimitError) {
      return res.status(429).json({ status: "rate_limited", retry_after: error.retryAfter });
    }
    console.error("[detail] error", error);
    return res.status(502).json({ error: "Error consultando Croma" });
  }
});

export default router;
