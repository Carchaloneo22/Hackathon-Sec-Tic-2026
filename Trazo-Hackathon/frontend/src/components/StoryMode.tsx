import { useEffect, useRef, useState } from "react";
import { STORIES, type Story } from "../data/stories";
import { useGraphStore } from "../store/graphStore";

const AUTO_ADVANCE_MS = 6500;

export default function StoryMode() {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [activeStory, setActiveStory] = useState<Story | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [autoplay, setAutoplay] = useState(false);

  const ingest = useGraphStore((s) => s.ingest);
  const reset = useGraphStore((s) => s.reset);
  const setStoryMode = useGraphStore((s) => s.setStoryMode);
  const selectNode = useGraphStore((s) => s.selectNode);

  const autoTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  function startStory(story: Story) {
    reset();
    setStoryMode(true);
    setActiveStory(story);
    setStepIndex(0);
    setPickerOpen(false);
    ingest(story.steps[0].nodes, story.steps[0].edges, story.steps[0].mergedNodeIds);
  }

  function goToStep(index: number) {
    if (!activeStory || index <= stepIndex || index >= activeStory.steps.length) return;
    // Revela de forma acumulativa todos los pasos intermedios que se hayan saltado.
    for (let i = stepIndex + 1; i <= index; i++) {
      const step = activeStory.steps[i];
      ingest(step.nodes, step.edges, step.mergedNodeIds);
    }
    setStepIndex(index);
  }

  function exitStory() {
    if (autoTimerRef.current) clearTimeout(autoTimerRef.current);
    setActiveStory(null);
    setStepIndex(0);
    setAutoplay(false);
    selectNode(null);
    reset();
  }

  useEffect(() => {
    if (!autoplay || !activeStory) return;
    if (stepIndex >= activeStory.steps.length - 1) return;
    autoTimerRef.current = setTimeout(() => goToStep(stepIndex + 1), AUTO_ADVANCE_MS);
    return () => {
      if (autoTimerRef.current) clearTimeout(autoTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoplay, stepIndex, activeStory]);

  if (!activeStory) {
    return (
      <div className="pointer-events-auto absolute bottom-4 right-4 z-30 w-72">
        {pickerOpen && (
          <ul className="mb-2 overflow-hidden rounded-lg border border-amber-500/20 bg-[#131318]/95 shadow-xl backdrop-blur">
            {STORIES.map((story) => (
              <li key={story.id} className="border-b border-white/5 last:border-0">
                <button
                  onClick={() => startStory(story)}
                  className="block w-full px-3 py-2.5 text-left hover:bg-white/10"
                >
                  <span className="block text-sm font-medium text-white">{story.title}</span>
                  <span className="mt-0.5 block text-xs text-zinc-400">{story.teaser}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <button
          onClick={() => setPickerOpen((o) => !o)}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-amber-500/30 bg-[#131318]/95 px-4 py-2.5 text-sm font-medium text-amber-300 shadow-xl backdrop-blur hover:bg-amber-500/10"
        >
          ▶ Modo Historia
        </button>
      </div>
    );
  }

  const step = activeStory.steps[stepIndex];
  const isLast = stepIndex === activeStory.steps.length - 1;

  return (
    <div className="pointer-events-auto absolute bottom-4 left-1/2 z-40 w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 rounded-lg border border-amber-500/30 bg-[#131318]/95 p-4 shadow-2xl backdrop-blur">
      <div className="mb-2 flex items-center justify-between gap-3 text-xs text-amber-300">
        <span className="truncate">
          Modo Historia · {activeStory.title} · paso {stepIndex + 1}/{activeStory.steps.length}
        </span>
        <button onClick={exitStory} className="shrink-0 text-zinc-400 hover:text-white">
          Salir ✕
        </button>
      </div>
      <p className="mb-3 text-sm leading-relaxed text-zinc-200">{step.narration}</p>
      <div className="flex items-center justify-between gap-3">
        <label className="flex items-center gap-1.5 text-xs text-zinc-400">
          <input
            type="checkbox"
            checked={autoplay}
            onChange={(e) => setAutoplay(e.target.checked)}
            className="accent-amber-400"
          />
          Reproducción automática
        </label>
        <button
          onClick={() => goToStep(stepIndex + 1)}
          disabled={isLast}
          className="rounded-md bg-amber-500/20 px-4 py-1.5 text-sm font-medium text-amber-200 transition hover:bg-amber-500/30 disabled:cursor-default disabled:opacity-40"
        >
          {isLast ? "Fin del caso" : "Siguiente →"}
        </button>
      </div>
    </div>
  );
}
