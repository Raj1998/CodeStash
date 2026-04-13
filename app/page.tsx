"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { useBill } from "@/hooks/useBill";
import type { BillItem, Person, PersonTotal, SplitMode, TipInputMode } from "@/types";

const GEMINI_MODEL =
  process.env.NEXT_PUBLIC_GEMINI_MODEL?.trim() || "gemini-3-flash-preview";
const RECEIPT_IMPORT_PROMPT =
  'Parse this restaurant receipt. Return ONLY a JSON array of items, no markdown, no explanation. Format: [{"name": string, "price": number}] where price is in dollars as a decimal. Exclude tax, tip, and totals.';

interface ImportedReceiptItem {
  name: string;
  price: number;
}

const formatCents = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value / 100);

const formatPercentage = (value: number) => `${value.toFixed(1)}%`;

const parseCurrencyToCents = (value: string) => {
  const normalized = value.replace(/[^0-9.]/g, "").trim();

  if (!normalized) {
    return 0;
  }

  const parsed = Number(normalized);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }

  return Math.round(parsed * 100);
};

const getInitials = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    return "?";
  }

  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
};

const readFileAsBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const result = reader.result;

      if (typeof result !== "string") {
        reject(new Error("Failed to read file"));
        return;
      }

      const [, base64 = ""] = result.split(",");
      resolve(base64);
    };

    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });

const normalizeImportedItems = (payload: unknown): ImportedReceiptItem[] => {
  if (!Array.isArray(payload)) {
    throw new Error("Receipt response was not an item array");
  }

  const items = payload
    .map((entry) => {
      if (typeof entry !== "object" || entry === null) {
        return null;
      }

      const name = "name" in entry ? entry.name : undefined;
      const price = "price" in entry ? entry.price : undefined;

      if (typeof name !== "string") {
        return null;
      }

      const normalizedPrice = typeof price === "number" ? price : Number(price);

      if (!Number.isFinite(normalizedPrice) || normalizedPrice <= 0) {
        return null;
      }

      return {
        name: name.trim(),
        price: normalizedPrice,
      } satisfies ImportedReceiptItem;
    })
    .filter((entry): entry is ImportedReceiptItem => Boolean(entry && entry.name));

  if (items.length === 0) {
    throw new Error("Receipt response did not contain valid items");
  }

  return items;
};

const extractGeminiText = (responseBody: unknown) => {
  if (typeof responseBody !== "object" || responseBody === null) {
    throw new Error("Invalid Gemini response");
  }

  if (
    "candidates" in responseBody &&
    Array.isArray(responseBody.candidates) &&
    responseBody.candidates.length > 0
  ) {
    const candidate = responseBody.candidates[0];

    if (
      typeof candidate === "object" &&
      candidate !== null &&
      "content" in candidate &&
      typeof candidate.content === "object" &&
      candidate.content !== null &&
      "parts" in candidate.content &&
      Array.isArray(candidate.content.parts)
    ) {
      const parts = candidate.content.parts as unknown[];
      const textParts = parts
        .map((part: unknown) => {
          if (typeof part === "object" && part !== null && "text" in part) {
            return typeof part.text === "string" ? part.text : "";
          }

          return "";
        })
        .filter(Boolean);

      if (textParts.length > 0) {
        return textParts.join("").trim();
      }
    }
  }

  throw new Error("Gemini did not return receipt items");
};

const buildSummaryText = (
  people: Person[],
  totals: PersonTotal[],
  splitMode: SplitMode,
) => {
  const lines = totals.flatMap((total) => {
    const person = people.find((entry) => entry.id === total.personId);
    const name = person?.name ?? "Unknown person";

    if (splitMode === "equal") {
      return [name, `- Equal share: ${formatCents(total.totalCents)}`, ""];
    }

    const itemLines = total.itemizedItems.length
      ? total.itemizedItems.map((item) => {
          const label = item.isShared
            ? `${item.name} (shared ÷${item.splitCount})`
            : item.name;

          return `- ${label}: ${formatCents(item.shareCents)}`;
        })
      : ["- No assigned items"];

    return [
      name,
      ...itemLines,
      `Tax: ${formatCents(total.taxShareCents)}`,
      `Tip: ${formatCents(total.tipShareCents)}`,
      `Total: ${formatCents(total.totalCents)}`,
      "",
    ];
  });

  return lines.join("\n").trim();
};

