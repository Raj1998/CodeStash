"use client";

import { useMemo, useState } from "react";

import type {
  AddItemInput,
  AddPersonInput,
  BillItem,
  BillState,
  Person,
  PersonItemizedShare,
  PersonTotal,
  PersonTotalsMap,
  SplitMode,
  TipInputMode,
  TipState,
  UpdateItemInput,
} from "@/types";

const PERSON_COLORS = [
  "#F97316",
  "#0EA5E9",
  "#8B5CF6",
  "#14B8A6",
  "#EC4899",
  "#F59E0B",
  "#10B981",
  "#6366F1",
];

const DEFAULT_BILL_STATE: BillState = {
  people: [],
  items: [],
  taxCents: 0,
  tipCents: 0,
  splitMode: "individual",
};

const DEFAULT_TIP_STATE: TipState = {
  mode: "amount",
  percentage: 0,
};

const createId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `id-${Math.random().toString(36).slice(2, 10)}`;
};

const clampCents = (value: number) => {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.round(value));
};

const sanitizePercentage = (value: number) => {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, value);
};

const distributeByWeights = (
  totalCents: number,
  weights: number[],
): number[] => {
  if (weights.length === 0) {
    return [];
  }

  const safeTotal = clampCents(totalCents);
  const positiveWeights = weights.map((weight) => Math.max(0, Math.floor(weight)));
  const weightSum = positiveWeights.reduce((sum, weight) => sum + weight, 0);

  if (safeTotal === 0) {
    return new Array(weights.length).fill(0);
  }

  if (weightSum === 0) {
    const baseShare = Math.floor(safeTotal / weights.length);
    const remainder = safeTotal - baseShare * weights.length;

    return positiveWeights.map((_, index) => baseShare + (index < remainder ? 1 : 0));
  }

  const allocations = positiveWeights.map((weight) =>
    Math.floor((safeTotal * weight) / weightSum),
  );
  let remainder = safeTotal - allocations.reduce((sum, value) => sum + value, 0);

  for (let index = 0; index < allocations.length && remainder > 0; index += 1) {
    allocations[index] += 1;
    remainder -= 1;
  }

  return allocations;
};

const distributeItemShare = (priceCents: number, assigneeCount: number) => {
  if (assigneeCount <= 0) {
    return [];
  }

  return distributeByWeights(priceCents, new Array(assigneeCount).fill(1));
};

const buildEmptyPersonTotal = (personId: string): PersonTotal => ({
  personId,
  itemizedItems: [],
  subtotalCents: 0,
  taxShareCents: 0,
  tipShareCents: 0,
  totalCents: 0,
});

const buildPersonTotals = (
  people: Person[],
  items: BillItem[],
  taxCents: number,
  tipCents: number,
  splitMode: SplitMode,
): PersonTotalsMap => {
  const totals = people.reduce<PersonTotalsMap>((accumulator, person) => {
    accumulator[person.id] = buildEmptyPersonTotal(person.id);
    return accumulator;
  }, {});

  if (people.length === 0) {
    return totals;
  }

  if (splitMode === "equal") {
    const grandTotalCents =
      items.reduce((sum, item) => sum + item.priceCents, 0) + taxCents + tipCents;
    const equalShares = distributeByWeights(
      grandTotalCents,
      new Array(people.length).fill(1),
    );

    people.forEach((person, index) => {
      totals[person.id] = {
        personId: person.id,
        itemizedItems: [],
        subtotalCents: 0,
        taxShareCents: 0,
        tipShareCents: 0,
        totalCents: equalShares[index] ?? 0,
      };
    });

    return totals;
  }

  items.forEach((item) => {
    const assignedPeople = item.assignedTo.filter((personId) => totals[personId]);

    if (assignedPeople.length === 0) {
      return;
    }

    const shares = distributeItemShare(item.priceCents, assignedPeople.length);

    assignedPeople.forEach((personId, index) => {
      const shareCents = shares[index] ?? 0;
      const personTotal = totals[personId];
      const itemizedShare: PersonItemizedShare = {
        itemId: item.id,
        name: item.name,
        shareCents,
        splitCount: assignedPeople.length,
        isShared: assignedPeople.length > 1,
      };
      personTotal.itemizedItems.push(itemizedShare);

      personTotal.subtotalCents += shareCents;
    });
  });

  const subtotals = people.map((person) => totals[person.id].subtotalCents);
  const taxShares = distributeByWeights(taxCents, subtotals);
  const tipShares = distributeByWeights(tipCents, subtotals);

  people.forEach((person, index) => {
    const personTotal = totals[person.id];
    personTotal.taxShareCents = taxShares[index] ?? 0;
    personTotal.tipShareCents = tipShares[index] ?? 0;
    personTotal.totalCents =
      personTotal.subtotalCents +
      personTotal.taxShareCents +
      personTotal.tipShareCents;
  });

  return totals;
};

const getNextColor = (people: Person[]) =>
  PERSON_COLORS[people.length % PERSON_COLORS.length];

export interface UseBillResult {
  state: BillState;
  tipState: TipState;
  addPerson: (input: AddPersonInput) => void;
  removePerson: (personId: string) => void;
  addItem: (input: AddItemInput) => void;
  updateItem: (itemId: string, updates: UpdateItemInput) => void;
  removeItem: (itemId: string) => void;
  assignItemToPerson: (itemId: string, personId: string) => void;
  toggleItemAssignment: (itemId: string, personId: string) => void;
  setTax: (taxCents: number) => void;
  setTip: (value: number, mode?: TipInputMode) => void;
  setSplitMode: (mode: SplitMode) => void;
  reset: () => void;
  personTotals: () => PersonTotalsMap;
}

