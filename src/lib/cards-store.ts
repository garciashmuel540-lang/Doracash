import { create } from "zustand";
import { persist } from "zustand/middleware";
import { CARD_LIMIT, normalizeCard, normalizeCardList, type CardDraft, type SavedCard } from "./cards.ts";

type CardsStore = {
  cards: SavedCard[];
  save: (draft: CardDraft, id?: string) => boolean;
  remove: (id: string) => (() => boolean) | null;
  replace: (cards: unknown) => boolean;
};
export const useCards = create<CardsStore>()(persist((set, get) => ({
  cards: [],
  save: (draft, id) => {
    const cards = get().cards;
    if ((id && !cards.some(c => c.id === id)) || (!id && cards.length >= CARD_LIMIT)) return false;
    const card = normalizeCard({ ...draft, id: id ?? crypto.randomUUID() });
    if (!card) return false;
    set({ cards: id ? cards.map(c => c.id === id ? card : c) : [...cards, card] });
    return true;
  },
  remove: (id) => {
    const index = get().cards.findIndex(c => c.id === id);
    const card = get().cards[index];
    if (!card) return null;
    set({ cards: get().cards.filter(c => c.id !== id) });
    return () => {
      const current = get().cards;
      if (current.some(c => c.id === id) || current.length >= CARD_LIMIT) return false;
      const restored = [...current];
      restored.splice(Math.min(index, restored.length), 0, card);
      set({ cards: restored });
      return true;
    };
  },
  replace: (value) => {
    const cards = normalizeCardList(value);
    if (!cards) return false;
    set({ cards });
    return true;
  },
}), {
  name: "doracash-cards-v1",
  partialize: state => ({ cards: state.cards }),
  merge: (persisted, current) => ({
    ...current,
    cards: normalizeCardList((persisted as { cards?: unknown } | null)?.cards) ?? [],
  }),
}));
