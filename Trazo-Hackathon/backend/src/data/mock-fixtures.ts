// Datos de prueba para el "modo mock" del backend — se activa automáticamente cuando
// no hay CROMA_API_KEY real configurada (ver services/data-source.ts). Reutiliza
// registros reales verificados contra Croma durante el desarrollo (BIDFOR S.A.S.,
// NIT 901398448, y el Distrito de Medellín, NIT 890905211) y completa una red
// interconectada ficticia alrededor de ellos para poder demostrar el flujo completo:
// búsqueda → expansión → fusión de nodos compartidos → panel de detalle.

import type {
  RuesEntitySummary,
  RuesEntityDetail,
  SecopContract,
  SecopSanction,
} from "../services/croma-types.js";

export interface MockEntity {
  nit: string;
  name: string;
}

export const MOCK_ENTITIES: MockEntity[] = [
  { nit: "890905211", name: "DISTRITO ESPECIAL DE CIENCIA TECNOLOGIA E INNOVACION DE MEDELLIN" },
  { nit: "899999061", name: "BOGOTÁ D.C. (DISTRITO CAPITAL)" },
  { nit: "890980040", name: "GOBERNACIÓN DE ANTIOQUIA" },
];

interface MockProvider {
  nit: string;
  name: string;
  chamber_name: string;
  registration_date: string;
  primary_activity: { code: string; description: string };
}

export const MOCK_PROVIDERS: MockProvider[] = [
  {
    nit: "901398448",
    name: "BIDFOR S.A.S.",
    chamber_name: "MEDELLIN PARA ANTIOQUIA",
    registration_date: "2020-07-30",
    primary_activity: {
      code: "4761",
      description: "Comercio al por menor de libros, periódicos, materiales y artículos de papelería y escritorio",
    },
  },
  {
    nit: "900111222",
    name: "CONSTRUCTORA HORIZONTE S.A.S.",
    chamber_name: "MEDELLIN PARA ANTIOQUIA",
    registration_date: "2018-03-14",
    primary_activity: { code: "4210", description: "Construcción de carreteras y vías de ferrocarril" },
  },
  {
    nit: "900333444",
    name: "TECNO INSUMOS DE COLOMBIA SAS",
    chamber_name: "BOGOTA",
    registration_date: "2019-09-02",
    primary_activity: { code: "4651", description: "Comercio al por mayor de computadores, equipo periférico y programas de informática" },
  },
];

function entityName(nit: string): string {
  return MOCK_ENTITIES.find((e) => e.nit === nit)?.name ?? nit;
}

function providerName(nit: string): string {
  return MOCK_PROVIDERS.find((p) => p.nit === nit)?.name ?? nit;
}

interface MockContractSeed {
  contract_id: string;
  notice_uid: string;
  entity_nit: string;
  provider_nit: string;
  object: string;
  value: number;
  status: string;
  sign_date: string;
  start_date: string;
  end_date: string;
}

const CONTRACT_SEEDS: MockContractSeed[] = [
  {
    contract_id: "CO1.PCCNTR.9492640",
    notice_uid: "CO1.NTC.10213931",
    entity_nit: "890905211",
    provider_nit: "901398448",
    object: "Suministrar elementos de emergencia",
    value: 174167311,
    status: "En ejecución",
    sign_date: "2026-05-19",
    start_date: "2026-05-22",
    end_date: "2026-09-19",
  },
  {
    contract_id: "CO1.PCCNTR.9492700",
    notice_uid: "CO1.NTC.20100001",
    entity_nit: "899999061",
    provider_nit: "901398448",
    object: "Suministro de equipos de cómputo para dependencias distritales",
    value: 320000000,
    status: "En ejecución",
    sign_date: "2026-03-10",
    start_date: "2026-03-15",
    end_date: "2026-12-15",
  },
  {
    contract_id: "CO1.PCCNTR.9492750",
    notice_uid: "CO1.NTC.30100001",
    entity_nit: "890980040",
    provider_nit: "901398448",
    object: "Dotación de mobiliario para oficinas regionales",
    value: 95000000,
    status: "Terminado",
    sign_date: "2025-02-01",
    start_date: "2025-02-10",
    end_date: "2025-08-10",
  },
  {
    contract_id: "CO1.PCCNTR.8801234",
    notice_uid: "CO1.NTC.10213932",
    entity_nit: "890905211",
    provider_nit: "900111222",
    object: "Mantenimiento vial zona nororiental",
    value: 1450000000,
    status: "En ejecución",
    sign_date: "2026-01-20",
    start_date: "2026-02-01",
    end_date: "2027-02-01",
  },
  {
    contract_id: "CO1.PCCNTR.8801290",
    notice_uid: "CO1.NTC.20100002",
    entity_nit: "899999061",
    provider_nit: "900111222",
    object: "Adecuación de parques distritales",
    value: 980000000,
    status: "En ejecución",
    sign_date: "2025-11-05",
    start_date: "2025-11-15",
    end_date: "2026-11-15",
  },
  {
    contract_id: "CO1.PCCNTR.7705500",
    notice_uid: "CO1.NTC.30100002",
    entity_nit: "890980040",
    provider_nit: "900333444",
    object: "Suministro de insumos tecnológicos",
    value: 210000000,
    status: "Terminado",
    sign_date: "2025-06-01",
    start_date: "2025-06-10",
    end_date: "2025-10-10",
  },
];

