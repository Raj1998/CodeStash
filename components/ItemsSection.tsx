import type { BillItem, Person, SplitMode } from "@/types";
import {
  extractGeminiText,
  formatCents,
  GEMINI_MODEL,
  normalizeImportedItems,
  parseCurrencyToCents,
  readFileAsBase64,
  RECEIPT_IMPORT_PROMPT,
} from "@/utils/billUtils";
import { PersonChip } from "@/components/PersonChip";
import { SplitModeToggle } from "@/components/SplitModeToggle";
import { useEffect, useState } from "react";

interface ItemsSectionProps {
  people: Person[];
  items: BillItem[];
  splitMode: SplitMode;
  subtotalCents: number;
  itemName: string;
  itemPrice: string;
  itemNameInputRef: React.RefObject<HTMLInputElement>;
  itemPriceInputRef: React.RefObject<HTMLInputElement>;
  receiptInputRef: React.RefObject<HTMLInputElement>;
  newItemId: string | null;
  receiptImportStatus: "idle" | "loading" | "error";
  receiptImportError: string | null;
  receiptImportCount: number | null;
  onItemNameChange: (value: string) => void;
  onItemPriceChange: (value: string) => void;
  onAddItem: () => void;
  onAddImportedItems: (items: Array<{ name: string; priceCents: number }>) => void;
  onUpdateItem: (itemId: string, updates: { name?: string; priceCents?: number }) => void;
  onRemoveItem: (itemId: string) => void;
  onToggleAssignment: (itemId: string, personId: string) => void;
  onSetSplitMode: (mode: SplitMode) => void;
  onReceiptImportStateChange: (state: {
    status: "idle" | "loading" | "error";
    error: string | null;
    count: number | null;
  }) => void;
  onDismissImportBanner: () => void;
}

interface ItemCardProps {
  item: BillItem;
  people: Person[];
  isNew: boolean;
  splitMode: SplitMode;
  onUpdate: (itemId: string, updates: { name?: string; priceCents?: number }) => void;
  onDelete: (itemId: string) => void;
  onToggleAssignment: (itemId: string, personId: string) => void;
}

