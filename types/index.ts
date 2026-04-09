export type SplitMode = "individual" | "equal";

export type TipInputMode = "amount" | "percentage";

export interface Person {
  id: string;
  name: string;
  color: string;
}

export interface BillItem {
  id: string;
  name: string;
  priceCents: number;
  assignedTo: string[];
}

export interface BillState {
  people: Person[];
  items: BillItem[];
  taxCents: number;
  tipCents: number;
  splitMode: SplitMode;
}

export interface TipState {
  mode: TipInputMode;
  percentage: number;
}

export interface PersonItemizedShare {
  name: string;
  shareCents: number;
}

export interface PersonTotal {
  personId: string;
  itemizedItems: PersonItemizedShare[];
  subtotalCents: number;
  taxShareCents: number;
  tipShareCents: number;
  totalCents: number;
}

export interface PersonTotalsMap {
  [personId: string]: PersonTotal;
}

export interface AddPersonInput {
  name: string;
  color?: string;
}

export interface AddItemInput {
  name: string;
  priceCents: number;
  assignedTo?: string[];
}

export interface UpdateItemInput {
  name?: string;
  priceCents?: number;
  assignedTo?: string[];
}
