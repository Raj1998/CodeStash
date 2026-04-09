"use client";

import { useMemo, useState } from "react";

import { useBill } from "@/hooks/useBill";
import type { BillItem, Person } from "@/types";

const formatCents = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value / 100);

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
  const activeClasses = assigned === undefined
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
  onUpdate,
  onDelete,
  onToggleAssignment,
}: {
  item: BillItem;
  people: Person[];
  onUpdate: (itemId: string, updates: { name?: string; priceCents?: number }) => void;
  onDelete: (itemId: string) => void;
  onToggleAssignment: (itemId: string, personId: string) => void;
}) => {
  const [draftName, setDraftName] = useState(item.name);
  const [draftPrice, setDraftPrice] = useState((item.priceCents / 100).toFixed(2));

  const assignedPeople = people.filter((person) => item.assignedTo.includes(person.id));
  const isUnassigned = assignedPeople.length === 0;

  return (
    <article
      className={`rounded-3xl border p-4 shadow-sm transition ${
        isUnassigned
          ? "border-amber-300 bg-amber-50/70"
          : "border-slate-200 bg-white"
      }`}
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

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Assign to people
              </p>
              <p className="text-sm font-semibold text-slate-700">
                {formatCents(item.priceCents)}
              </p>
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

      {isUnassigned ? (
        <div className="mt-3 flex items-center gap-2 rounded-2xl border border-amber-200 bg-white/70 px-3 py-2 text-sm text-amber-800">
          <span aria-hidden="true">⚠️</span>
          <span>This item is not assigned yet and will be excluded from totals.</span>
        </div>
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
    addPerson,
    removePerson,
    addItem,
    updateItem,
    removeItem,
    toggleItemAssignment,
  } = useBill();

  const [personName, setPersonName] = useState("");
  const [itemName, setItemName] = useState("");
  const [itemPrice, setItemPrice] = useState("");

  const subtotalCents = useMemo(
    () => state.items.reduce((sum, item) => sum + item.priceCents, 0),
    [state.items],
  );
  const unassignedCount = useMemo(
    () => state.items.filter((item) => item.assignedTo.length === 0).length,
    [state.items],
  );

  const handleAddPerson = () => {
    if (!personName.trim()) {
      return;
    }

    addPerson({ name: personName });
    setPersonName("");
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

    if (!itemName.trim() || priceCents <= 0) {
      return;
    }

    addItem({
      name: itemName,
      priceCents,
    });
    setItemName("");
    setItemPrice("");
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col gap-5 px-4 py-5 sm:max-w-2xl sm:px-6">
      <header className="space-y-2 rounded-[2rem] bg-slate-900 px-5 py-6 text-white shadow-lg shadow-slate-300/40">
        <p className="text-sm font-medium text-slate-300">Dinner table split helper</p>
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Split the Bill</h1>
            <p className="mt-1 text-sm text-slate-300">
              Add everyone, drop in the items, and tap chips to assign who shared what.
            </p>
          </div>
        </div>
      </header>

      <section className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm">
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

      <section className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Items</h2>
            <p className="text-sm text-slate-500">
              Add dishes and drinks, then tap people to mark who shared each one.
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold text-slate-700">{formatCents(subtotalCents)}</p>
            <p className="text-xs text-slate-500">subtotal</p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-[1fr_7rem_auto] gap-2">
            <input
              value={itemName}
              onChange={(event) => setItemName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  handleAddItem();
                }
              }}
              placeholder="Item name"
              className="min-w-0 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
            />
            <input
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
              Add people first so you can assign items as you go.
            </div>
          ) : null}

          {state.items.length > 0 ? (
            <div className="space-y-3">
              {state.items.map((item) => (
                <ItemCard
                  key={item.id}
                  item={item}
                  people={state.people}
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

      <section className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm">
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
            {unassignedCount > 0
              ? `${unassignedCount} unassigned`
              : "All assigned"}
          </div>
        </div>
      </section>
    </main>
  );
}
