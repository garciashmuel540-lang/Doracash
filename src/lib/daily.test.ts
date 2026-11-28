import test from "node:test";
import assert from "node:assert/strict";
import { currentSundayReserve, allPaymentsComplete, categoryPendingAmount, deferredPaymentsTotal, pendingMoneyLocations, periodExpenses, roleAmount, categoriesForNextPeriod, estimatedBankBalance, periodSurplus, type Period } from "./finance.ts";
import { balanceFlow, currentBalances, depositToReview, duplicateIds, expectedBalances, forecast, parseExpense, repeatedCharges, todayInManagua, validDailyFields } from "./daily.ts";
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

test("retiro y depósito mueven exactamente el monto disponible entre saldos y conservan el total", async () => {
  const p = { ...start(), income: 6337.93 };
  useFinance.setState({ periods: [p] });
  const initial = { cash: 0, account: 6337.93 };
  assert.deepEqual(currentBalances(current()), initial);
  get().checkBalances(p.id, initial);
  const free = periodSurplus(current());
  assert.equal(get().recordTransfer(p.id, "cash", 1915), null);
  assert.equal(get().recordTransfer(p.id, "account", 6400), null);
  assert.ok(get().recordTransfer(p.id, "account", 1915));
  assert.deepEqual(currentBalances(current()), { cash: 1915, account: 4422.93 });
  assert.ok(get().recordTransfer(p.id, "cash", 15.75));
  assert.deepEqual(currentBalances(current()), { cash: 1899.25, account: 4438.68 });
  assert.ok(get().recordTransfer(p.id, "cash", 1899.25));
  await useFinance.persist.rehydrate();
  assert.deepEqual(currentBalances(current()), initial);
  assert.equal(periodSurplus(current()), free);
  assert.equal(current().movements?.length, 3);
});

test("un depósito anterior en sentido equivocado se puede deshacer sin cambiar el conteo", () => {
  const p = { ...start(), income: 6337.93 };
  useFinance.setState({ periods: [p] });
  get().checkBalances(p.id, { cash: 0, account: 6337.93 });
  const record = current().reconciliation;
  useFinance.setState({ periods: [{ ...current(), movements: [{ id: "original", kind: "transfer",
    name: "Depósito a cuenta", date: today, location: "cash", amount: 1915 }] }] });
  assert.deepEqual(currentBalances(current()), { cash: -1915, account: 8252.93 });
  assert.ok(get().undoMovement(p.id, "original"));
  assert.ok(get().recordTransfer(p.id, "account", 1915));
  assert.deepEqual(currentBalances(current()), { cash: 1915, account: 4422.93 });
  assert.deepEqual(current().reconciliation, record);
});

