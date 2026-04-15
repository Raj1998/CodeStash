import type { Person, PersonTotal, SplitMode } from "@/types";
import { formatCents, getInitials } from "@/utils/billUtils";

interface SummarySectionProps {
  people: Person[];
  totals: PersonTotal[];
  itemsCount: number;
  splitMode: SplitMode;
  grandTotalCents: number;
  copyStatus: "idle" | "copied" | "error";
  onCopySummary: () => void;
}

export function SummarySection({
  people,
  totals,
  itemsCount,
  splitMode,
  grandTotalCents,
  copyStatus,
  onCopySummary,
}: SummarySectionProps) {
  return (
    <section className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">Summary</h2>
          <p className="text-sm text-slate-500">
            A clean receipt-style view so each person can glance and know exactly what they owe.
          </p>
        </div>
        <button
          type="button"
          onClick={onCopySummary}
          disabled={totals.length === 0 || itemsCount === 0}
          className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {copyStatus === "copied"
            ? "Copied"
            : copyStatus === "error"
              ? "Copy failed"
              : "Copy summary"}
        </button>
      </div>

      {itemsCount === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
          Add items to generate the final per-person summary.
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-3xl bg-slate-950 px-4 py-4 text-white shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-300">Bill total</p>
                <p className="mt-1 text-sm text-slate-300">
                  Subtotal, tax, and tip combined.
                </p>
              </div>
              <p className="text-4xl font-semibold tracking-tight">{formatCents(grandTotalCents)}</p>
            </div>
          </div>

          {totals.map((total) => {
            const person = people.find((entry) => entry.id === total.personId);

            if (!person) {
              return null;
            }

            const isEqualMode = splitMode === "equal";

            return (
              <article
                key={person.id}
                className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] shadow-sm"
              >
                <div className="flex items-center justify-between gap-3 border-b border-dashed border-slate-200 px-4 py-4">
                  <div className="flex items-center gap-3">
                    <span
                      className="flex h-11 w-11 items-center justify-center rounded-full text-sm font-semibold text-white shadow-sm"
                      style={{ backgroundColor: person.color }}
                    >
                      {getInitials(person.name)}
                    </span>
                    <div>
                      <h3 className="text-base font-semibold text-slate-950">{person.name}</h3>
                      <p className="text-sm text-slate-500">
                        {isEqualMode
                          ? "Equal split"
                          : `${total.itemizedItems.length} ${total.itemizedItems.length === 1 ? "item" : "items"}`}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Total</p>
                    <p className="text-2xl font-semibold tracking-tight text-slate-950">
                      {formatCents(total.totalCents)}
                    </p>
                  </div>
                </div>

                <div className="space-y-4 px-4 py-4">
                  {isEqualMode ? (
                    <div className="rounded-2xl border border-slate-200 bg-white/70 p-4 text-sm text-slate-600">
                      <p className="font-medium text-slate-900">Quick split is on.</p>
                      <p className="mt-1">
                        Grand total ÷ {people.length} {people.length === 1 ? "person" : "people"} = {formatCents(total.totalCents)} each.
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-2">
                        {total.itemizedItems.length > 0 ? (
                          total.itemizedItems.map((item) => (
                            <div
                              key={`${person.id}-${item.itemId}`}
                              className="flex items-start justify-between gap-3 text-sm"
                            >
                              <span className="text-slate-600">
                                {item.isShared
                                  ? `${item.name} (shared ÷${item.splitCount})`
                                  : item.name}
                              </span>
                              <span className="font-medium text-slate-900">
                                {formatCents(item.shareCents)}
                              </span>
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-slate-500">No assigned items yet.</p>
                        )}
                      </div>

                      <div className="rounded-2xl border border-slate-200 bg-white/70 p-3">
                        <div className="space-y-2 text-sm text-slate-600">
                          <div className="flex items-center justify-between">
                            <span>Subtotal</span>
                            <span className="font-medium text-slate-900">
                              {formatCents(total.subtotalCents)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span>Tax share</span>
                            <span className="font-medium text-slate-900">
                              {formatCents(total.taxShareCents)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span>Tip share</span>
                            <span className="font-medium text-slate-900">
                              {formatCents(total.tipShareCents)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
