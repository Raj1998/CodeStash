import type { Person, PersonTotal, SplitMode } from "@/types";

interface ImportedReceiptItem {
  name: string;
  price: number;
}

export const GEMINI_MODEL =
  process.env.NEXT_PUBLIC_GEMINI_MODEL?.trim() || "gemini-3-flash-preview";

export const RECEIPT_IMPORT_PROMPT =
  'Parse this restaurant receipt. Return ONLY a JSON array of items, no markdown, no explanation. Format: [{"name": string, "price": number}] where price is in dollars as a decimal. Exclude tax, tip, and totals.';

export const formatCents = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value / 100);

export const formatPercentage = (value: number) => `${value.toFixed(1)}%`;

export const parseCurrencyToCents = (value: string) => {
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

export const getInitials = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    return "?";
  }

  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
};

export const readFileAsBase64 = (file: File) =>
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

export const normalizeImportedItems = (payload: unknown): ImportedReceiptItem[] => {
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

export const extractGeminiText = (responseBody: unknown) => {
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

export const buildSummaryText = (
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