function ItemCard({
  item,
  people,
  isNew,
  splitMode,
  onUpdate,
  onDelete,
  onToggleAssignment,
}: ItemCardProps) {
  const [draftName, setDraftName] = useState(item.name);
  const [draftPrice, setDraftPrice] = useState((item.priceCents / 100).toFixed(2));

  useEffect(() => {
    setDraftName(item.name);
    setDraftPrice((item.priceCents / 100).toFixed(2));
  }, [item.name, item.priceCents]);

  const assignedPeople = people.filter((person) => item.assignedTo.includes(person.id));
  const isUnassigned = assignedPeople.length === 0;
  const everyoneAssigned = people.length > 0 && assignedPeople.length === people.length;

  return (
    <article
      className={`rounded-3xl border p-4 shadow-sm transition ${
        isUnassigned
          ? "border-amber-300 bg-amber-50/70"
          : "border-slate-200 bg-white"
      } ${isNew ? "ring-2 ring-emerald-200 ring-offset-2 ring-offset-slate-50" : ""}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-3">
          <div className="grid gap-3 sm:grid-cols-[1fr_7rem]">
            <label className="space-y-1">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Item
              </span>
              <input
                value={draftName}
                onChange={(event) => setDraftName(event.target.value)}
                onBlur={() => onUpdate(item.id, { name: draftName })}
                className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-950 outline-none transition focus:border-slate-400"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Price
              </span>
              <input
                inputMode="decimal"
                value={draftPrice}
                onChange={(event) => setDraftPrice(event.target.value)}
                onBlur={() => {
                  const cents = parseCurrencyToCents(draftPrice);
                  setDraftPrice((cents / 100).toFixed(2));
                  onUpdate(item.id, { priceCents: cents });
                }}
                className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-950 outline-none transition focus:border-slate-400"
              />
            </label>
          </div>

          {splitMode === "individual" ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Assign to people
                </p>
                <div className="flex items-center gap-2">
                  {everyoneAssigned ? (
                    <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                      Everyone
                    </span>
                  ) : null}
                  <p className="text-sm font-semibold text-slate-700">
                    {formatCents(item.priceCents)}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {people.map((person) => {
                  const assigned = item.assignedTo.includes(person.id);

                  return (
                    <PersonChip
                      key={person.id}
                      person={person}
                      assigned={assigned}
                      onClick={() => onToggleAssignment(item.id, person.id)}
                    />
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600">
              Quick split is on — this item will be divided evenly across everyone.
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => onDelete(item.id)}
          className="rounded-full border border-slate-200 p-2 text-slate-400 transition hover:border-rose-200 hover:text-rose-500"
          aria-label={`Delete ${item.name}`}
        >
          ✕
        </button>
      </div>

      {splitMode === "equal" ? (
        <p className="mt-3 text-sm text-slate-500">
          Included in the even split across all people.
        </p>
      ) : isUnassigned ? (
        <div className="mt-3 flex items-center gap-2 rounded-2xl border border-amber-200 bg-white/70 px-3 py-2 text-sm text-amber-800">
          <span aria-hidden="true">⚠️</span>
          <span>This item is not assigned yet and will be excluded from totals.</span>
        </div>
      ) : everyoneAssigned ? (
        <p className="mt-3 text-sm text-slate-500">Shared by everyone on the bill.</p>
      ) : (
        <p className="mt-3 text-sm text-slate-500">
          Split between {assignedPeople.map((person) => person.name).join(", ")}.
        </p>
      )}
    </article>
  );
}

export function ItemsSection({
  people,
  items,
  splitMode,
  subtotalCents,
  itemName,
  itemPrice,
  itemNameInputRef,
  itemPriceInputRef,
  receiptInputRef,
  newItemId,
  receiptImportStatus,
  receiptImportError,
  receiptImportCount,
  onItemNameChange,
  onItemPriceChange,
  onAddItem,
  onAddImportedItems,
  onUpdateItem,
  onRemoveItem,
  onToggleAssignment,
  onSetSplitMode,
  onReceiptImportStateChange,
  onDismissImportBanner,
}: ItemsSectionProps) {
  const handleReceiptUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;

    if (!apiKey) {
      onReceiptImportStateChange({
        status: "error",
        error: "Couldn't read the receipt — try a clearer photo or add items manually",
        count: null,
      });
      event.target.value = "";
      return;
    }

    onReceiptImportStateChange({
      status: "loading",
      error: null,
      count: null,
    });

    try {
      const base64Image = await readFileAsBase64(file);
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey,
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    inline_data: {
                      mime_type: file.type || "image/jpeg",
                      data: base64Image,
                    },
                  },
                  {
                    text: RECEIPT_IMPORT_PROMPT,
                  },
                ],
              },
            ],
            generationConfig: {
              response_mime_type: "application/json",
            },
          }),
        },
      );

      if (!response.ok) {
        throw new Error(`Gemini request failed with ${response.status}`);
      }

      const responseBody = (await response.json()) as unknown;
      const rawText = extractGeminiText(responseBody);
      const parsedItems = normalizeImportedItems(JSON.parse(rawText));

      onAddImportedItems(
        parsedItems.map((item) => ({
          name: item.name,
          priceCents: Math.round(item.price * 100),
        })),
      );

      onReceiptImportStateChange({
        status: "idle",
        error: null,
        count: parsedItems.length,
      });
    } catch {
      onReceiptImportStateChange({
        status: "error",
        error: "Couldn't read the receipt — try a clearer photo or add items manually",
        count: null,
      });
    } finally {
      event.target.value = "";
    }
  };

  return (
    <section className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">Items</h2>
          <p className="text-sm text-slate-500">
            {splitMode === "individual"
              ? "Add dishes and drinks, then tap people to mark who shared each one."
              : "Add dishes and drinks, and we’ll divide everything evenly for you."}
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold text-slate-700">{formatCents(subtotalCents)}</p>
          <p className="text-xs text-slate-500">subtotal</p>
        </div>
      </div>

      <div className="space-y-3">
        <SplitModeToggle splitMode={splitMode} onSetSplitMode={onSetSplitMode} />

        <input
          ref={receiptInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleReceiptUpload}
          className="hidden"
        />

        <button
          type="button"
          onClick={() => receiptInputRef.current?.click()}
          disabled={receiptImportStatus === "loading"}
          className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800 transition hover:border-slate-300 hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {receiptImportStatus === "loading" ? "Reading receipt..." : "Upload Receipt"}
        </button>

        {receiptImportCount ? (
          <div className="flex items-start justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            <div>
              <p className="font-medium">
                {receiptImportCount} {receiptImportCount === 1 ? "item" : "items"} imported — please review and correct
              </p>
            </div>
            <button
              type="button"
              onClick={onDismissImportBanner}
              className="text-emerald-700 transition hover:text-emerald-900"
              aria-label="Dismiss import banner"
            >
              ✕
            </button>
          </div>
        ) : null}

        {receiptImportStatus === "error" && receiptImportError ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
            {receiptImportError}
          </div>
        ) : null}

        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_8rem_auto]">
          <input
            ref={itemNameInputRef}
            value={itemName}
            onChange={(event) => onItemNameChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                itemPriceInputRef.current?.focus();
              }
            }}
            placeholder="Item name"
            className="min-w-0 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
          />
          <input
            ref={itemPriceInputRef}
            inputMode="decimal"
            value={itemPrice}
            onChange={(event) => onItemPriceChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                onAddItem();
              }
            }}
            placeholder="0.00"
            className="min-w-0 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
          />
          <button
            type="button"
            onClick={onAddItem}
            className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 active:scale-[0.98]"
          >
            Add
          </button>
        </div>

        {people.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-amber-200 bg-amber-50 px-4 py-5 text-sm text-amber-800">
            Add people first.
          </div>
        ) : null}

        {items.length > 0 ? (
          <div className="space-y-3">
            {items.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                people={people}
                isNew={newItemId === item.id}
                splitMode={splitMode}
                onUpdate={onUpdateItem}
                onDelete={onRemoveItem}
                onToggleAssignment={onToggleAssignment}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
            No items yet — add the first dish to get the split started.
          </div>
        )}
      </div>
    </section>
  );
}
