"use client";

import { useBill } from "@/hooks/useBill";

export default function Home() {
  const { state, personTotals } = useBill();
  const totals = personTotals();

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col gap-4 px-4 py-6">
      <h1 className="text-2xl font-semibold tracking-tight">Split the Bill</h1>
      <p className="text-sm text-slate-600">
        Core bill state is wired up. UI sections come next.
      </p>
      <pre className="overflow-x-auto rounded-lg bg-slate-100 p-4 text-xs text-slate-800">
        {JSON.stringify(
          {
            people: state.people,
            items: state.items,
            taxCents: state.taxCents,
            tipCents: state.tipCents,
            splitMode: state.splitMode,
            totals,
          },
          null,
          2,
        )}
      </pre>
    </main>
  );
}
