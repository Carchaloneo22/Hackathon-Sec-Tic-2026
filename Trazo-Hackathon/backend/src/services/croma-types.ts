// Shapes observados empíricamente contra la API real de Croma (ver plan de implementación).
// No son la documentación completa — solo los campos que Trazo efectivamente usa.

export interface RuesEntitySummary {
  registry_id: string | null;
  nit: string | null;
  verification_digit: string | null;
  name: string | null;
  acronym: string | null;
  chamber_name: string | null;
  registration_status: string | null;
  legal_organization: string | null;
  category: string | null;
  detail: RuesEntityDetail;
}

export interface RuesEntityDetail {
  registry_id: string;
  nit: string | null;
  name: string;
  registration_status: string | null;
  registration_category: string | null;
  legal_organization: string | null;
  society_type: string | null;
  registration_date: string | null;
  last_renewal_date: string | null;
  primary_activity: { code: string; description: string } | null;
  commercial_address: string | null;
  commercial_municipality: string | null;
  [key: string]: unknown;
}

export interface RuesEntitiesByNameData {
  query: string;
  capped: boolean;
  entities: RuesEntitySummary[];
  pagination: Pagination;
}

export interface RuesEntitiesByNameResponseWrapper {
  data: RuesEntitiesByNameData;
}

export interface RuesEntityByNitResponse {
  found: boolean;
  document_number: string;
  entity?: RuesEntityDetail;
  financials?: unknown[];
  renewals?: unknown[];
  related_parties?: { document_number: string; name: string; role: string }[];
  notices?: unknown[];
}

export interface SecopProcessSummary {
  notice_uid: string | null;
  process_id: string | null;
  reference: string | null;
  name: string | null;
  entity: string | null;
  entity_nit: string | null;
  modality: string | null;
  contract_type: string | null;
  base_price: number | null;
  phase: string | null;
  procedure_status: string | null;
  published_date: string | null;
  url: string | null;
}

export interface Pagination {
  total: number;
  page_size: number;
  total_pages: number;
  page: number;
}

export interface SecopProcessesByEntityResponse {
  document_number: string;
  from_date: string | null;
  to_date: string | null;
  count: number;
  capped: boolean;
  processes: SecopProcessSummary[];
  pagination: Pagination;
}

export interface SecopContract {
  contract_id: string;
  reference: string | null;
  entity: string;
  entity_nit: string;
  centralized_entity: string | null;
  provider: string;
  provider_document: string;
  provider_document_type: string | null;
  status: string | null;
  contract_type: string | null;
  modality: string | null;
  object: string | null;
  value: number | null;
  sign_date: string | null;
  start_date: string | null;
  end_date: string | null;
  duration: string | null;
  location: string | null;
  sector: string | null;
  url: string | null;
  [key: string]: unknown;
}

export interface SecopContractsByProviderResponse {
  document_number: string;
  entity_nit: string | null;
  from_date: string | null;
  to_date: string | null;
  count: number;
  capped: boolean;
  contracts: SecopContract[];
  pagination: Pagination;
}

export interface SecopSanction {
  sanctioning_entity: string | null;
  resolution_number: string | null;
  value: number | null;
  published_date: string | null;
  final_date: string | null;
  [key: string]: unknown;
}

export interface SecopSanctionsByProviderResponse {
  document_number: string;
  count: number;
  capped: boolean;
  sanctions: SecopSanction[];
}

export interface SecopAward {
  provider: string;
  provider_nit: string;
  provider_code: string | null;
  awarded_value: number | null;
  award_date: string | null;
}

export interface SecopProcessDetail {
  notice_uid: string;
  process_id: string | null;
  name: string | null;
  entity: string;
  entity_nit: string;
  modality: string | null;
  base_price: number | null;
  status_summary: string | null;
  procedure_status: string | null;
  awarded: boolean;
  awarded_value: number | null;
  award_count: number | null;
  award_date: string | null;
  url: string | null;
}

export interface SecopProcessResponse {
  found: boolean;
  notice_uid: string;
  process?: SecopProcessDetail;
  awards?: SecopAward[];
  awards_capped?: boolean;
  contract_count?: number;
  contracts?: SecopContract[];
}

export interface SecopContractResponse {
  found: boolean;
  contract_id: string;
  contract?: SecopContract;
  modifications?: unknown[];
  policies?: unknown[];
  delivery_plan?: unknown;
}

export interface ContraloriaFiscalRecordResponse {
  found: boolean;
  document_type: string;
  document_type_label: string;
  document_number: string;
  is_fiscal_responsible: boolean;
  verification_code: string | null;
  certified_at: string | null;
  status: string;
  message: string;
}

export interface ProcuraduriaRecordTable {
  heading: string;
  columns: string[];
  rows: string[][];
}

export interface ProcuraduriaRecord {
  category: string;
  siri: string | null;
  tables: ProcuraduriaRecordTable[];
}

export interface ProcuraduriaDisciplinaryRecordResponse {
  found: boolean;
  document_type: string;
  document_type_label: string;
  document_number: string;
  full_name: string | null;
  has_records: boolean;
  status: string;
  message: string;
  records: ProcuraduriaRecord[];
  checked_at: string | null;
}