test("corregir el depósito heredado a retiro conserva el total, el historial y el primer conteo", async () => {
  const p = { ...start(), income: 6337.93 };
  const first = { date: "2026-11-27", counted: { cash: 0, account: 6337.93 }, flow: balanceFlow(p) };
  const deposit = { id: "dep", kind: "transfer" as const, date: "2026-11-28", location: "cash" as const, amount: 1915, name: "Depósito a cuenta" };
  useFinance.setState({ periods: [{ ...p, reconciliation: { first, last: first }, movements: [deposit] }] });
  const review = depositToReview(current())!;
  assert.deepEqual(review.corrected, { cash: 1915, account: 4422.93 });
  assert.equal(depositToReview({ ...current(), reconciliation: { first, last: { ...first, date: deposit.date } } }), null);
  assert.equal(get().correctDepositToWithdrawal(p.id, deposit), true);
  assert.equal(get().correctDepositToWithdrawal(p.id, deposit), false);
  await useFinance.persist.rehydrate();
  assert.deepEqual(currentBalances(current()), review.corrected);
  assert.deepEqual(current().movements, [{ ...deposit, location: "account", name: "Retiro de efectivo" }]);
  assert.deepEqual(current().reconciliation, { first, last: first });
  assert.equal(depositToReview(current()), null);
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
  assert.deepEqual(f.rows.map(r => r.id), ["over", "food"]);
  assert.deepEqual(f.rows.map(r => r.balance), [550, 400]);
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

test("daily spending covers the whole quincena, respects skipped classes and ignores a saved payday", () => {
  const p = { ...start(), start: "2026-11-16", end: "2026-11-30", payday: "2026-11-30",
    sundays: { fare: 60, food: 40, excluded: [] as string[] } };
  let f = forecast(p, "2026-11-24");
  assert.equal(f.sundays.remaining, 1);
  assert.equal(f.available, 700);
  assert.equal(f.daily, 100);
  p.sundays.excluded = ["2026-11-29", "2026-11-29"];
  f = forecast(p, "2026-11-24");
  assert.equal(f.daily, 114.28);
  assert.equal(f.sundays.remaining, 0);
  assert.equal(forecast({ ...p, payday: "2026-11-29" }, "2026-11-29").days, 2);
  assert.equal(forecast(p, "2026-12-01").daily, null);
  assert.equal(forecast({ ...p, sundays: undefined, payday: "2026-11-29" }, "2026-11-24").sundays.remaining, 1);
  assert.equal(forecast(p, "2026-11-10").days, 15);
});

test("restoring expenses, transfers and partial payments preserves money, identity and notes", async () => {
  start();
  const m = get().recordExpense("test", input, false);
  assert.ok(typeof m === "object");
  get().setCategoryNote(m.categoryId!, "Retirar en el banco");
  const balance = balanceFlow(current());
  assert.ok(get().undoMovement("test", m.id));
  assert.ok(validDailyFields(current()));
  await useFinance.persist.rehydrate();
  assert.ok(get().restoreMovement("test", m.id));
  assert.equal(current().categories.at(-1)?.note, "Retirar en el banco");
  assert.deepEqual(current().movements?.at(-1), m);
  assert.deepEqual(balanceFlow(current()), balance);
  assert.ok(!get().restoreMovement("test", m.id));
  const transfer = get().recordTransfer("test", "account", 100)!;
  const transferred = balanceFlow(current());
  assert.ok(get().undoMovement("test", transfer.id));
  assert.ok(get().restoreMovement("test", transfer.id));
  assert.deepEqual(balanceFlow(current()), transferred);
  get().setCategoryPayment("food", 50);
  get().setCategoryPayment("food", 100);
  const [first, second] = current().movements!.slice(-2);
  assert.ok(get().undoMovement("test", second.id));
  assert.ok(get().undoMovement("test", first.id));
  assert.equal(get().restoreMovement("test", second.id), false);
  assert.ok(get().restoreMovement("test", first.id));
  assert.ok(get().restoreMovement("test", second.id));
  assert.equal(categoryPendingAmount(current().categories[0]), 100);
});

test("closing carries the selected balance once, separately from income and outstanding bills", () => {
  start();
  get().setSundayPlan("test", { fare: 50, food: 30, excluded: [today] });
  get().setCategoryPayment("food", 80);
  get().openNext(false, true, undefined, 921);
  assert.equal(get().periods.length, 1);
  get().openNext(false, true, undefined, 400);
  const [closed, next] = get().periods;
  assert.equal(closed.carriedOut, 400);
  assert.equal(next.openingBalance, 400);
  assert.equal(next.income, 0);
  assert.equal(periodSurplus(next), 280 - currentSundayReserve(next));
  assert.deepEqual(next.sundays, { fare: 50, food: 30, excluded: [] });
  assert.ok(get().savePaycheck(next.id, 600, today));
  assert.equal(periodSurplus(get().periods[1]), 880 - currentSundayReserve(next));
  assert.equal(estimatedBankBalance(get().periods[1]), 1000);
});

test("el pago recibido liquida los gastos de la misma quincena y las correcciones reemplazan su monto", async () => {
  const p = start();
  useFinance.setState({ periods: [{ ...p, income: 0, payday: "2099-12-31" }] });
  const expense = get().recordExpense(p.id, input, false);
  assert.ok(typeof expense === "object");
  assert.equal(get().savePaycheck(p.id, 1000, "2099-12-31"), false);
  assert.equal(get().savePaycheck(p.id, 1000, today), true);
  assert.equal(current().incomeReceivedOn, today);
  assert.equal(forecast(current(), today).dueThrough, p.end);
  assert.equal(periodSurplus(current()), 720);
  assert.equal(get().savePaycheck(p.id, 900, today), true);
  await useFinance.persist.rehydrate();
  assert.equal(periodSurplus(current()), 620);
  assert.equal(current().movements?.length, 1);
  assert.equal(current().incomeReceivedOn, today);
});

test("un pago anterior cuenta como recibido sin atribuirle una fecha prevista", () => {
  const p = start();
  useFinance.setState({ periods: [{ ...p, income: 6337.93, payday: "2026-11-30" }] });
  assert.equal(current().incomeReceivedOn, undefined);
  assert.equal(get().savePaycheck(p.id, 6337.93), true);
  assert.equal(periodSurplus(current()), 6137.93);
  assert.ok(validDailyFields(current()));
  assert.equal(validDailyFields({ ...current(), incomeReceivedOn: "2026-02-31" }), false);
});

test("editar un gasto rápido actualiza el rubro, el saldo y su importe recuperable", () => {
  start();
  const m = get().recordExpense("test", input, false);
  assert.ok(typeof m === "object");
  const edit = { name: "Pasaje", date: today, amount: 45 };
  assert.equal(get().editMovement("test", m, edit), null);
  assert.equal(periodSurplus(current()), 755);
  assert.equal(get().editMovement("test", m, edit) !== null, true);
  assert.ok(get().undoMovement("test", m.id));
  assert.ok(get().restoreMovement("test", m.id));
  assert.equal(current().movements?.at(-1)?.amount, 45);
  assert.equal(categoryPendingAmount(current().categories.at(-1)!), 0);
});

test("editar un abono anterior conserva los importes posteriores y rechaza sobrepagos", () => {
  start();
  get().setCategoryPayment("food", 50);
  get().setCategoryPayment("food", 120);
  const original = current().movements![0];
  const edit = { name: "Primer abono", date: today, amount: 80 };
  assert.equal(get().editMovement("test", original, { ...edit, amount: 150 }) !== null, true);
  assert.equal(categoryPendingAmount(current().categories[0]), 80);
  assert.equal(get().editMovement("test", original, edit), null);
  const second = current().movements![1];
  assert.deepEqual([second.amount, second.before, second.after], [70, 80, 150]);
  assert.equal(categoryPendingAmount(current().categories[0]), 50);
  assert.ok(get().undoMovement("test", second.id));
  assert.equal(categoryPendingAmount(current().categories[0]), 120);
});
