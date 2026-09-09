import { useNotesStore } from "../store/notesStore";

export default function NotesPanel() {
  const notes = useNotesStore((s) => s.notes);
  const panelOpen = useNotesStore((s) => s.panelOpen);
  const setNotes = useNotesStore((s) => s.setNotes);
  const togglePanel = useNotesStore((s) => s.togglePanel);

  return (
    <div className="pointer-events-auto absolute left-4 top-20 z-20 w-72 rounded-lg border border-white/10 bg-[#131318]/95 text-sm shadow-xl backdrop-blur">
      <button
        onClick={togglePanel}
        className="flex w-full items-center justify-between px-3 py-2.5 text-xs font-medium text-zinc-300 hover:text-white"
      >
        <span>Notas generales</span>
        <span className="text-zinc-500">{panelOpen ? "▴" : "▾"}</span>
      </button>

      {panelOpen && (
        <div className="border-t border-white/10 p-3">
          <p className="mb-2 text-xs text-zinc-500">
            Observaciones generales de la investigación — no cambian según el nodo que estés revisando.
          </p>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Escribí acá observaciones, hipótesis o cosas para revisar…"
            className="h-48 w-full resize-none rounded border border-white/10 bg-black/30 p-2 text-xs leading-relaxed text-zinc-200 placeholder:text-zinc-600 focus:outline-none"
          />
          <div className="mt-1.5 flex items-center justify-between text-[10px] text-zinc-600">
            <span>Guardado en este navegador</span>
            {notes.length > 0 && (
              <button onClick={() => setNotes("")} className="text-zinc-500 hover:text-red-400">
                Borrar
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
