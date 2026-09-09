import axios, { AxiosInstance, isAxiosError } from "axios";
import { LRUCache } from "lru-cache";
import type {
  RuesEntitiesByNameResponseWrapper,
  RuesEntityByNitResponse,
  SecopProcessesByEntityResponse,
  SecopContractsByProviderResponse,
  SecopSanctionsByProviderResponse,
  SecopProcessResponse,
  SecopContractResponse,
  ContraloriaFiscalRecordResponse,
  ProcuraduriaDisciplinaryRecordResponse,
} from "./croma-types.js";

export class CromaRateLimitError extends Error {
  constructor(public retryAfter: number) {
    super("Croma rate limit exceeded");
    this.name = "CromaRateLimitError";
  }
}

const CACHE_TTL_SECONDS = Number(process.env.CACHE_TTL_SECONDS ?? 3600);

const cache = new LRUCache<string, object>({
  max: 500,
  ttl: CACHE_TTL_SECONDS * 1000,
});

let client: AxiosInstance | null = null;

function getClient(): AxiosInstance {
  if (client) return client;
  const apiKey = process.env.CROMA_API_KEY;
  if (!apiKey || apiKey === "your_key_here") {
    console.warn(
      "[croma] CROMA_API_KEY no está configurada en backend/.env — las llamadas a Croma van a fallar."
    );
  }
  client = axios.create({
    baseURL: "https://api.croma.run",
    timeout: 20000,
    headers: {
      Authorization: `Bearer ${apiKey ?? ""}`,
      "Content-Type": "application/json",
    },
  });
  return client;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Errores de socket/red transitorios (p. ej. Croma cerrando una conexión keep-alive justo
// cuando axios la reutiliza) — no tienen response, así que no son un 429 pero tampoco deben
// tumbar la request de una: vale la pena un par de reintentos cortos antes de rendirse.
const RETRYABLE_NETWORK_CODES = new Set(["ECONNRESET", "ETIMEDOUT", "ECONNABORTED", "ECONNREFUSED", "EPIPE"]);

function isRetryableNetworkError(error: unknown): boolean {
  return isAxiosError(error) && !error.response && !!error.code && RETRYABLE_NETWORK_CODES.has(error.code);
}

async function post<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const cacheKey = `${path}:${JSON.stringify(body)}`;
  const cached = cache.get(cacheKey);
  if (cached !== undefined) return cached as T;

  const maxAttempts = 3;
  let lastError: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const response = await getClient().post<T>(path, body);
      cache.set(cacheKey, response.data as object);
      return response.data;
    } catch (error) {
      lastError = error;
      if (isAxiosError(error) && error.response?.status === 429) {
        const retryAfterHeader = error.response.headers["retry-after"];
        const retryAfter = retryAfterHeader ? Number(retryAfterHeader) : 2 ** attempt;
        if (attempt < maxAttempts - 1) {
          await sleep(retryAfter * 1000);
          continue;
        }
        throw new CromaRateLimitError(retryAfter);
      }
      if (isRetryableNetworkError(error) && attempt < maxAttempts - 1) {
        await sleep(300 * 2 ** attempt);
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

export function ruesEntitiesByName(name: string, page = 1) {
  return post<RuesEntitiesByNameResponseWrapper>("/co/rues/entities-by-name/v1", { name, page });
}

export function ruesEntityByNit(document_number: string) {
  return post<{ data: RuesEntityByNitResponse }>("/co/rues/entity-by-nit/v1", { document_number });
}

export function secopProcessesByEntity(
  document_number: string,
  opts: { from_date?: string; to_date?: string; page?: number } = {}
) {
  return post<{ data: SecopProcessesByEntityResponse }>("/co/secop/processes-by-entity/v1", {
    document_number,
    from_date: opts.from_date ?? "",
    to_date: opts.to_date ?? "",
    page: opts.page ?? 1,
  });
}

export function secopContractsByProvider(
  document_number: string,
  opts: { entity_nit?: string; from_date?: string; to_date?: string; page?: number } = {}
) {
  return post<{ data: SecopContractsByProviderResponse }>("/co/secop/contracts-by-provider/v1", {
    document_number,
    entity_nit: opts.entity_nit ?? "",
    from_date: opts.from_date ?? "",
    to_date: opts.to_date ?? "",
    page: opts.page ?? 1,
  });
}

export function secopSanctionsByProvider(document_number: string) {
  return post<{ data: SecopSanctionsByProviderResponse }>("/co/secop/sanctions-by-provider/v1", {
    document_number,
  });
}

export function secopProcess(notice_uid: string) {
  return post<{ data: SecopProcessResponse }>("/co/secop/process/v1", { notice_uid });
}

export function secopContract(contract_id: string) {
  return post<{ data: SecopContractResponse }>("/co/secop/contract/v1", { contract_id });
}

export function contraloriaFiscalRecords(document_number: string, document_type = "CC") {
  return post<{ data: ContraloriaFiscalRecordResponse }>("/co/contraloria/fiscal-records/v1", {
    document_number,
    document_type,
  });
}

export function procuraduriaDisciplinaryRecords(document_number: string, document_type = "CC") {
  return post<{ data: ProcuraduriaDisciplinaryRecordResponse }>("/co/procuraduria/disciplinary-records/v1", {
    document_number,
    document_type,
  });
}
