// Implementación "mock" de los mismos endpoints que expone services/croma.ts,
// para poder probar el flujo completo de Trazo sin una CROMA_API_KEY real.
// Ver services/data-source.ts para la lógica de selección real vs. mock.

import {
  MOCK_ENTITIES,
  MOCK_PROVIDERS,
  MOCK_SANCTIONS,
  MOCK_LEGAL_REPS,
  MOCK_FISCAL_RESPONSIBLE,
  MOCK_DISCIPLINARY_RECORDS,
  contractsByProvider,
  contractsByEntity,
  seedsByEntity,
  seedByNoticeUid,
  contractById,
  ruesSummaryForProvider,
} from "../data/mock-fixtures.js";
import type {
  RuesEntitiesByNameResponseWrapper,
  RuesEntityByNitResponse,
  SecopProcessesByEntityResponse,
  SecopContractsByProviderResponse,
  SecopSanctionsByProviderResponse,
  SecopProcessResponse,
  SecopContractResponse,
  SecopProcessSummary,
  ContraloriaFiscalRecordResponse,
  ProcuraduriaDisciplinaryRecordResponse,
} from "./croma-types.js";

// Pequeña latencia simulada para que el revelado escalonado del frontend se sienta natural.
function delay<T>(value: T): Promise<T> {
  const ms = 250 + Math.random() * 400;
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

const emptyPagination = (total: number) => ({ total, page_size: 500, total_pages: 1, page: 1 });

export function ruesEntitiesByName(name: string, _page = 1): Promise<RuesEntitiesByNameResponseWrapper> {
  const normalized = name.trim().toLowerCase();
  const entities = MOCK_PROVIDERS.filter((p) => p.name.toLowerCase().includes(normalized)).map(
    ruesSummaryForProvider
  );
  return delay({
    data: { query: name, capped: false, entities, pagination: emptyPagination(entities.length) },
  });
}

export function ruesEntityByNit(document_number: string): Promise<{ data: RuesEntityByNitResponse }> {
  const provider = MOCK_PROVIDERS.find((p) => p.nit === document_number);
  if (!provider) {
    return delay({ data: { found: false, document_number, entity: undefined } });
  }
  const summary = ruesSummaryForProvider(provider);
  const legalRep = MOCK_LEGAL_REPS[document_number];
  return delay({
    data: {
      found: true,
      document_number,
      entity: summary.detail,
      financials: [],
      renewals: [],
      related_parties: legalRep ? [legalRep] : [],
      notices: [],
    },
  });
}

export function secopProcessesByEntity(
  document_number: string,
  _opts: { from_date?: string; to_date?: string; page?: number } = {}
): Promise<{ data: SecopProcessesByEntityResponse }> {
  const seeds = seedsByEntity(document_number);
  const entityName = MOCK_ENTITIES.find((e) => e.nit === document_number)?.name ?? document_number;

  const processes: SecopProcessSummary[] = seeds.map((s) => ({
    notice_uid: s.notice_uid,
    process_id: s.notice_uid.replace("NTC", "REQ"),
    reference: s.contract_id,
    name: s.object,
    entity: entityName,
    entity_nit: document_number,
    modality: "Mínima cuantía",
    contract_type: "Suministros",
    base_price: s.value,
    phase: "Presentación de oferta",
    procedure_status: "Seleccionado",
    published_date: s.sign_date,
    url: `https://community.secop.gov.co/Public/Tendering/OpportunityDetail/Index?noticeUID=${s.notice_uid}`,
  }));

  return delay({
    data: {
      document_number,
      from_date: null,
      to_date: null,
      count: processes.length,
      capped: false,
      processes,
      pagination: emptyPagination(processes.length),
    },
  });
}

export function secopContractsByProvider(
  document_number: string,
  opts: { entity_nit?: string; from_date?: string; to_date?: string; page?: number } = {}
): Promise<{ data: SecopContractsByProviderResponse }> {
  let contracts = contractsByProvider(document_number);
  if (opts.entity_nit) contracts = contracts.filter((c) => c.entity_nit === opts.entity_nit);

  return delay({
    data: {
      document_number,
      entity_nit: opts.entity_nit ?? null,
      from_date: null,
      to_date: null,
      count: contracts.length,
      capped: false,
      contracts,
      pagination: emptyPagination(contracts.length),
    },
  });
}

export function secopSanctionsByProvider(
  document_number: string
): Promise<{ data: SecopSanctionsByProviderResponse }> {
  const sanctions = MOCK_SANCTIONS[document_number] ?? [];
  return delay({
    data: { document_number, count: sanctions.length, capped: false, sanctions },
  });
}

export function secopProcess(notice_uid: string): Promise<{ data: SecopProcessResponse }> {
  const seed = seedByNoticeUid(notice_uid);
  if (!seed) {
    return delay({ data: { found: false, notice_uid } });
  }
  const contract = contractById(seed.contract_id);
  const entityName = MOCK_ENTITIES.find((e) => e.nit === seed.entity_nit)?.name ?? seed.entity_nit;
  const providerName = MOCK_PROVIDERS.find((p) => p.nit === seed.provider_nit)?.name ?? seed.provider_nit;

  return delay({
    data: {
      found: true,
      notice_uid,
      process: {
        notice_uid,
        process_id: notice_uid.replace("NTC", "REQ"),
        name: seed.object,
        entity: entityName,
        entity_nit: seed.entity_nit,
        modality: "Mínima cuantía",
        base_price: seed.value,
        status_summary: "Adjudicado",
        procedure_status: "Seleccionado",
        awarded: true,
        awarded_value: seed.value,
        award_count: 1,
        award_date: seed.sign_date,
        url: `https://community.secop.gov.co/Public/Tendering/OpportunityDetail/Index?noticeUID=${notice_uid}`,
      },
      awards: [
        {
          provider: providerName,
          provider_nit: seed.provider_nit,
          provider_code: null,
          awarded_value: seed.value,
          award_date: seed.sign_date,
        },
      ],
      awards_capped: false,
      contract_count: contract ? 1 : 0,
      contracts: contract ? [contract] : [],
    },
  });
}

export function secopContract(contract_id: string): Promise<{ data: SecopContractResponse }> {
  const contract = contractById(contract_id);
  if (!contract) {
    return delay({ data: { found: false, contract_id } });
  }
  return delay({
    data: { found: true, contract_id, contract, modifications: [], policies: [], delivery_plan: null },
  });
}

export function contraloriaFiscalRecords(
  document_number: string,
  document_type = "CC"
): Promise<{ data: ContraloriaFiscalRecordResponse }> {
  const isResponsible = MOCK_FISCAL_RESPONSIBLE[document_number] === true;
  return delay({
    data: {
      found: true,
      document_type,
      document_type_label: document_type === "CC" ? "Cédula de Ciudadanía" : document_type,
      document_number,
      is_fiscal_responsible: isResponsible,
      verification_code: isResponsible ? `${document_number}-MOCK` : null,
      certified_at: new Date().toISOString(),
      status: isResponsible
        ? "SE ENCUENTRA REPORTADO COMO RESPONSABLE FISCAL (dato simulado)."
        : "NO SE ENCUENTRA REPORTADO COMO RESPONSABLE FISCAL.",
      message: "Certificado simulado — modo mock, no proviene de la Contraloría real.",
    },
  });
}

export function procuraduriaDisciplinaryRecords(
  document_number: string,
  document_type = "CC"
): Promise<{ data: ProcuraduriaDisciplinaryRecordResponse }> {
  const records = MOCK_DISCIPLINARY_RECORDS[document_number] ?? [];
  return delay({
    data: {
      found: records.length > 0,
      document_type,
      document_type_label: document_type === "NIT" ? "Nit" : document_type,
      document_number,
      full_name: null,
      has_records: records.length > 0,
      status:
        records.length > 0
          ? "SE ENCONTRARON ANTECEDENTES (dato simulado)."
          : "NO SE ENCONTRARON ANTECEDENTES.",
      message: "Certificado simulado — modo mock, no proviene de la Procuraduría real.",
      records: records.map((r) => ({ category: r.category, siri: null, tables: [] })),
      checked_at: new Date().toISOString(),
    },
  });
}
