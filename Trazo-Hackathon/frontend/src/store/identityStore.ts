import { create } from "zustand";
import { persist } from "zustand/middleware";

// Identidad local del investigador — se usa como `discovered_by`/`author` al crear o
// sincronizar una sala de investigación (Fase 5). No es autenticación real, es solo una
// etiqueta para atribuir aportes dentro del equipo; vive en este navegador.
interface IdentityState {
  author: string;
  setAuthor: (name: string) => void;
}

export const useIdentityStore = create<IdentityState>()(
  persist(
    (set) => ({
      author: "",
      setAuthor: (name) => set({ author: name.trim().slice(0, 80) }),
    }),
    { name: "trazo-identity" }
  )
);

/** Devuelve el nombre del investigador, preguntando una sola vez (y recordándolo) si
 * todavía no se seteó. */
export function ensureAuthorName(): string {
  const current = useIdentityStore.getState().author;
  if (current) return current;

  const input = window.prompt("¿Cómo te identificamos en la sala de investigación?", "")?.trim();
  const name = input || "Investigador anónimo";
  useIdentityStore.getState().setAuthor(name);
  return name;
}
