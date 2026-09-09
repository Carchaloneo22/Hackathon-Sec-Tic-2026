// Punto único de importación para las rutas: decide si servir datos reales de Croma
// o datos de prueba locales (mock), y expone la misma interfaz en ambos casos.
//
// Se usa modo mock cuando MOCK_MODE=true, o automáticamente cuando no hay una
// CROMA_API_KEY real configurada — así el proyecto es probable "out of the box".

import * as croma from "./croma.js";
import * as mock from "./mock.js";

const hasRealKey = !!process.env.CROMA_API_KEY && process.env.CROMA_API_KEY !== "your_key_here";
export const USE_MOCK_DATA = process.env.MOCK_MODE === "true" || !hasRealKey;

const impl = USE_MOCK_DATA ? mock : croma;

export const ruesEntitiesByName = impl.ruesEntitiesByName;
export const ruesEntityByNit = impl.ruesEntityByNit;
export const secopProcessesByEntity = impl.secopProcessesByEntity;
export const secopContractsByProvider = impl.secopContractsByProvider;
export const secopSanctionsByProvider = impl.secopSanctionsByProvider;
export const secopProcess = impl.secopProcess;
export const secopContract = impl.secopContract;
export const contraloriaFiscalRecords = impl.contraloriaFiscalRecords;
export const procuraduriaDisciplinaryRecords = impl.procuraduriaDisciplinaryRecords;

export { CromaRateLimitError } from "./croma.js";