const PersonChip = ({
  person,
  assigned,
  onClick,
  showRemove,
}: {
  person: Person;
  assigned?: boolean;
  onClick: () => void;
  showRemove?: boolean;
}) => {
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
};

const ItemCard = ({
  item,
  people,
  isNew,
  splitMode,
  onUpdate,
  onDelete,
  onToggleAssignment,
}: {
  item: BillItem;
  people: Person[];
  isNew: boolean;
  splitMode: SplitMode;
  onUpdate: (itemId: string, updates: { name?: string; priceCents?: number }) => void;
  onDelete: (itemId: string) => void;
  onToggleAssignment: (itemId: string, personId: string) => void;
}) => {
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
};

export default function Home() {
  const {
    state,
    tipState,
    addPerson,
    removePerson,
    addItem,
    updateItem,
    removeItem,
    toggleItemAssignment,
    setTax,
    setTip,
    reset,
    setSplitMode,
    personTotals,
  } = useBill();

  const personNameInputRef = useRef<HTMLInputElement>(null);
  const itemNameInputRef = useRef<HTMLInputElement>(null);
  const itemPriceInputRef = useRef<HTMLInputElement>(null);
  const receiptInputRef = useRef<HTMLInputElement>(null);

  const [personName, setPersonName] = useState("");
  const [itemName, setItemName] = useState("");
  const [itemPrice, setItemPrice] = useState("");
  const [taxInput, setTaxInput] = useState("");
  const [tipInput, setTipInput] = useState("");
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "error">("idle");
  const [newItemId, setNewItemId] = useState<string | null>(null);
  const [receiptImportStatus, setReceiptImportStatus] = useState<"idle" | "loading" | "error">("idle");
  const [receiptImportError, setReceiptImportError] = useState<string | null>(null);
  const [receiptImportCount, setReceiptImportCount] = useState<number | null>(null);

  const totalsMap = personTotals();
  const subtotalCents = useMemo(
    () => state.items.reduce((sum, item) => sum + item.priceCents, 0),
    [state.items],
  );
  const unassignedCount = useMemo(
    () => state.items.filter((item) => item.assignedTo.length === 0).length,
    [state.items],
  );
  const grandTotalCents = subtotalCents + state.taxCents + state.tipCents;
  const orderedTotals = useMemo(
    () => state.people.map((person) => totalsMap[person.id]).filter(Boolean),
    [state.people, totalsMap],
  );

  useEffect(() => {
    if (!newItemId) {
      return;
    }

    const timeoutId = window.setTimeout(() => setNewItemId(null), 1800);

    return () => window.clearTimeout(timeoutId);
  }, [newItemId]);

  const handleAddPerson = () => {
    if (!personName.trim()) {
      return;
    }

    addPerson({ name: personName });
    setPersonName("");
    window.requestAnimationFrame(() => personNameInputRef.current?.focus());
  };

  const handleRemovePerson = (person: Person) => {
    const shouldRemove = window.confirm(
      `Remove ${person.name}? They will also be removed from any assigned items.`,
    );

    if (!shouldRemove) {
      return;
    }

    removePerson(person.id);
  };

  const handleAddItem = () => {
    const priceCents = parseCurrencyToCents(itemPrice);
    const trimmedName = itemName.trim();

    if (!trimmedName || priceCents <= 0) {
      return;
    }

    addItem({
      name: trimmedName,
      priceCents,
    });
    setItemName("");
    setItemPrice("");
    setReceiptImportCount(null);
    setReceiptImportError(null);
    setReceiptImportStatus("idle");
    window.requestAnimationFrame(() => itemNameInputRef.current?.focus());
  };

  useEffect(() => {
    if (newItemId || state.items.length === 0) {
      return;
    }

    setNewItemId(state.items[state.items.length - 1]?.id ?? null);
  }, [state.items, newItemId]);

  const handleTaxBlur = () => {
    const cents = parseCurrencyToCents(taxInput);
    setTax(cents);
    setTaxInput((cents / 100).toFixed(2));
  };

  const handleTipModeChange = (mode: TipInputMode) => {
    if (mode === tipState.mode) {
      return;
    }

    if (mode === "percentage") {
      setTipInput(tipState.percentage === 0 ? "" : tipState.percentage.toFixed(1));
      setTip(tipState.percentage, "percentage");
      return;
    }

    setTipInput(state.tipCents === 0 ? "" : (state.tipCents / 100).toFixed(2));
    setTip(state.tipCents, "amount");
  };

  const handleTipBlur = () => {
    if (tipState.mode === "percentage") {
      const normalized = tipInput.trim();
      const parsed = normalized === "" ? 0 : Number(normalized);
      const safeValue = Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;

      setTip(safeValue, "percentage");
      setTipInput(safeValue === 0 ? "" : safeValue.toFixed(1));
      return;
    }

    const cents = parseCurrencyToCents(tipInput);
    setTip(cents, "amount");
    setTipInput((cents / 100).toFixed(2));
  };

  const handleCopySummary = async () => {
    try {
      const summaryText = buildSummaryText(state.people, orderedTotals, state.splitMode);
      await navigator.clipboard.writeText(summaryText);
      setCopyStatus("copied");
      window.setTimeout(() => setCopyStatus("idle"), 2000);
    } catch {
      setCopyStatus("error");
      window.setTimeout(() => setCopyStatus("idle"), 2500);
    }
  };

  const handleDismissImportBanner = () => {
    setReceiptImportCount(null);
    setReceiptImportError(null);
    setReceiptImportStatus("idle");
  };

  const handleReceiptUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;

    if (!apiKey) {
      setReceiptImportStatus("error");
      setReceiptImportError(
        "Couldn't read the receipt — try a clearer photo or add items manually",
      );
      event.target.value = "";
      return;
    }

    setReceiptImportStatus("loading");
    setReceiptImportError(null);
    setReceiptImportCount(null);

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

      parsedItems.forEach((item) => {
        addItem({
          name: item.name,
          priceCents: Math.round(item.price * 100),
        });
      });

      setReceiptImportStatus("idle");
      setReceiptImportCount(parsedItems.length);
      setNewItemId(null);
    } catch {
      setReceiptImportStatus("error");
      setReceiptImportError(
        "Couldn't read the receipt — try a clearer photo or add items manually",
      );
    } finally {
      event.target.value = "";
    }
  };

  const handleResetBill = () => {
    const shouldReset = window.confirm(
      "Start a new bill? This will clear all people, items, tax, and tip.",
    );

    if (!shouldReset) {
      return;
    }

    reset();
    setPersonName("");
    setItemName("");
    setItemPrice("");
    setTaxInput("");
    setTipInput("");
    setCopyStatus("idle");
    setNewItemId(null);
    setReceiptImportStatus("idle");
    setReceiptImportError(null);
    setReceiptImportCount(null);
    window.requestAnimationFrame(() => personNameInputRef.current?.focus());
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8">
      <header className="sticky top-0 z-10 -mx-4 border-b border-slate-200/80 bg-slate-50/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
              Dinner table tool
            </p>
            <h1 className="text-lg font-semibold tracking-tight text-slate-950 sm:text-xl">
              Split the Bill
            </h1>
          </div>
          <button
            type="button"
            onClick={handleResetBill}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-100"
          >
            Reset / New Bill
          </button>
        </div>
      </header>

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
              <p className="mt-1 text-2xl font-semibold">{state.people.length}</p>
            </div>
            <div className="rounded-3xl bg-white/10 px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-slate-300">Items</p>
              <p className="mt-1 text-2xl font-semibold">{state.items.length}</p>
            </div>
            <div className="rounded-3xl bg-white/10 px-4 py-3 sm:col-span-2 lg:col-span-2">
              <p className="text-xs uppercase tracking-wide text-slate-300">Grand total</p>
              <p className="mt-1 text-3xl font-semibold tracking-tight">{formatCents(grandTotalCents)}</p>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-5">
          <section className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-950">People</h2>
                <p className="text-sm text-slate-500">
                  Add each friend once, then tap their chip to remove them.
                </p>
              </div>
              <div className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-600">
                {state.people.length} {state.people.length === 1 ? "person" : "people"}
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex gap-2">
                <input
                  ref={personNameInputRef}
                  value={personName}
                  onChange={(event) => setPersonName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      handleAddPerson();
                    }
                  }}
                  placeholder="Add a person"
                  className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                />
                <button
                  type="button"
                  onClick={handleAddPerson}
                  className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 active:scale-[0.98]"
                >
                  Add
                </button>
              </div>

              {state.people.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {state.people.map((person) => (
                    <PersonChip
                      key={person.id}
                      person={person}
                      showRemove
                      onClick={() => handleRemovePerson(person)}
                    />
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                  Start by adding everyone at the table.
                </div>
              )}
            </div>
          </section>

          <section className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-950">Items</h2>
                <p className="text-sm text-slate-500">
                  {state.splitMode === "individual"
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
              <div className="inline-flex rounded-full bg-slate-100 p-1 shadow-inner">
                {(["individual", "equal"] as SplitMode[]).map((mode) => {
                  const isActive = state.splitMode === mode;

                  return (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setSplitMode(mode)}
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
                    onClick={handleDismissImportBanner}
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
                  onChange={(event) => setItemName(event.target.value)}
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
                  onChange={(event) => setItemPrice(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      handleAddItem();
                    }
                  }}
                  placeholder="0.00"
                  className="min-w-0 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                />
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 active:scale-[0.98]"
                >
                  Add
                </button>
              </div>

              {state.people.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-amber-200 bg-amber-50 px-4 py-5 text-sm text-amber-800">
                  Add people first.
                </div>
              ) : null}

              {state.items.length > 0 ? (
                <div className="space-y-3">
                  {state.items.map((item) => (
                    <ItemCard
                      key={item.id}
                      item={item}
                      people={state.people}
                      isNew={newItemId === item.id}
                      splitMode={state.splitMode}
                      onUpdate={updateItem}
                      onDelete={removeItem}
                      onToggleAssignment={toggleItemAssignment}
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
        </div>

        <div className="space-y-5">
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
                    onChange={(event) => setTaxInput(event.target.value)}
                    onBlur={handleTaxBlur}
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
                          onClick={() => handleTipModeChange(mode)}
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
                      onChange={(event) => setTipInput(event.target.value)}
                      onBlur={handleTipBlur}
                      placeholder={tipState.mode === "percentage" ? "18" : "0.00"}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400"
                    />
                  </label>

                  <p className="text-sm text-slate-500">
                    {tipState.mode === "percentage"
                      ? `Tip amount: ${formatCents(state.tipCents)}`
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
                    <span className="font-medium text-slate-900">{formatCents(state.taxCents)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Tip</span>
                    <span className="font-medium text-slate-900">{formatCents(state.tipCents)}</span>
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t border-dashed border-slate-300 pt-3 text-base font-semibold text-slate-950">
                    <span>Grand total</span>
                    <span>{formatCents(grandTotalCents)}</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

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
                onClick={handleCopySummary}
                disabled={orderedTotals.length === 0 || state.items.length === 0}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {copyStatus === "copied"
                  ? "Copied"
                  : copyStatus === "error"
                    ? "Copy failed"
                    : "Copy summary"}
              </button>
            </div>

            {state.items.length === 0 ? (
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

                {orderedTotals.map((total) => {
                  const person = state.people.find((entry) => entry.id === total.personId);

                  if (!person) {
                    return null;
                  }

                  const isEqualMode = state.splitMode === "equal";

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
                              Grand total ÷ {state.people.length} {state.people.length === 1 ? "person" : "people"} = {formatCents(total.totalCents)} each.
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
        </div>
      </div>
    </main>
  );
}
