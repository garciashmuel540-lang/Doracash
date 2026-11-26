import test from "node:test";
import assert from "node:assert/strict";
import { allPaymentsComplete, categoryPendingAmount, deferredPaymentsTotal, pendingMoneyLocations, periodExpenses, roleAmount, categoriesForNextPeriod, estimatedBankBalance, periodSurplus, type Period } from "./finance.ts";
import { balanceFlow, duplicateIds, expectedBalances, forecast, parseExpense, repeatedCharges, todayInManagua, validDailyFields } from "./daily.ts";
const records = new Map<string, string>();
Object.defineProperty(globalThis, "window", { configurable: true, value: {
  localStorage: {
    getItem: (key: string) => records.get(key) ?? null,
    setItem: (key: string, value: string) => records.set(key, value),
    removeItem: (key: string) => records.delete(key),
  },
} });
const { useFinance, sanitizeData } = await import("./store.ts");

const today = todayInManagua();
function start(): Period {
  const period: Period = { id: "test", start: today, end: today, income: 1000, status: "open", contributions: [], setAside: 0,
    categories: [{ id: "food", name: "Comida", role: "need", tone: 0, items: [{ id: "i", name: "Comida", amount: 200, max: 250 }] }] };
  useFinance.setState({ periods: [period] });
  return period;
}
const get = () => useFinance.getState();
const current = () => get().periods[0];
const input = { amount: 80, name: "Almuerzo", date: today, location: "cash" as const };

test("quick expense is paid once, reversible, nonrecurring and duplicate-aware", () => {
  start();
  assert.deepEqual(parseExpense("C$ 80,50 almuerzo"), { amount: 80.5, name: "almuerzo" });
  assert.equal(parseExpense("80"), null);
  const m = get().recordExpense("test", input, false);
  assert.equal(typeof m, "object");
  assert.equal(periodSurplus(current()), 720);
  assert.equal(estimatedBankBalance(current()), 920);
  assert.equal(get().recordExpense("test", { ...input, name: " ALMUÉRZO " }, false), "duplicate");
  assert.equal(typeof get().recordExpense("test", input, true), "object");
  assert.equal(repeatedCharges(current().movements!, "Almuerzo", 80, today).length, 2);
  assert.equal(duplicateIds(current().movements!).size, 2);
  assert.equal(categoriesForNextPeriod(current(), true).length, 1);
  assert.equal(allPaymentsComplete({ ...current(), categories: current().categories.slice(1) }), false);
  assert.ok(typeof m === "object" && get().undoMovement("test", m.id));
  assert.equal(estimatedBankBalance(current()), 920);
  assert.ok(typeof m === "object" && !get().undoMovement("test", m.id));
});

test("planned payment respects the budget, prevents overpayment and protects later edits during undo", () => {
  start();
  const m = get().recordExpense("test", { ...input, categoryId: "food", location: "account" }, false);
  assert.equal(typeof m, "object");
  assert.equal(periodSurplus(current()), 920);
  assert.equal(estimatedBankBalance(current()), 920);
  assert.equal(categoryPendingAmount(current().categories[0]), 120);
  assert.equal(get().recordExpense("test", { ...input, amount: 140, categoryId: "food", location: "account" }, true), "invalid");
  const undo2 = get().setCategoryPayment("food", "full");
  assert.ok(typeof m === "object" && !get().undoMovement("test", m.id));
  assert.ok(undo2?.());
  assert.ok(typeof m === "object" && get().undoMovement("test", m.id));
  assert.equal(categoryPendingAmount(current().categories[0]), 200);
});

test("reconciliation keeps a stable baseline, respects transfers and preserves discrepancies after reload", async () => {
  start();
  assert.ok(get().checkBalances("test", { account: 900, cash: 150 }));
  get().recordExpense("test", input, false);
  const transfer = get().recordTransfer("test", "account", 200)!;
  const baseline = current().reconciliation!.first;
  assert.deepEqual(expectedBalances(baseline, balanceFlow(current())), { account: 700, cash: 270 });
  assert.equal(periodSurplus(current()), 720);
  get().checkBalances("test", { account: 700, cash: 260 });
  const backup = JSON.parse(JSON.stringify({ periods: [current()], goals: [], theme: "dark" }));
  assert.equal(sanitizeData(backup), true);
  get().importFinance(backup);
  await useFinance.persist.rehydrate();
  assert.equal(current().reconciliation!.last.counted.cash, 260);
  assert.equal(expectedBalances(current().reconciliation!.first, balanceFlow(current())).cash, 270);
  assert.ok(get().undoMovement("test", transfer.id));
  assert.equal(expectedBalances(baseline, balanceFlow(current())).cash, 70);
  assert.equal(validDailyFields({ ...current(), payday: "2026-02-31" }), false);
});

