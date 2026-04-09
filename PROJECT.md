# Split the Bill — Project Overview

> This file is the source of truth for the project. Read it before making any changes.
> When in doubt about a product decision, refer back to this document.

---

## What We're Building

A **client-side web app** that helps a group of friends split a restaurant bill at the dinner table.
No backend. No auth. No database. Everything lives in React state.

Target device: **mobile-first** (someone will hand their phone to a friend at dinner).

---

## Tech Stack

- **Framework:** Next.js (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **State:** React (`useState` / custom hook — no Redux, no Zustand, keep it simple)
- **No backend, no external APIs** (except image upload stretch goal)

---

## Core Features (Must Work End-to-End)

1. **Add people** to the bill (name + auto-assigned color avatar)
2. **Add items** (name + price)
3. **Assign items to people** — including shared items split among multiple people
4. **Tax and tip** — tip enterable as % or $, both computed proportionally
5. **Final summary** — each person sees exactly what they owe, itemized

---

## Key Product Decisions

These are intentional choices — don't second-guess them without a reason:

- **Shared items** split equally among all assigned people (e.g. a $30 bottle of wine shared by 3 = $10 each)
- **Tax and tip** split *proportionally* based on each person's share of the subtotal (fairest method)
- **Unassigned items** are flagged visually but excluded from all totals — don't silently drop them
- **Split evenly mode** — a toggle to skip per-item assignment and just divide everything equally (fast path)
- **No item = no summary** — empty states should be friendly, not blank

---

## Data Model

```ts
interface Person {
  id: string;
  name: string;
  color: string; // from a preset palette
}

interface BillItem {
  id: string;
  name: string;
  price: number; // in dollars, always positive
  assignedTo: string[]; // array of Person IDs
}

interface BillState {
  people: Person[];
  items: BillItem[];
  tax: number;       // dollar amount
  tip: number;       // dollar amount (derived from % or entered directly)
  splitMode: 'individual' | 'equal';
}

interface PersonTotal {
  personId: string;
  itemizedItems: { name: string; share: number }[];
  subtotal: number;
  taxShare: number;
  tipShare: number;
  total: number;
}
```

---

## App Structure

```
/app
  page.tsx              ← single page, composes all sections
  layout.tsx            ← minimal layout, mobile viewport

/components
  PeopleSection.tsx     ← add/remove people
  ItemsSection.tsx      ← add/edit/delete items + assign people
  TaxTipSection.tsx     ← tax input + tip (% or $ toggle)
  SummarySection.tsx    ← per-person breakdown, copy to clipboard
  SplitModeToggle.tsx   ← "Assign individually" vs "Split evenly"

/hooks
  useBill.ts            ← all state + computed values (source of truth)

/types
  index.ts              ← all shared TypeScript interfaces
```

---

## UX Principles

- **Fast.** Minimum taps from "we got the bill" to "everyone knows what they owe."
- **Scannable.** At a dinner table, people don't read — they glance.
- **Forgiving.** Easy to edit items, reassign people, change the tip.
- **Satisfying.** The summary should feel like a clean receipt, not a spreadsheet.

---

## Explicit Non-Goals (Don't Build These)

- No backend / API calls
- No user accounts or authentication
- No persistence (localStorage is fine as a stretch, not required)
- No image/receipt upload (stretch goal, only after core is complete)
- No split-by-percentage (equal split among assignees is enough)
- No currency conversion
- No animations that slow down the experience

---

## Stretch Goals (Only After Core Is Done)

In priority order:

1. **Copy summary to clipboard** — plain text for pasting into iMessage/WhatsApp
2. **Receipt image upload** — parse items from a photo using an API
3. **localStorage persistence** — survive a page refresh
4. **"Venmo deep link"** — tap to open Venmo with amount pre-filled

---

## What "Done" Looks Like

A working flow:

1. Add 3–4 people
2. Add 6–8 items, assign them (some shared)
3. Enter tax and tip
4. See a clear per-person total in the summary
5. Hand phone to a friend — they instantly understand what they owe

If that flow works smoothly and looks good on mobile, it's done.

---

## Agent Instructions

- **Always read this file first** before making changes
- **Do not add features** not listed here without asking
- **Prefer simple over clever** — this is a dinner table tool, not a fintech app
- **Mobile-first** — design for 375px width, then scale up
- **One file, one job** — keep components focused and composable
- **The `useBill` hook is sacred** — all business logic lives there, not in components