export const useBill = (): UseBillResult => {
  const [state, setState] = useState<BillState>(DEFAULT_BILL_STATE);
  const [tipState, setTipState] = useState<TipState>(DEFAULT_TIP_STATE);

  const subtotalCents = useMemo(
    () => state.items.reduce((sum, item) => sum + item.priceCents, 0),
    [state.items],
  );

  const computedPersonTotals = useMemo(
    () =>
      buildPersonTotals(
        state.people,
        state.items,
        state.taxCents,
        state.tipCents,
        state.splitMode,
      ),
    [state.people, state.items, state.taxCents, state.tipCents, state.splitMode],
  );

  const addPerson = (input: AddPersonInput) => {
    const name = input.name.trim();

    if (!name) {
      return;
    }

    setState((current) => ({
      ...current,
      people: [
        ...current.people,
        {
          id: createId(),
          name,
          color: input.color ?? getNextColor(current.people),
        },
      ],
    }));
  };

  const removePerson = (personId: string) => {
    setState((current) => ({
      ...current,
      people: current.people.filter((person) => person.id !== personId),
      items: current.items.map((item) => ({
        ...item,
        assignedTo: item.assignedTo.filter((assignedId) => assignedId !== personId),
      })),
    }));
  };

  const addItem = (input: AddItemInput) => {
    const name = input.name.trim();
    const priceCents = clampCents(input.priceCents);

    if (!name || priceCents <= 0) {
      return;
    }

    setState((current) => ({
      ...current,
      items: [
        ...current.items,
        {
          id: createId(),
          name,
          priceCents,
          assignedTo: (input.assignedTo ?? []).filter((personId) =>
            current.people.some((person) => person.id === personId),
          ),
        },
      ],
    }));
  };

  const updateItem = (itemId: string, updates: UpdateItemInput) => {
    setState((current) => ({
      ...current,
      items: current.items.map((item) => {
        if (item.id !== itemId) {
          return item;
        }

        return {
          ...item,
          name: updates.name === undefined ? item.name : updates.name.trim(),
          priceCents:
            updates.priceCents === undefined
              ? item.priceCents
              : clampCents(updates.priceCents),
          assignedTo:
            updates.assignedTo === undefined
              ? item.assignedTo
              : updates.assignedTo.filter((personId) =>
                  current.people.some((person) => person.id === personId),
                ),
        };
      }),
    }));
  };

  const removeItem = (itemId: string) => {
    setState((current) => ({
      ...current,
      items: current.items.filter((item) => item.id !== itemId),
    }));
  };

  const assignItemToPerson = (itemId: string, personId: string) => {
    setState((current) => ({
      ...current,
      items: current.items.map((item) => {
        if (item.id !== itemId || item.assignedTo.includes(personId)) {
          return item;
        }

        if (!current.people.some((person) => person.id === personId)) {
          return item;
        }

        return {
          ...item,
          assignedTo: [...item.assignedTo, personId],
        };
      }),
    }));
  };

  const toggleItemAssignment = (itemId: string, personId: string) => {
    setState((current) => ({
      ...current,
      items: current.items.map((item) => {
        if (item.id !== itemId) {
          return item;
        }

        if (!current.people.some((person) => person.id === personId)) {
          return item;
        }

        return item.assignedTo.includes(personId)
          ? {
              ...item,
              assignedTo: item.assignedTo.filter((assignedId) => assignedId !== personId),
            }
          : {
              ...item,
              assignedTo: [...item.assignedTo, personId],
            };
      }),
    }));
  };

  const setTax = (taxCents: number) => {
    setState((current) => ({
      ...current,
      taxCents: clampCents(taxCents),
    }));
  };

  const setTip = (value: number, mode: TipInputMode = tipState.mode) => {
    const sanitizedMode: TipInputMode = mode === "percentage" ? "percentage" : "amount";

    if (sanitizedMode === "percentage") {
      const percentage = sanitizePercentage(value);
      const tipCents = Math.round((subtotalCents * percentage) / 100);

      setTipState({
        mode: sanitizedMode,
        percentage,
      });
      setState((current) => ({
        ...current,
        tipCents,
      }));
      return;
    }

    const tipCents = clampCents(value);
    const percentage = subtotalCents === 0 ? 0 : (tipCents / subtotalCents) * 100;

    setTipState({
      mode: sanitizedMode,
      percentage,
    });
    setState((current) => ({
      ...current,
      tipCents,
    }));
  };

  const setSplitMode = (mode: SplitMode) => {
    setState((current) => ({
      ...current,
      splitMode: mode,
    }));
  };

  const reset = () => {
    setState(DEFAULT_BILL_STATE);
    setTipState(DEFAULT_TIP_STATE);
  };

  return {
    state,
    tipState,
    addPerson,
    removePerson,
    addItem,
    updateItem,
    removeItem,
    assignItemToPerson,
    toggleItemAssignment,
    setTax,
    setTip,
    setSplitMode,
    reset,
    personTotals: () => computedPersonTotals,
  };
};
