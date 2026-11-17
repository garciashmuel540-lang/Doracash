import {
  categoryDueDate, categoryPaidAmount, categoryPendingAmount, estimatedBankBalance,
  managuaParts, nextQuincena, parseMoney, periodSurplus,
  type MoneyLocation, type Period,
} from "./finance.ts";

export type Movement = {
  id: string;
  kind: "expense" | "payment" | "transfer";
  name: string;
  date: string;
  amount: number;
  location: MoneyLocation;
  categoryId?: string;
  before?: number;
  after?: number;
};

export type Balances = Record<MoneyLocation, number>;
export type BalanceCheck = { date: string; counted: Balances; flow: Balances };
export type Reconciliation = { first: BalanceCheck; last: BalanceCheck; earlierComparisons?: BalanceCheck[] };

export function hasComparison(record: Reconciliation) {
  if (record.earlierComparisons !== undefined) return true;
  const { first, last } = record;
  return first.date !== last.date || first.counted.cash !== last.counted.cash ||
    first.counted.account !== last.counted.account || first.flow.cash !== last.flow.cash ||
    first.flow.account !== last.flow.account;
}
export const rounded = (n: number) => Math.round(n * 1000) / 1000;

export function todayInManagua() {
  const { year, month, day } = managuaParts();
  return [year, month, day].map(n => String(n).padStart(2, "0")).join("-");
}

export function validDate(s: unknown): s is string {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const timestamp = Date.parse(s);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === s;
}

export function parseExpense(text: string) {
  const match = /^(?:C\$\s*)?(\d+(?:[.,]\d{1,3})?)\s+(.+)$/i.exec(text.trim());
  if (!match || !match[2].trim() || match[2].length > 40) return null;
  const amount = parseMoney(match[1]);
  if (amount <= 0 || Number(match[1].replace(",", ".")) > 100_000_000) return null;
  return { amount, name: match[2].trim() };
}

function comparable(name: string) {
  return name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase().replace(/\s+/g, " ");
}

export function repeatedCharges(entries: Movement[], name: string, amount: number, date: string) {
  const key = comparable(name);
  return entries.filter(m => m.kind !== "transfer" && m.date === date && m.amount === amount && comparable(m.name) === key);
}

/** Identify both entries in each group, including matches entered through the rubro editor. */
export function duplicateIds(entries: Movement[]) {
  const first = new Map<string, string>();
  const ids = new Set<string>();
  for (const entry of entries) {
    if (entry.kind === "transfer" || entry.amount <= 0) continue;
    const key = JSON.stringify([entry.date, entry.amount, comparable(entry.name)]);
    const previous = first.get(key);
    if (previous) { ids.add(previous); ids.add(entry.id); }
    else first.set(key, entry.id);
  }
  return ids;
}

export function balanceFlow(period: Period): Balances {
  const flow = { account: period.income - (period.setAside || 0), cash: 0 };
  const byCategory = new Map<string, Movement[]>();
  for (const m of period.movements ?? []) {
    if (m.kind === "transfer") {
      flow[m.location] -= m.amount;
      flow[m.location === "cash" ? "account" : "cash"] += m.amount;
    } else if (m.categoryId) {
      const group = byCategory.get(m.categoryId);
      if (group) group.push(m);
      else byCategory.set(m.categoryId, [m]);
    }
  }
  for (const category of period.categories) {
    const currentLocation = category.moneyLocation === "cash" ? "cash" : "account";
    const paid = categoryPaidAmount(category);
    const entries = byCategory.get(category.id);
    if (!entries?.length) {
      flow[category.legacyPaidLocation ?? currentLocation] -= paid;
      continue;
    }
    // A change of location only affects future payments. A reduction reverses
    // the most recent installments first, even if several sources were used.
    const parts: { location: MoneyLocation; amount: number }[] = [];
    let total = 0;
    function settle(target: number, location: MoneyLocation) {
      let change = rounded(target - total);
      if (change > 0) parts.push({ location, amount: change });
      while (change < 0 && parts.length) {
        const last = parts[parts.length - 1];
        const removed = Math.min(-change, last.amount);
        last.amount = rounded(last.amount - removed);
        change = rounded(change + removed);
        if (!last.amount) parts.pop();
      }
      total = target;
    }
    settle(entries[0].before ?? 0, category.legacyPaidLocation ?? entries[0].location);
    for (const m of entries) {
      settle(m.before ?? 0, m.location);
      settle(m.after ?? m.amount, m.location);
    }
    settle(paid, currentLocation);
    for (const part of parts) flow[part.location] -= part.amount;
  }
  return { account: rounded(flow.account), cash: rounded(flow.cash) };
}

export function expectedBalances(first: BalanceCheck, flow: Balances): Balances {
  return {
    account: rounded(first.counted.account + flow.account - first.flow.account),
    cash: rounded(first.counted.cash + flow.cash - first.flow.cash),
  };
}

export function forecast(period: Period, today: string) {
  const payday = period.payday ?? nextQuincena(period.end).start;
  const due = period.categories.flatMap(category => {
    const amount = categoryPendingAmount(category);
    const date = category.carriedDueDate ?? categoryDueDate(period.start, category.dueDay);
    return amount > 0 && date && date <= payday ? [{ id: category.id, name: category.name, date, amount }] : [];
  }).sort((a, b) => a.date.localeCompare(b.date));
  const undated = rounded(period.categories.reduce((sum, c) =>
    sum + (!c.dueDay && !c.carriedDueDate ? categoryPendingAmount(c) : 0), 0));
  const days = Math.max(0, (Date.parse(payday) - Date.parse(today)) / 86400000);
  let balance = estimatedBankBalance(period);
  const rows = due.map(entry => ({ ...entry, balance: balance = rounded(balance - entry.amount) }));
  const daily = days > 0 ? Math.floor(Math.max(0, periodSurplus(period)) * 100 / days) / 100 : null;
  return { payday, days, daily, rows, undated };
}

function balances(value: unknown, signed: boolean): boolean {
  if (!value || typeof value !== "object") return false;
  const b = value as Balances;
  return Number.isFinite(b.account) && Number.isFinite(b.cash) && (signed || b.cash >= 0);
}

export function validDailyFields(p: Period) {
  if (p.payday !== undefined && !validDate(p.payday)) return false;
  const earlier = p.reconciliation?.earlierComparisons;
  if (earlier !== undefined && !Array.isArray(earlier)) return false;
  if (p.reconciliation !== undefined && ![p.reconciliation?.first, p.reconciliation?.last, ...(earlier ?? [])].every(
    c => c && validDate(c.date) && balances(c.counted, false) && balances(c.flow, true))) return false;
  if (p.movements === undefined) return true;
  return Array.isArray(p.movements) && p.movements.every(m => m && typeof m.id === "string" &&
    typeof m.name === "string" && validDate(m.date) && ["account", "cash"].includes(m.location) &&
    Number.isFinite(m.amount) && (m.kind === "transfer" ? m.amount > 0 :
      typeof m.categoryId === "string" && (m.kind === "expense" ? m.amount > 0 :
        m.kind === "payment" && Number.isFinite(m.before) && Number.isFinite(m.after))));
}
