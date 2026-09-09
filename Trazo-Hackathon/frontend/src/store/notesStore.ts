import { create } from "zustand";
import { persist } from "zustand/middleware";

// Notas generales de la investigación — a propósito NO están atadas a ningún
// nodeId. Viven solo en este navegador (localStorage): la Fase 5 del roadmap
// (notas por nodo, compartidas por caso vía backend) todavía no está confirmada.
interface NotesState {
  notes: string;
  panelOpen: boolean;
  setNotes: (text: string) => void;
  togglePanel: () => void;
}

export const useNotesStore = create<NotesState>()(
  persist(
    (set) => ({
      notes: "",
      panelOpen: true,
      setNotes: (text) => set({ notes: text }),
      togglePanel: () => set((s) => ({ panelOpen: !s.panelOpen })),
    }),
    { name: "trazo-general-notes" }
  )
);
