import { Router } from "express";
import type { CreateCaseRequest, AddCaseItemsRequest, AddCaseNoteRequest, CaseResponse, CaseNoteResponse } from "../../../shared/types.js";
import { createCase, getCase, addCaseItems, addCaseNote } from "../services/caseStore.js";

const MAX_TEXT_LENGTH = 2000;

function cleanAuthor(author: unknown): string {
  const text = typeof author === "string" ? author.trim().slice(0, 80) : "";
  return text || "Investigador anónimo";
}

const router = Router();

router.post("/", async (req, res) => {
  const { title, author, nodes, edges } = req.body as CreateCaseRequest;

  if (!title || !Array.isArray(nodes) || nodes.length === 0) {
    return res.status(400).json({ error: "title y al menos un nodo son requeridos" });
  }

  const snapshot = await createCase(title.slice(0, 200), cleanAuthor(author), nodes, edges ?? []);
  return res.status(201).json({ case: snapshot } satisfies CaseResponse);
});

router.get("/:caseId", async (req, res) => {
  const snapshot = await getCase(req.params.caseId);
  if (!snapshot) return res.status(404).json({ error: "Sala de investigación no encontrada" });
  return res.json({ case: snapshot } satisfies CaseResponse);
});

router.post("/:caseId/items", async (req, res) => {
  const { author, nodes, edges } = req.body as AddCaseItemsRequest;
  if (!Array.isArray(nodes) || !Array.isArray(edges)) {
    return res.status(400).json({ error: "nodes y edges son requeridos" });
  }

  const snapshot = await addCaseItems(req.params.caseId, cleanAuthor(author), nodes, edges);
  if (!snapshot) return res.status(404).json({ error: "Sala de investigación no encontrada" });
  return res.json({ case: snapshot } satisfies CaseResponse);
});

router.post("/:caseId/notes", async (req, res) => {
  const { nodeId, text, author } = req.body as AddCaseNoteRequest;
  const trimmed = typeof text === "string" ? text.trim() : "";
  if (!nodeId || !trimmed) {
    return res.status(400).json({ error: "nodeId y text son requeridos" });
  }

  const result = await addCaseNote(req.params.caseId, nodeId, trimmed.slice(0, MAX_TEXT_LENGTH), cleanAuthor(author));
  if (!result) return res.status(404).json({ error: "Sala de investigación no encontrada" });
  return res.status(201).json({ note: result.note } satisfies CaseNoteResponse);
});

export default router;
