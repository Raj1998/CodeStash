import type { SplitMode } from "@/types";

interface SplitModeToggleProps {
  splitMode: SplitMode;
  onSetSplitMode: (mode: SplitMode) => void;
}

export function SplitModeToggle({
  splitMode,
  onSetSplitMode,
}: SplitModeToggleProps) {
  return (
    <div className="inline-flex rounded-full bg-slate-100 p-1 shadow-inner">
      {(["individual", "equal"] as SplitMode[]).map((mode) => {
        const isActive = splitMode === mode;

        return (
          <button
            key={mode}
            type="button"
            onClick={() => onSetSplitMode(mode)}
            className={`rounded-full px-3 py-2 text-sm font-medium transition sm:px-4 ${
              isActive
                ? "bg-white text-slate-950 shadow-sm"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            {mode === "individual"
              ? "Assign individually"
              : "Split everything equally"}
          </button>
        );
      })}
    </div>
  );
}
