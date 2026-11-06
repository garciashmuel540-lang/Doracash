import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  clampMoney,
  openPeriod,
  uid,
  type Contribution,
  type Data,
  type Goal,
  type GoalKind,
  type LineItem,
  type Period,
  type Role,
} from "./finance";

type Store = {
  periods: Period[];
  goals: Goal[];
  theme: Data["theme"];
  introDismissed: boolean;
  intent: "apartar" | null;
  setTheme: (theme: Data["theme"]) => void;
  setIncome: (amount: number) => void;
  setItemAmount: (itemId: string, amount: number) => void;
  setItemRole: (itemId: string, role: Role) => void;
  renameItem: (itemId: string, name: string) => void;
  addItem: (categoryId: string, name: string, amount: number) => void;
  removeItem: (itemId: string) => void;
  addCategory: (name: string, role: Role) => string | null;
  renameCategory: (categoryId: string, name: string) => void;
  setCategoryRole: (categoryId: string, role: Role) => void;
  removeCategory: (categoryId: string) => void;
  savePlan: (setAside: number, contributions: Contribution[]) => void;
  addGoal: (input: { name: string; target: number; saved: number; kind: GoalKind }) => void;
  updateGoal: (id: string, patch: Partial<Goal>) => void;
  removeGoal: (id: string) => void;
  addToGoal: (id: string, amount: number) => void;
  closePeriod: () => void;
  openNext: () => void;
  dismissIntro: () => void;
  requestApartar: () => void;
  clearIntent: () => void;
  importFinance: (data: any) => void;
  reset: () => void;
};

function mapOpen(state: Store, updater: (period: Period) => Period): Partial<Store> {
  return {
    periods: state.periods.map((period) => (period.status === "open" ? updater(period) : period)).map(p => {
        if (p.status === "open" && (isNaN(new Date(p.start).getTime()) || isNaN(new Date(p.end).getTime()))) {
          const hoy = new Date();
          const inicio = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() > 15 ? 16 : 1);
          const fin = new Date(inicio); fin.setDate(inicio.getDate() + 14);
          return { ...p, start: inicio.toISOString(), end: fin.toISOString() };
        }
        return p;
      }),
  };
}

function withItems(period: Period, itemId: string, updater: (item: LineItem) => LineItem): Period {
  return {
    ...period,
    categories: period.categories.map((category) => ({
      ...category,
      items: category.items.map((item) => (item.id === itemId ? updater(item) : item)),
    })),
  };
}

const initialState: Pick<Store, "periods" | "goals" | "theme" | "introDismissed" | "intent"> = {
  periods: [] as Period[],
  goals: [] as Goal[],
  theme: "dark",
  introDismissed: false,
  intent: null,
};

