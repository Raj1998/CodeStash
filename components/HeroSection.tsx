import { formatCents } from "@/utils/billUtils";

interface HeroSectionProps {
  peopleCount: number;
  itemsCount: number;
  grandTotalCents: number;
}

export function HeroSection({
  peopleCount,
  itemsCount,
  grandTotalCents,
}: HeroSectionProps) {
  return (
    <section className="rounded-[2rem] bg-slate-900 px-5 py-6 text-white shadow-lg shadow-slate-300/40">
      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-300">Dinner table split helper</p>
          <div>
            <h2 className="text-3xl font-semibold tracking-tight">Fast, fair, and easy to scan.</h2>
            <p className="mt-1 text-sm text-slate-300 sm:max-w-lg">
              Add everyone, drop in the items, and tap chips to assign who shared what.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-2">
          <div className="rounded-3xl bg-white/10 px-4 py-3">
            <p className="text-xs uppercase tracking-wide text-slate-300">People</p>
            <p className="mt-1 text-2xl font-semibold">{peopleCount}</p>
          </div>
          <div className="rounded-3xl bg-white/10 px-4 py-3">
            <p className="text-xs uppercase tracking-wide text-slate-300">Items</p>
            <p className="mt-1 text-2xl font-semibold">{itemsCount}</p>
          </div>
          <div className="rounded-3xl bg-white/10 px-4 py-3 sm:col-span-2 lg:col-span-2">
            <p className="text-xs uppercase tracking-wide text-slate-300">Grand total</p>
            <p className="mt-1 text-3xl font-semibold tracking-tight">
              {formatCents(grandTotalCents)}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