test("calendar includes overdue, partial and same-day dues; excludes paid and later charges", () => {
  const p = start();
  p.start = "2026-11-16"; p.end = "2026-11-30"; p.payday = "2026-12-01";
  const c = p.categories[0];
  p.categories = [
    { ...c, dueDay: 20, paidAmount: 50 },
    { ...c, id: "over", carriedDueDate: "2026-11-10" },
    { ...c, id: "onpay", dueDay: 1 },
    { ...c, id: "later", dueDay: 3 },
    { ...c, id: "paid", dueDay: 18, paid: true },
    { ...c, id: "undated" },
  ];
  const f = forecast(p, "2026-11-18");
  assert.deepEqual(f.rows.map(r => r.id), ["over", "food", "onpay"]);
  assert.deepEqual(f.rows.map(r => r.balance), [550, 400, 200]);
  assert.equal(f.undated, 200);
  assert.equal(f.days, 13);
  assert.equal(f.daily, 0);
});

test("changing a rubro's source keeps previous payments in their original location", () => {
  start();
  get().setCategoryPayment("food", 50);
  get().setCategoryMoneyLocation("food", "cash");
  get().setCategoryPayment("food", 120);
  assert.deepEqual(balanceFlow(current()), { account: 950, cash: -70 });
  const undo = get().setCategoryPayment("food", 20);
  assert.deepEqual(balanceFlow(current()), { account: 980, cash: 0 });
  assert.ok(undo?.());
  assert.deepEqual(balanceFlow(current()), { account: 950, cash: -70 });
});

test("saved counts can be corrected and deleted after exiting, preserving the original flow and expenses", async () => {
  start();
  get().checkBalances("test", { cash: 300, account: 500 });
  get().recordExpense("test", input, false);
  get().checkBalances("test", { cash: 200, account: 500 });
  get().checkBalances("test", { cash: 201, account: 500 });
  await useFinance.persist.rehydrate();
  get().checkBalances("test", { cash: 310, account: 500 }, "first");
  assert.equal(expectedBalances(current().reconciliation!.first, balanceFlow(current())).cash, 230);
  get().checkBalances("test", { cash: 230, account: 500 }, "last");
  assert.equal(current().reconciliation!.last.counted.cash, 230);
  assert.ok(get().removeLastCheck("test"));
  assert.equal(current().reconciliation!.last.counted.cash, 200);
  assert.ok(get().removeLastCheck("test"));
  assert.equal(current().reconciliation!.last.counted.cash, 310);
  assert.ok(get().removeLastCheck("test"));
  assert.equal(current().reconciliation, undefined);
  assert.equal(current().movements?.length, 1);
  assert.equal(estimatedBankBalance(current()), 920);
});

test("los abonos separan el agregado pendiente, conservan rubros sin abono y trasladan solo el resto", () => {
  const p = start();
  const rubro = p.categories[0];
  const card = { ...rubro, id: "tc", paidAmount: 734, items: [{ ...rubro.items[0], amount: 1306.24 }] };
  const mixed = { ...rubro, id: "mixto", paidAmount: 75, items: [
    { ...rubro.items[0], amount: 50, roleOverride: "life" as const },
    { ...rubro.items[0], id: "deuda", amount: 125 },
  ] };
  const period = { ...p, categories: [card, mixed, rubro] };
  assert.equal(deferredPaymentsTotal(period), 672.24);
  assert.equal(periodExpenses(period), 959);
  assert.equal(roleAmount(period, "life"), 50);
  assert.equal(periodSurplus(period), -9);
  assert.deepEqual(pendingMoneyLocations(period), { account: 200, cash: 0 });
  const next = { ...p, categories: categoriesForNextPeriod(period, false) };
  assert.equal(periodExpenses(next), 872.24);
  assert.equal(deferredPaymentsTotal(next), 0);
  useFinance.setState({ periods: [period] });
  const undo = get().setCategoryPayment("tc", "full");
  assert.equal(deferredPaymentsTotal(current()), 100);
  assert.ok(undo?.());
  assert.equal(deferredPaymentsTotal(current()), 672.24);
  get().setCategoryPayment("tc", 0);
  assert.equal(deferredPaymentsTotal(current()), 100);
  assert.equal(periodExpenses(current()), 1531.24);
});
