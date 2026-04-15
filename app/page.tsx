"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { HeroSection } from "@/components/HeroSection";
import { ItemsSection } from "@/components/ItemsSection";
import { PeopleSection } from "@/components/PeopleSection";
import { QuickStatusCard } from "@/components/QuickStatusCard";
import { SummarySection } from "@/components/SummarySection";
import { TaxTipSection } from "@/components/TaxTipSection";
import { useBill } from "@/hooks/useBill";
import type { Person, TipInputMode } from "@/types";
import { buildSummaryText, formatCents, parseCurrencyToCents } from "@/utils/billUtils";

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

  useEffect(() => {
    if (newItemId || state.items.length === 0) {
      return;
    }

    setNewItemId(state.items[state.items.length - 1]?.id ?? null);
  }, [state.items, newItemId]);

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

  const handleAddImportedItems = (
    items: Array<{ name: string; priceCents: number }>,
  ) => {
    items.forEach((item) => addItem(item));
    setNewItemId(null);
  };

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

      <HeroSection
        peopleCount={state.people.length}
        itemsCount={state.items.length}
        grandTotalCents={grandTotalCents}
      />

      <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-5">
          <PeopleSection
            people={state.people}
            personName={personName}
            personNameInputRef={personNameInputRef}
            onPersonNameChange={setPersonName}
            onAddPerson={handleAddPerson}
            onRemovePerson={handleRemovePerson}
          />

          <ItemsSection
            people={state.people}
            items={state.items}
            splitMode={state.splitMode}
            subtotalCents={subtotalCents}
            itemName={itemName}
            itemPrice={itemPrice}
            itemNameInputRef={itemNameInputRef}
            itemPriceInputRef={itemPriceInputRef}
            receiptInputRef={receiptInputRef}
            newItemId={newItemId}
            receiptImportStatus={receiptImportStatus}
            receiptImportError={receiptImportError}
            receiptImportCount={receiptImportCount}
            onItemNameChange={setItemName}
            onItemPriceChange={setItemPrice}
            onAddItem={handleAddItem}
            onAddImportedItems={handleAddImportedItems}
            onUpdateItem={updateItem}
            onRemoveItem={removeItem}
            onToggleAssignment={toggleItemAssignment}
            onSetSplitMode={setSplitMode}
            onReceiptImportStateChange={({ status, error, count }) => {
              setReceiptImportStatus(status);
              setReceiptImportError(error);
              setReceiptImportCount(count);
            }}
            onDismissImportBanner={handleDismissImportBanner}
          />
        </div>

        <div className="space-y-5">
          <TaxTipSection
            taxInput={taxInput}
            tipInput={tipInput}
            taxCents={state.taxCents}
            tipCents={state.tipCents}
            subtotalCents={subtotalCents}
            grandTotalCents={grandTotalCents}
            tipState={tipState}
            onTaxInputChange={setTaxInput}
            onTaxBlur={handleTaxBlur}
            onTipInputChange={setTipInput}
            onTipBlur={handleTipBlur}
            onTipModeChange={handleTipModeChange}
          />

          <QuickStatusCard unassignedCount={unassignedCount} />

          <SummarySection
            people={state.people}
            totals={orderedTotals}
            itemsCount={state.items.length}
            splitMode={state.splitMode}
            grandTotalCents={grandTotalCents}
            copyStatus={copyStatus}
            onCopySummary={handleCopySummary}
          />
        </div>
      </div>
    </main>
  );
}