export const useFinance = create<Store>()(
  persist(
    (set, get) => ({
      ...initialState,
      dismissIntro: () => set({ introDismissed: true }),
      setTheme: (theme) => set({ theme }),
      requestApartar: () => set({ intent: "apartar" }),
      clearIntent: () => set({ intent: null }),
      
      setIncome: (amount) =>
        set((state) => mapOpen(state, (period) => ({ ...period, income: clampMoney(amount) }))),
      
      setItemRole: (itemId, role) =>
        set((state) =>
          mapOpen(state, (period) => ({
            ...period,
            categories: period.categories.map((c) => ({
              ...c,
              items: c.items.map((item) =>
                item.id === itemId ? { ...item, roleOverride: role } : item
              ),
            })),
          }))
        ),

      setItemAmount: (itemId, amount) =>
        set((state) =>
          mapOpen(state, (period) =>
            withItems(period, itemId, (item) => {
              const value = clampMoney(amount);
              const grown = value > item.max ? Math.ceil((value * 1.25) / 100) * 100 : item.max;
              return { ...item, amount: value, max: Math.max(grown, value, 100) };
            })
          )
        ),

      renameItem: (itemId, name) =>
        set((state) =>
          mapOpen(state, (period) =>
            withItems(period, itemId, (item) => ({ ...item, name: name.trim().slice(0, 40) }))
          )
        ),

      addItem: (categoryId, name, amount) =>
        set((state) =>
          mapOpen(state, (period) => ({
            ...period,
            categories: period.categories.map((c) =>
              c.id === categoryId
                ? {
                    ...c,
                    items: [
                      ...c.items,
                      { id: uid("item"), name: name.trim(), amount: clampMoney(amount), max: Math.max(clampMoney(amount), 100) },
                    ],
                  }
                : c
            ),
          }))
        ),

      removeItem: (itemId) =>
        set((state) =>
          mapOpen(state, (period) => ({
            ...period,
            categories: period.categories.map((c) => ({
              ...c,
              items: c.items.filter((item) => item.id !== itemId),
            })),
          }))
        ),

      addCategory: (name, role) => {
        const trimmed = name.trim().slice(0, 30);
        if (!trimmed) return null;
        const id = uid("cat");
        set((state) =>
          mapOpen(state, (period) => ({
            ...period,
            categories: [...period.categories, { id, name: trimmed, role, tone: period.categories.length % 6, items: [] }],
          }))
        );
        return id;
      },

      renameCategory: (categoryId, name) =>
        set((state) =>
          mapOpen(state, (period) => ({
            ...period,
            categories: period.categories.map((c) => (c.id === categoryId ? { ...c, name: name.trim().slice(0, 30) } : c)),
          }))
        ),

      setCategoryRole: (categoryId, role) =>
        set((state) =>
          mapOpen(state, (period) => ({
            ...period,
            categories: period.categories.map((c) => (c.id === categoryId ? { ...c, role } : c)),
          }))
        ),

      removeCategory: (categoryId) =>
        set((state) =>
          mapOpen(state, (period) => ({
            ...period,
            categories: period.categories.filter((c) => c.id !== categoryId),
          }))
        ),

      savePlan: (setAside, contributions) =>
        set((state) => {
          const goals = state.goals.map((g) => {
            const contribution = contributions.find((c) => c.goalId === g.id);
            return contribution ? { ...g, saved: g.saved + contribution.amount } : g;
          });
          return {
            goals,
            ...mapOpen(state, (period) => ({ ...period, setAside })),
          };
        }),

      addGoal: (input) =>
        set((state) => ({
          goals: [...state.goals, { id: uid("goal"), name: input.name, target: input.target, saved: input.saved, kind: input.kind }],
        })),

      removeGoal: (id) =>
        set((state) => ({ goals: state.goals.filter((g) => g.id !== id) })),

      updateGoal: (id, patch) =>
        set((state) => ({
          goals: state.goals.map((g) => (g.id === id ? { ...g, ...patch } : g)),
        })),

      addToGoal: (id, amount) =>
        set((state) => ({
          goals: state.goals.map((g) => (g.id === id ? { ...g, saved: g.saved + amount } : g)),
        })),

      closePeriod: () => set((state) => ({ periods: state.periods.map((p) => (p.status === "open" ? { ...p, status: "closed" } : p)) })),

      openNext: () => {
        set((state) => {
          const hoy = new Date();
          // Calculamos el inicio de la quincena actual (día 1 o 16)
          const dia = hoy.getDate();
          const inicio = new Date(hoy.getFullYear(), hoy.getMonth(), dia > 15 ? 16 : 1);
          const fin = new Date(inicio);
          fin.setDate(inicio.getDate() + 14);

          const lastClosed = state.periods.find((p) => p.status === 'closed');
          const defaultCategories = lastClosed ? lastClosed.categories : [
            { id: uid('cat'), name: 'Gastos del hogar', role: 'need', tone: 0, items: [] },
            { id: uid('cat'), name: 'Transporte', role: 'need', tone: 1, items: [] },
            { id: uid('cat'), name: 'Internet', role: 'need', tone: 2, items: [] },
            { id: uid('cat'), name: 'Ahorro', role: 'life', tone: 3, items: [] }
          ];

          return {
            periods: [
              ...state.periods.filter(p => p.status !== 'open'), // Borramos la que está rota
              {
                id: uid('period'),
                start: inicio.toISOString(),
                end: fin.toISOString(),
                income: 0,
                categories: defaultCategories,
                status: 'open',
              }
            ]
          };
        });
      },

      importFinance: (data: any) => set({ periods: data.periods, goals: data.goals, theme: data.theme }),
      reset: () => set(initialState),
    }),
    { name: "finanzas-store" }
  )
);

export function sanitizeData(data: any): boolean {
  if (!data || typeof data !== "object" || Array.isArray(data)) return false;
  if (!Array.isArray(data.periods) || !Array.isArray(data.goals)) return false;
  if (data.theme !== "dark" && data.theme !== "light") return false;

  const validPeriods = data.periods.every((period: any) =>
    period &&
    typeof period.id === "string" &&
    typeof period.start === "string" &&
    typeof period.end === "string" &&
    Number.isFinite(Number(period.income)) &&
    Array.isArray(period.categories) &&
    period.categories.every((category: any) =>
      category &&
      typeof category.id === "string" &&
      Array.isArray(category.items) &&
      category.items.every((item: any) =>
        item &&
        typeof item.id === "string" &&
        typeof item.name === "string" &&
        Number.isFinite(Number(item.amount))
      )
    )
  );

  const validGoals = data.goals.every((goal: any) =>
    goal &&
    typeof goal.id === "string" &&
    typeof goal.name === "string" &&
    Number.isFinite(Number(goal.target)) &&
    Number.isFinite(Number(goal.saved))
  );

  return validPeriods && validGoals;
}

export function importFinance(data: any) {
  useFinance.setState({ 
    periods: data.periods, 
    goals: data.goals, 
    theme: data.theme 
  });
}