export const MOCK_CONTRACTS: SecopContract[] = CONTRACT_SEEDS.map((seed) => ({
  contract_id: seed.contract_id,
  reference: seed.contract_id,
  entity: entityName(seed.entity_nit),
  entity_nit: seed.entity_nit,
  centralized_entity: "Centralizada",
  provider: providerName(seed.provider_nit),
  provider_document: seed.provider_nit,
  provider_document_type: "NIT",
  status: seed.status,
  contract_type: "Suministros",
  modality: "Mínima cuantía",
  object: seed.object,
  value: seed.value,
  sign_date: seed.sign_date,
  start_date: seed.start_date,
  end_date: seed.end_date,
  duration: null,
  location: "Colombia",
  sector: "Servicio Público",
  url: `https://community.secop.gov.co/Public/Tendering/OpportunityDetail/Index?noticeUID=${seed.notice_uid}`,
}));

export function contractsByProvider(providerNit: string): SecopContract[] {
  return MOCK_CONTRACTS.filter((c) => c.provider_document === providerNit);
}

export function contractsByEntity(entityNit: string): SecopContract[] {
  return MOCK_CONTRACTS.filter((c) => c.entity_nit === entityNit);
}

export function seedsByEntity(entityNit: string): MockContractSeed[] {
  return CONTRACT_SEEDS.filter((s) => s.entity_nit === entityNit);
}

export function seedByNoticeUid(noticeUid: string): MockContractSeed | undefined {
  return CONTRACT_SEEDS.find((s) => s.notice_uid === noticeUid);
}

export function contractById(contractId: string): SecopContract | undefined {
  return MOCK_CONTRACTS.find((c) => c.contract_id === contractId);
}

export const MOCK_SANCTIONS: Record<string, SecopSanction[]> = {
  "900333444": [
    {
      sanctioning_entity: "Cámara de Comercio de Medellín para Antioquia",
      resolution_number: "SEC-2023-0456",
      value: 15000000,
      published_date: "2023-11-02",
      final_date: "2024-01-15",
    },
  ],
};

// Representante legal simulado — solo para CONSTRUCTORA HORIZONTE, así el flujo de
// alerta_fiscal (que depende de resolver primero el representante legal vía RUES)
// tiene un caso positivo para demostrar en modo mock.
export const MOCK_LEGAL_REPS: Record<string, { document_number: string; name: string; role: string }> = {
  "900111222": {
    document_number: "1017654321",
    name: "CARLOS ANDRÉS MEJÍA RESTREPO",
    role: "Representante Legal - Principal",
  },
};

// Responsabilidad fiscal (Contraloría), indexada por documento de la persona, no del NIT.
export const MOCK_FISCAL_RESPONSIBLE: Record<string, boolean> = {
  "1017654321": true, // representante legal de CONSTRUCTORA HORIZONTE
};

// Antecedentes disciplinarios (Procuraduría), indexados por NIT del proveedor.
export const MOCK_DISCIPLINARY_RECORDS: Record<string, { category: string }[]> = {
  "900333444": [{ category: "Disciplinario" }], // TECNO INSUMOS: además de la sanción SECOP
};

export function ruesSummaryForProvider(p: MockProvider): RuesEntitySummary {
  const detail: RuesEntityDetail = {
    registry_id: `mock-${p.nit}`,
    nit: p.nit,
    name: p.name,
    registration_status: "ACTIVA",
    registration_category: "SOCIEDAD ó PERSONA JURIDICA PRINCIPAL ó ESAL",
    legal_organization: "SOCIEDADES POR ACCIONES SIMPLIFICADAS SAS",
    society_type: "SOCIEDAD COMERCIAL",
    registration_date: p.registration_date,
    last_renewal_date: "2026-03-25",
    primary_activity: p.primary_activity,
    commercial_address: null,
    commercial_municipality: null,
    chamber_name: p.chamber_name,
  };
  return {
    registry_id: detail.registry_id,
    nit: p.nit,
    verification_digit: null,
    name: p.name,
    acronym: null,
    chamber_name: p.chamber_name,
    registration_status: "ACTIVA",
    legal_organization: detail.legal_organization,
    category: detail.registration_category,
    detail,
  };
}
