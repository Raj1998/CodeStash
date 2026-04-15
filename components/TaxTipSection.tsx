import type { TipInputMode, TipState } from "@/types";
import { formatCents, formatPercentage } from "@/utils/billUtils";

interface TaxTipSectionProps {
  taxInput: string;
  tipInput: string;
  taxCents: number;
  tipCents: number;
  subtotalCents: number;
  grandTotalCents: number;
  tipState: TipState;
  onTaxInputChange: (value: string) => void;
  onTaxBlur: () => void;
  onTipInputChange: (value: string) => void;
  onTipBlur: () => void;
  onTipModeChange: (mode: TipInputMode) => void;
}

export function TaxTipSection({
  taxInput,
  tipInput,
  taxCents,
  tipCents,
  subtotalCents,
  grandTotalCents,
  tipState,
  onTaxInputChange,
  onTaxBlur,
  onTipInputChange,
  onTipBlur,
  onTipModeChange,
}: TaxTipSectionProps) {
  return (
    <section className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">Tax &amp; Tip</h2>
          <p className="text-sm text-slate-500">
            Enter tax directly, and switch tip between a percent or dollar amount.
          </p>
        </div>
        <div className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-600">
          {formatCents(grandTotalCents)}
        </div>
      </div>

      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Tax
            </span>
            <input
              inputMode="decimal"
              value={taxInput}
              onChange={(event) => onTaxInputChange(event.target.value)}
              onBlur={onTaxBlur}
              placeholder="0.00"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
            />
          </label>

          <div className="space-y-2 rounded-3xl bg-slate-50 p-3">
            <div className="inline-flex rounded-full bg-white p-1 shadow-sm">
              {(["percentage", "amount"] as TipInputMode[]).map((mode) => {
                const isActive = tipState.mode === mode;

                return (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => onTipModeChange(mode)}
                    className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                      isActive
                        ? "bg-slate-900 text-white"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    {mode === "percentage" ? "% Tip" : "$ Tip"}
                  </button>
                );
              })}
            </div>

            <label className="space-y-1">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                {tipState.mode === "percentage" ? "Tip %" : "Tip amount"}
              </span>
              <input
                inputMode="decimal"
                value={tipInput}
                onChange={(event) => onTipInputChange(event.target.value)}
                onBlur={onTipBlur}
                placeholder={tipState.mode === "percentage" ? "18" : "0.00"}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400"
              />
            </label>

            <p className="text-sm text-slate-500">
              {tipState.mode === "percentage"
                ? `Tip amount: ${formatCents(tipCents)}`
                : `Tip percentage: ${formatPercentage(tipState.percentage)}`}
            </p>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
          <div className="space-y-2 text-sm text-slate-600">
            <div className="flex items-center justify-between">
              <span>Subtotal</span>
              <span className="font-medium text-slate-900">{formatCents(subtotalCents)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Tax</span>
              <span className="font-medium text-slate-900">{formatCents(taxCents)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Tip</span>
              <span className="font-medium text-slate-900">{formatCents(tipCents)}</span>
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-dashed border-slate-300 pt-3 text-base font-semibold text-slate-950">
              <span>Grand total</span>
              <span>{formatCents(grandTotalCents)}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
