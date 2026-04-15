interface QuickStatusCardProps {
  unassignedCount: number;
}

export function QuickStatusCard({ unassignedCount }: QuickStatusCardProps) {
  return (
    <section className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-950">Quick status</h2>
          <p className="text-sm text-slate-500">
            Keep unassigned items at zero before moving on to tax, tip, and summary.
          </p>
        </div>
        <div
          className={`rounded-full px-3 py-1 text-sm font-semibold ${
            unassignedCount > 0
              ? "bg-amber-100 text-amber-800"
              : "bg-emerald-100 text-emerald-800"
          }`}
        >
          {unassignedCount > 0 ? `${unassignedCount} unassigned` : "All assigned"}
        </div>
      </div>
    </section>
  );
}
