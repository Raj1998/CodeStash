import type { Person } from "@/types";
import { getInitials } from "@/utils/billUtils";

interface PersonChipProps {
  person: Person;
  assigned?: boolean;
  onClick: () => void;
  showRemove?: boolean;
}

export function PersonChip({
  person,
  assigned,
  onClick,
  showRemove,
}: PersonChipProps) {
  const activeClasses =
    assigned === undefined
      ? "border-slate-200 bg-white text-slate-700"
      : assigned
        ? "border-transparent text-slate-950 shadow-sm"
        : "border-slate-200 bg-white text-slate-500";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-2 text-sm font-medium transition active:scale-[0.98] ${activeClasses}`}
      style={{ backgroundColor: assigned ? `${person.color}22` : undefined }}
    >
      <span
        className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold text-white shadow-sm"
        style={{ backgroundColor: person.color }}
      >
        {getInitials(person.name)}
      </span>
      <span className="max-w-[7rem] truncate">{person.name}</span>
      {showRemove ? <span className="text-xs text-slate-400">✕</span> : null}
    </button>
  );
}
