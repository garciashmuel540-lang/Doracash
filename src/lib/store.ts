import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  clampMoney,
  categoryTotal,
  estimatedBankBalance,
  categoryPaidAmount,
  categoryPendingAmount,
  categoriesForNextPeriod,
  allPaymentsComplete,
  nextQuincena,
  previousClosed,
  currentQuincena,
  periodSurplus,
  type Category,
  openPeriod,
  uid,
  unlinkedSavings,
  type Contribution,
  type Data,
  type Goal,
  type GoalKind,
  type LineItem,
  type MoneyLocation,
  type Period,
  type Role,
} from "./finance.ts";
import { balanceFlow, hasComparison, repeatedCharges, rounded, todayInManagua, validDailyFields, validDate, type Balances, type Movement } from "./daily.ts";

type Undo = () => boolean;

type ExpenseInput = { name: string; amount: number; date: string; location: MoneyLocation; categoryId?: string };
type Store = {
  recordExpense: (periodId: string, entry: ExpenseInput, allowDuplicate: boolean) => "duplicate" | "invalid" | Movement;
  setSundayPlan: (periodId: string, plan: NonNullable<Period["sundays"]>) => void;
  restoreMovement: (periodId: string, id: string) => boolean;
  undoMovement: (periodId: string, id: string) => boolean;
  recordTransfer: (periodId: string, from: MoneyLocation, amount: number) => Movement | null;
  checkBalances: (periodId: string, counted: Balances, edit?: "first" | "last") => boolean;
  removeLastCheck: (periodId: string) => boolean;
  setPayday: (periodId: string, date: string) => boolean;
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
  setCategoryNote: (categoryId: string, note: string) => void;
  setCategoryRole: (categoryId: string, role: Role) => void;
  setCategoryMoneyLocation: (categoryId: string, moneyLocation: MoneyLocation) => void;
  setCategoryPayment: (categoryId: string, payment: number | "full") => Undo | null;
  setCategorySchedule: (categoryId: string, schedule: Pick<Category, "dueDay" | "recurring">) => void;
  removeCategory: (categoryId: string) => void;
  savePlan: (setAside: number, contributions: Contribution[]) => void;
  addGoal: (input: { name: string; target: number; saved: number; kind: GoalKind }) => void;
  updateGoal: (id: string, patch: Partial<Goal>) => void;
  removeGoal: (id: string) => void;
  addToGoal: (id: string, amount: number) => void;
  transferToSavings: (name: string, amount: number) => Undo | null;
  recoverUnlinkedSavings: (amount: number) => boolean;
  closePeriod: () => void;
  openNext: (copyRecurring?: boolean, archiveOpen?: boolean, completedPeriodId?: string, carry?: number) => void;
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

function returnContribution(period: Period, goalId: string, decrease: number): Period {
  const contributions = period.contributions ?? [];
  const linked = contributions.find((entry) => entry.goalId === goalId);
  if (!linked || decrease <= 0) return period;
  const returned = Math.min(decrease, linked.amount, period.setAside || 0);
  const remaining = clampMoney(linked.amount - returned);
  return {
    ...period,
    setAside: clampMoney(period.setAside - returned),
    contributions: contributions.flatMap((entry) =>
      entry.goalId !== goalId ? [entry] : remaining > 0 ? [{ ...entry, amount: remaining }] : [],
    ),
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

      setCategoryNote: (categoryId, note) =>
        set((state) => mapOpen(state, (period) => ({
          ...period,
          categories: period.categories.map(category =>
            category.id === categoryId ? { ...category, note: note || undefined } : category),
        }))),

      setCategoryRole: (categoryId, role) =>
        set((state) =>
          mapOpen(state, (period) => ({
            ...period,
            categories: period.categories.map((c) => (c.id === categoryId ? { ...c, role } : c)),
          }))
        ),

      setCategoryMoneyLocation: (categoryId, moneyLocation) =>
        set((state) =>
          mapOpen(state, (period) => ({
            ...period,
            categories: period.categories.map((category) =>
              category.id === categoryId ? { ...category, moneyLocation,
                legacyPaidLocation: category.legacyPaidLocation ?? (categoryPaidAmount(category) > 0 ? category.moneyLocation ?? "account" : undefined),
              } : category
            ),
          }))
        ),

      recordExpense: (periodId, input, allowDuplicate) => {
        const state = get();
        const period = openPeriod(state);
        const amount = clampMoney(input.amount);
        const name = input.name.trim();
        if (period?.id !== periodId || !name || name.length > 40 || amount <= 0 || !validDate(input.date) ||
            input.date < period.start.slice(0, 10) || input.date > period.end.slice(0, 10) || input.date > todayInManagua()) return "invalid";
        const movements = period.movements ?? [];
        if (!allowDuplicate && repeatedCharges(movements, name, amount, input.date).length) return "duplicate";
        const target = input.categoryId ? period.categories.find(c => c.id === input.categoryId) : undefined;
        if (input.categoryId && (!target || amount > categoryPendingAmount(target) || input.location !== (target.moneyLocation ?? "account"))) return "invalid";
        const categoryId = target?.id ?? uid("cat");
        const before = target ? categoryPaidAmount(target) : 0;
        const after = rounded(before + amount);
        const movement: Movement = { id: uid("mov"), name, amount, date: input.date, location: input.location,
          kind: target ? "payment" : "expense", categoryId, before, after };
        const categories: Category[] = target
          ? period.categories.map(c => c.id === categoryId ? { ...c, paidAmount: after, paid: after >= categoryTotal(c) } : c)
          : [...period.categories, { id: categoryId, name, role: "need", tone: 0, moneyLocation: input.location,
              recurring: false, paid: true, paidAmount: amount, items: [{ id: uid("item"), name, amount, max: Math.max(100, amount) }] }];
        set(mapOpen(state, p => ({ ...p, movements: [...movements, movement], categories })));
        return movement;
      },

      recordTransfer: (periodId, from, amount) => {
        const state = get();
        const period = openPeriod(state);
        if (period?.id !== periodId || clampMoney(amount) <= 0) return null;
        const movement: Movement = { id: uid("mov"), kind: "transfer", date: todayInManagua(),
          name: from === "account" ? "Retiro de efectivo" : "Depósito a cuenta", location: from, amount: clampMoney(amount) };
        set(mapOpen(state, p => ({ ...p, movements: [...(p.movements ?? []), movement] })));
        return movement;
      },

      checkBalances: (periodId, counted, edit) => {
        const state = get();
        const period = openPeriod(state);
        if (period?.id !== periodId || !Number.isFinite(counted.account) || !Number.isFinite(counted.cash) || counted.cash < 0) return false;
        const record = period.reconciliation;
        if (edit) {
          if (!record) return false;
          const corrected = { ...record[edit], counted: { ...counted } };
          const updated = hasComparison(record)
            ? { ...record, earlierComparisons: record.earlierComparisons ?? [], [edit]: corrected }
            : { first: corrected, last: corrected };
          set(mapOpen(state, p => ({ ...p, reconciliation: updated })));
        } else {
          const check = { date: todayInManagua(), counted: { ...counted }, flow: balanceFlow(period) };
          const updated = record ? { first: record.first, last: check, earlierComparisons: hasComparison(record)
            ? [...(record.earlierComparisons ?? []), record.last] : [] } : { first: check, last: check };
          set(mapOpen(state, p => ({ ...p, reconciliation: updated })));
        }
        return true;
      },

      removeLastCheck: (periodId) => {
        const state = get();
        const period = openPeriod(state);
        const record = period?.reconciliation;
        if (period?.id !== periodId || !record) return false;
        const earlier = record.earlierComparisons ?? [];
        const last = earlier.at(-1);
        const reconciliation = last ? { first: record.first, last, earlierComparisons: earlier.slice(0, -1) }
          : hasComparison(record) ? { first: record.first, last: record.first } : undefined;
        set(mapOpen(state, p => ({ ...p, reconciliation })));
        return true;
      },

      setPayday: (periodId, payday) => {
        const state = get();
        if (openPeriod(state)?.id !== periodId || !validDate(payday)) return false;
        set(mapOpen(state, p => ({ ...p, payday })));
        return true;
      },

      setSundayPlan: (periodId, plan) => set(state => {
        if (openPeriod(state)?.id !== periodId) return state;
        return mapOpen(state, p => ({ ...p, sundays: { fare: clampMoney(plan.fare), food: clampMoney(plan.food),
          excluded: [...new Set(plan.excluded.filter(validDate))] } }));
      }),

      restoreMovement: (periodId, id) => {
        const state = get();
        const p = openPeriod(state);
        const entry = p?.trash?.find(t => t.movement.id === id);
        if (!p || p.id !== periodId || !entry) return false;
        const m = entry.movement;
        const movements = p.movements ?? [];
        if (movements.some(other => other.id === id)) return false;
        let categories = p.categories;
        const category = categories.find(c => c.id === m.categoryId);
        if (m.kind === "expense") {
          if (category || !entry.expenseCategory) return false;
          categories = [...categories, entry.expenseCategory];
        } else if (m.kind === "payment") {
          const last = movements.filter(other => other.categoryId === m.categoryId).at(-1);
          if (!category || last?.id !== entry.previousPaymentId || categoryPaidAmount(category) !== m.before ||
              m.after === undefined || m.after < 0 || m.after > categoryTotal(category)) return false;
          categories = categories.map(c => c !== category ? c : { ...c, paidAmount: m.after, paid: m.after === categoryTotal(c) });
        }
        set(mapOpen(state, period => ({ ...period, categories, movements: [...movements, m],
          trash: period.trash?.filter(t => t.movement.id !== id) })));
        return true;
      },

      undoMovement: (periodId, id) => {
        const state = get();
        const period = openPeriod(state);
        if (period?.id !== periodId) return false;
        const movements = period.movements ?? [];
        const index = movements.findIndex(m => m.id === id);
        if (index < 0) return false;
        const m = movements[index];
        let categories = period.categories;
        if (m.kind !== "transfer") {
          const category = categories.find(c => c.id === m.categoryId);
          if (!category || categoryPaidAmount(category) !== m.after ||
              movements.slice(index + 1).some(later => later.categoryId === category.id)) return false;
          if (m.kind === "expense") categories = categories.filter(c => c !== category);
          else {
            const previous = m.before ?? 0;
            if (previous > categoryTotal(category)) return false;
            categories = categories.map(c => c !== category ? c : { ...c, paidAmount: previous, paid: previous > 0 && previous === categoryTotal(c) });
          }
        }
        const category = period.categories.find(c => c.id === m.categoryId);
        const entry = { movement: m, expenseCategory: m.kind === "expense" ? category : undefined,
          previousPaymentId: movements.slice(0, index).filter(other => other.categoryId === m.categoryId).at(-1)?.id,
          note: category?.note };
        set(mapOpen(state, p => ({ ...p, categories, movements: movements.filter(other => other.id !== id),
          trash: [...(p.trash ?? []), entry] })));
        return true;
      },

      setCategoryPayment: (categoryId, payment) => {
        const state = get();
        const period = openPeriod(state);
        const category = period?.categories.find(c => c.id === categoryId);
        if (!period || !category) return null;
        const total = categoryTotal(category);
        const before = categoryPaidAmount(category);
        const after = payment === "full" ? total : Math.min(total, clampMoney(payment));
        if (before === after) return null;
        const m: Movement = { id: uid("mov"), kind: "payment", date: todayInManagua(), name: category.name,
          categoryId, before, after, amount: rounded(after - before), location: category.moneyLocation ?? "account" };
        set(mapOpen(state, p => ({ ...p, movements: [...(p.movements ?? []), m],
          categories: p.categories.map(c => c === category ? { ...c, paidAmount: after, paid: total > 0 && after === total } : c) })));
        return () => get().undoMovement(period.id, m.id);
      },

      setCategorySchedule: (categoryId, schedule) =>
        set((state) => mapOpen(state, (period) => ({
          ...period,
          categories: period.categories.map((entry) => entry.id === categoryId ? { ...entry, ...schedule, carriedDueDate: "dueDay" in schedule ? undefined : entry.carriedDueDate } : entry),
        }))),

      removeCategory: (categoryId) =>
        set((state) =>
          mapOpen(state, (period) => ({
            ...period,
            categories: period.categories.filter((c) => c.id !== categoryId),
            movements: period.movements?.filter(m => m.categoryId !== categoryId),
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
        set((state) => ({
          goals: state.goals.filter((g) => g.id !== id),
          ...mapOpen(state, (period) => returnContribution(period, id, Infinity)),
        })),

      updateGoal: (id, patch) =>
        set((state) => ({
          goals: state.goals.map((g) => (g.id === id ? { ...g, ...patch } : g)),
          ...(patch.saved === undefined ? {} : mapOpen(state, (period) =>
            returnContribution(period, id, clampMoney(
              (state.goals.find((goal) => goal.id === id)?.saved ?? 0) - (patch.saved ?? 0),
            )),
          )),
        })),

      addToGoal: (id, amount) =>
        set((state) => ({
          goals: state.goals.map((g) => (g.id === id ? { ...g, saved: g.saved + amount } : g)),
        })),

      transferToSavings: (name, amount) => {
        const state = get();
        const period = openPeriod(state);
        const value = clampMoney(amount);
        if (!period || value <= 0 || value > periodSurplus(period)) return null;
        const existing = state.goals.find((goal) => goal.name === name);
        const goalId = existing?.id ?? uid("goal");
        const contributions = period.contributions ?? [];
        const linked = contributions.find((entry) => entry.goalId === goalId);
        set({
          goals: existing
            ? state.goals.map((goal) => goal.id === goalId ? { ...goal, saved: clampMoney(goal.saved + value) } : goal)
            : [...state.goals, { id: goalId, name, target: 999999, saved: value, kind: "custom" }],
          periods: state.periods.map((entry) => entry.id === period.id ? {
            ...entry,
            setAside: clampMoney((entry.setAside || 0) + value),
            contributions: linked
              ? contributions.map((item) => item === linked ? { ...item, amount: clampMoney(item.amount + value) } : item)
              : [...contributions, { goalId, amount: value }],
          } : entry),
        });
        const savedGoal = get().goals.find((goal) => goal.id === goalId);
        const savedLink = openPeriod(get())?.contributions?.find((entry) => entry.goalId === goalId);
        return () => {
          const current = get();
          const active = openPeriod(current);
          if (!savedGoal || !savedLink || active?.id !== period.id ||
              current.goals.find((goal) => goal.id === goalId) !== savedGoal ||
              active.contributions.find((entry) => entry.goalId === goalId) !== savedLink) return false;
          set({
            periods: current.periods.map((entry) => entry.id === active.id
              ? returnContribution(entry, goalId, value) : entry),
            goals: current.goals.flatMap((goal) =>
              goal.id !== goalId ? [goal] : existing ? [existing] : []),
          });
          return true;
        };
      },

      recoverUnlinkedSavings: (amount) => {
        const state = get();
        const period = openPeriod(state);
        const value = clampMoney(amount);
        if (!period || value <= 0 || value > unlinkedSavings(period)) return false;
        set({
          periods: state.periods.map((entry) => entry.id === period.id
            ? { ...entry, setAside: clampMoney(entry.setAside - value) }
            : entry),
        });
        return true;
      },

      closePeriod: () => set((state) => ({ periods: state.periods.map((p) => (p.status === "open" ? { ...p, status: "closed" } : p)) })),

      openNext: (copyRecurring = true, archiveOpen = false, completedPeriodId, carry = 0) => {
        set((state) => {
          const active = openPeriod(state);
          if (active && !archiveOpen) return state;
          if (completedPeriodId && (!active || active.id !== completedPeriodId || !allPaymentsComplete(active))) return state;
          if (!Number.isFinite(carry) || carry < 0 || carry > (active ? Math.max(0, estimatedBankBalance(active)) : 0)) return state;
          const current = currentQuincena();
          const lastClosed = active ?? previousClosed(state.periods);
          const periods = state.periods.map((period) => period.id === active?.id
            ? { ...period, status: "closed" as const, carriedOut: carry, closedAt: new Date().toISOString() }
            : period);
          const range = lastClosed && current.start <= lastClosed.end ? nextQuincena(lastClosed.end) : current;
          const defaultCategories: Category[] = lastClosed
            ? categoriesForNextPeriod(lastClosed, copyRecurring)
            : [
            { id: uid('cat'), name: 'Gastos del hogar', role: 'need', tone: 0, items: [] },
            { id: uid('cat'), name: 'Transporte', role: 'need', tone: 1, items: [] },
            { id: uid('cat'), name: 'Internet', role: 'need', tone: 2, items: [] },
            { id: uid('cat'), name: 'Ahorro', role: 'life', tone: 3, items: [] }
          ];

          return {
            periods: [
              ...periods,
              {
                id: uid('period'),
                start: range.start,
                end: range.end,
                income: 0,
                openingBalance: carry,
                sundays: lastClosed?.sundays ? { ...lastClosed.sundays, excluded: [] } : undefined,
                categories: defaultCategories,
                status: 'open',
                setAside: 0,
                contributions: [],
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
    validDailyFields(period) &&
    Array.isArray(period.categories) &&
    period.categories.every((category: any) =>
      category &&
      typeof category.id === "string" &&
      (category.note === undefined || typeof category.note === "string") &&
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
