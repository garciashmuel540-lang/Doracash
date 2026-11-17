export type CardKind = "credit" | "debit";
export type CardNetwork = "Visa" | "Mastercard" | "American Express" | "Otra";
export type SavedCard = {
  id: string;
  alias: string;
  bank: string;
  kind: CardKind;
  network: CardNetwork;
  last4: string;
  cutDay?: number;
  payDay?: number;
  walletReady: boolean;
};
export type CardDraft = Omit<SavedCard, "id">;
export const CARD_LIMIT = 30;
const networks: CardNetwork[] = ["Visa", "Mastercard", "American Express", "Otra"];

function text(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  // Free text must not become an accidental store of complete payment numbers.
  if (!normalized || normalized.length > max || /\d(?:[\s-]*\d){11,}/.test(normalized)) return null;
  return normalized;
}
function day(value: unknown): value is number | undefined {
  return value === undefined || (typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 31);
}

/** Allowlist fields at every persistence boundary; payment credentials never belong here. */
export function normalizeCard(value: unknown): SavedCard | null {
  if (!value || typeof value !== "object") return null;
  const c = value as Record<string, unknown>;
  const id = text(c.id, 100), alias = text(c.alias, 40), bank = text(c.bank, 60);
  if (!id || !alias || !bank || (c.kind !== "credit" && c.kind !== "debit") ||
      !networks.includes(c.network as CardNetwork) || typeof c.last4 !== "string" || !/^\d{4}$/.test(c.last4) ||
      !day(c.cutDay) || !day(c.payDay) || typeof c.walletReady !== "boolean") return null;
  return {
    id, alias, bank, kind: c.kind, network: c.network as CardNetwork, last4: c.last4,
    ...(c.kind === "credit" && c.cutDay !== undefined ? { cutDay: c.cutDay } : {}),
    ...(c.kind === "credit" && c.payDay !== undefined ? { payDay: c.payDay } : {}),
    walletReady: c.walletReady,
  };
}

export function normalizeCardList(value: unknown): SavedCard[] | null {
  if (!Array.isArray(value) || value.length > CARD_LIMIT) return null;
  const result: SavedCard[] = [];
  for (const entry of value) {
    const card = normalizeCard(entry);
    if (!card || result.some(c => c.id === card.id)) return null;
    result.push(card);
  }
  return result;
}

export const WALLET_LINKS = {
  app: "https://play.google.com/store/apps/details?id=com.google.android.apps.walletnfcrel",
  support: "https://support.google.com/wallet/answer/12059326?co=GENIE.CountryCode%3DNI&hl=es",
  setup: "https://support.google.com/wallet/answer/12058983?hl=es",
};
