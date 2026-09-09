// Persistencia de "salas de investigación" (Fase 5, confirmada explícitamente — ver
// CLAUDE.md sección 8). Un archivo JSON por case_id, sin base de datos: alcanza para
// el volumen de un hackathon y evita meter una dependencia nueva solo para esto.
//
// Sincronización deliberadamente simple (polling desde el cliente, no WebSockets — ver
// CLAUDE.md) así que la única condición de carrera real es dos requests concurrentes
// escribiendo el mismo case_id; `withLock` la serializa encadenando promesas.

import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { GraphNode, GraphEdge, CaseSnapshot, CaseNote, CaseNodeMeta } from "../../../shared/types.js";

const CASES_DIR = path.join(process.cwd(), "data", "cases");

const locks = new Map<string, Promise<unknown>>();

function withLock<T>(caseId: string, fn: () => Promise<T>): Promise<T> {
  const previous = locks.get(caseId) ?? Promise.resolve();
  const next = previous.then(fn, fn);
  locks.set(
    caseId,
    next.catch(() => undefined)
  );
  return next;
}

function generateId(bytes: number): string {
  return randomBytes(bytes).toString("base64url");
}

async function ensureDir(): Promise<void> {
  await mkdir(CASES_DIR, { recursive: true });
}

function filePathFor(caseId: string): string {
  // caseId siempre lo genera este módulo, pero se sanea igual antes de tocar el
  // filesystem por si algún día se acepta un id provisto por el cliente.
  const safeId = caseId.replace(/[^a-zA-Z0-9_-]/g, "");
  return path.join(CASES_DIR, `${safeId}.json`);
}

async function readCaseFile(caseId: string): Promise<CaseSnapshot | null> {
  try {
    const raw = await readFile(filePathFor(caseId), "utf-8");
    return JSON.parse(raw) as CaseSnapshot;
  } catch {
    return null;
  }
}

async function writeCaseFile(snapshot: CaseSnapshot): Promise<void> {
  await ensureDir();
  await writeFile(filePathFor(snapshot.id), JSON.stringify(snapshot), "utf-8");
}

function dedupeNodes(existing: GraphNode[], incoming: GraphNode[]): { merged: GraphNode[]; freshIds: string[] } {
  const byId = new Map(existing.map((n) => [n.id, n]));
  const freshIds: string[] = [];
  for (const node of incoming) {
    if (!byId.has(node.id)) freshIds.push(node.id);
    byId.set(node.id, node); // el más reciente gana (p. ej. expanded pasa de false a true)
  }
  return { merged: Array.from(byId.values()), freshIds };
}

function dedupeEdges(existing: GraphEdge[], incoming: GraphEdge[]): GraphEdge[] {
  const byId = new Map(existing.map((e) => [e.id, e]));
  for (const edge of incoming) byId.set(edge.id, edge);
  return Array.from(byId.values());
}

export async function createCase(
  title: string,
  author: string,
  nodes: GraphNode[],
  edges: GraphEdge[]
): Promise<CaseSnapshot> {
  const id = generateId(6);
  const now = new Date().toISOString();
  const nodeMeta: Record<string, CaseNodeMeta> = {};
  for (const node of nodes) {
    nodeMeta[node.id] = { discovered_by: author, discovered_at: now };
  }
  const snapshot: CaseSnapshot = { id, title, created_at: now, updated_at: now, nodes, edges, nodeMeta, notes: [] };
  await writeCaseFile(snapshot);
  return snapshot;
}

export function getCase(caseId: string): Promise<CaseSnapshot | null> {
  return readCaseFile(caseId);
}

export async function addCaseItems(
  caseId: string,
  author: string,
  newNodes: GraphNode[],
  newEdges: GraphEdge[]
): Promise<CaseSnapshot | null> {
  return withLock(caseId, async () => {
    const existing = await readCaseFile(caseId);
    if (!existing) return null;

    const { merged: nodes, freshIds } = dedupeNodes(existing.nodes, newNodes);
    const edges = dedupeEdges(existing.edges, newEdges);

    const now = new Date().toISOString();
    const nodeMeta = { ...existing.nodeMeta };
    for (const id of freshIds) {
      nodeMeta[id] = { discovered_by: author, discovered_at: now };
    }

    const snapshot: CaseSnapshot = { ...existing, nodes, edges, nodeMeta, updated_at: now };
    await writeCaseFile(snapshot);
    return snapshot;
  });
}

export async function addCaseNote(
  caseId: string,
  nodeId: string,
  text: string,
  author: string
): Promise<{ snapshot: CaseSnapshot; note: CaseNote } | null> {
  return withLock(caseId, async () => {
    const existing = await readCaseFile(caseId);
    if (!existing) return null;

    const note: CaseNote = { id: generateId(8), nodeId, text, author, created_at: new Date().toISOString() };
    const snapshot: CaseSnapshot = { ...existing, notes: [...existing.notes, note], updated_at: note.created_at };
    await writeCaseFile(snapshot);
    return { snapshot, note };
  });
}
