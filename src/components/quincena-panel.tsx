import * as RadioGroup from "@radix-ui/react-radio-group";
import { useEffect, useState } from "react";
import { ArrowUpRight, ChevronDown, Pencil, Plus, PiggyBank, Trash2, Wallet, X } from "lucide-react";
import { feedbackToast as toast } from "@/lib/feedback-toast";
import { MoneyAmount, Button, Modal, MoneyField } from "@/components/ui";
import { Link } from "@tanstack/react-router";
import { PageHeader, useShell } from "@/components/shell";
import { playFeedback } from "@/lib/feedback";
import { cn } from "@/lib/cn";
import { comparable, repeatedCharges, todayInManagua } from "@/lib/daily";
import { ExportRubros } from "./export-rubros";
import { Paycheck } from "./paycheck";
import { SpendingPlanner } from "./spending-planner";
import { DailyTools } from "./daily-tools";
import { ItemRow } from "@/components/item-row";
import {
  type Period,
  categoryTotal,
  deferredPaymentsTotal,
  allPaymentsComplete,
  categoryPendingAmount,
  categoryPaidAmount,
  categoryDueDate,
  paidRubrosTotal,
  daysUntil,
  estimatedBankBalance,
  formatMoney,
  formatRange,
  periodExpenses,
  periodFunds,
  pendingMoneyLocations,
  periodSurplus,
  savingsRate,
} from "@/lib/finance";
import { useFinance } from "@/lib/store";

export function QuincenaPanel() {
  const { openRecovery } = useShell();
  const periods = useFinance((state) => state.periods);
  const intent = useFinance((state) => state.intent);
  const clearIntent = useFinance((state) => state.clearIntent);
  const setItemRole = useFinance((state) => state.setItemRole);
  const setCategoryNote = useFinance((state) => state.setCategoryNote);
  const setCategoryRole = useFinance((state) => state.setCategoryRole);
  const setCategoryMoneyLocation = useFinance((state) => state.setCategoryMoneyLocation);
  const setCategoryPayment = useFinance((state) => state.setCategoryPayment);
  const setCategorySchedule = useFinance((state) => state.setCategorySchedule);
  const renameItem = useFinance((state) => state.renameItem);
  const addItem = useFinance((state) => state.addItem);
  const removeItem = useFinance((state) => state.removeItem);
  const addCategory = useFinance((state) => state.addCategory);
  const removeCategory = useFinance((state) => state.removeCategory);
  const setItemAmount = useFinance((state) => state.setItemAmount);
  const transferToSavings = useFinance(state => state.transferToSavings);
  const openNext = useFinance((state) => state.openNext);

  const period = periods.find((item) => item.status === "open");
  const completedPeriodId = period && allPaymentsComplete(period) ? period.id : undefined;
  const [rolloverOpen, setRolloverOpen] = useState(false);
  const [carry, setCarry] = useState(0);
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [duplicateConfirmed, setDuplicateConfirmed] = useState(false);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [openIds, setOpenIds] = useState<Record<string, boolean>>({});
  const [addCategoryOpen, setAddCategoryOpen] = useState(false);
  const [addToSavingsOpen, setAddToSavingsOpen] = useState(false);
  const [savingsAmount, setSavingsAmount] = useState(0);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [categoryAmount, setCategoryAmount] = useState(0);

  useEffect(() => {
    if (intent === "apartar" && period) {
      clearIntent();
    }
  }, [intent, period, clearIntent]);

  if (!period) {
    return (
      <div className="dashboard-home">
        <PageHeader title="Mi quincena" lede="Un espacio para tu dinero y tus próximos pasos." />
        <section className="empty-balance hero-card">
          <span className="empty-balance-icon" aria-hidden="true"><Wallet className="size-7" /></span>
          <h2>{periods.length ? "Tu quincena está cerrada" : "Tus quincenas"}</h2>
          <p>{periods.length
            ? "Podés consultar las quincenas anteriores en el historial."
            : "Si ya registraste gastos o ahorros, recuperá tu respaldo antes de abrir otra quincena."}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            {periods.length ? (
              <Link className="material-button inline-flex min-h-11 items-center px-5" to="/historial">Ver historial</Link>
            ) : (
              <Button onClick={openRecovery}>Recuperar mis registros</Button>
            )}
            <Button variant="quiet" onClick={() => { openNext(); toast.success("Nueva quincena lista"); }}>
              {periods.length ? "Abrir la siguiente" : "Crear quincena"} <ArrowUpRight className="size-4" />
            </Button>
          </div>
          <div className="empty-balance-tags"><span><Wallet className="size-4" /> Tus gastos</span><span><PiggyBank className="size-4" /> Tus ahorros</span></div>
        </section>
      </div>
    );
  }

  const quickIds = new Set(period.movements?.filter(m => m.kind === "expense").map(m => m.categoryId));
  const paymentCategory = period.categories.find((category) => category.id === paymentId);
  const repeatedAbono = paymentCategory && paymentAmount > 0 && repeatedCharges(period.movements ?? [], paymentCategory.name, paymentAmount, todayInManagua()).length > 0;
  const paymentRemaining = paymentCategory
    ? categoryPendingAmount(paymentCategory)
    : 0;
  const upcoming = period.categories.flatMap((category) => {
    const date = category.carriedDueDate ?? categoryDueDate(period.start, category.dueDay);
    return date && categoryPaidAmount(category) < categoryTotal(category)
      ? [{ category, date, days: daysUntil(date) }] : [];
  }).filter((entry) => entry.days <= 3).sort((a, b) => a.date.localeCompare(b.date));

  const query = comparable(search);
  const rubros = period.categories.filter(c => !quickIds.has(c.id));
  const visibleRubros = rubros.filter(c => {
    const paid = categoryPaidAmount(c), pending = categoryPendingAmount(c);
    const matches = filter === "all" || (filter === "pending" && pending > 0) ||
      (filter === "partial" && paid > 0 && pending > 0) || (filter === "paid" && paid > 0 && !pending);
    return matches && (!query || [c.name, c.note ?? "", ...c.items.map(item => item.name)].some(value => comparable(value).includes(query)));
  });

  function showCategory(id: string) {
    setRolloverOpen(false);
    setSearch(""); setFilter("all");
    setOpenIds(prev => ({ ...prev, [id]: true }));
    requestAnimationFrame(() => {
      const button = document.getElementById("rubro-" + id);
      button?.focus({ preventScroll: true });
      button?.scrollIntoView({ block: "center" });
    });
  }

  function announceChange(message: string, undo: (() => boolean) | null) {
    if (!undo) return;
    toast.success(message, {
      duration: 7500,
      action: {
        label: "Deshacer",
        onClick: () => {
          if (undo()) toast.undo("Cambio deshecho");
          else toast.info("El registro cambió. Puedes ajustarlo desde su rubro o cuenta.");
        },
      },
    });
  }

  const bankBalance = estimatedBankBalance(period);
  const expenses = periodExpenses(period);
  const deferred = deferredPaymentsTotal(period);
  const surplus = periodSurplus(period);
  const { cash, account } = pendingMoneyLocations(period);
  const rate = savingsRate(period);
  const hasFunds = periodFunds(period) > 0;
  const received = period.income > 0;
  const reserved = periodFunds(period) - expenses - surplus;

  return (
    <div className="dashboard-home">
      <PageHeader
        title="Mi quincena"
        lede={formatRange(period.start, period.end)}
      />

      <section className="hero-card balance-overview">
        <div className="balance-main">
          <div className="balance-topline"><p className="balance-eyebrow"><Wallet className="size-4" /> {hasFunds ? (surplus < 0 ? "Te falta para cubrir la quincena" : "Lo que te queda libre") : "Gastos anotados"}</p><span className="currency-badge">C$ · NIO</span></div>
          <p className={cn("balance-amount font-display tabular-nums", hasFunds && surplus < 0 ? "text-bad" : "text-fg")}>{formatMoney(hasFunds ? Math.abs(surplus) : expenses)}</p>
          <p className="balance-caption">{received ? "Después de tus gastos, ahorros y reservas de esta quincena." : hasFunds ? "Disponible del saldo anterior mientras registrás tu pago." : "Anotá tus gastos. Cuando te paguen, registrá el monto para ver cuánto te queda."}</p>
          {surplus > 0 && <Button aria-haspopup="dialog" className="mt-6" onClick={() => { setSavingsAmount(surplus); setAddToSavingsOpen(true); }}>
            <PiggyBank className="size-4" /> Agregar a ahorros <ArrowUpRight className="size-4" />
          </Button>}
        </div>
        <div className="balance-details">
          <Paycheck key={period.id} period={period} />
          {Boolean(period.openingBalance) && <p className="mt-2 text-xs text-muted">Saldo de la quincena anterior · {formatMoney(period.openingBalance!)}</p>}
          <div className="balance-stats mt-5 flex items-start justify-between gap-4 text-sm">
          <div>
            <p className="text-muted">Gastos</p>
            <p className="font-display text-xl tabular-nums"><MoneyAmount value={expenses} outflow /></p>
          </div>
          <div className="text-right">
            <p className="text-muted">Ahorros y reservas</p>
            <p className="font-display text-xl tabular-nums">{formatMoney(reserved)}</p>
          </div>
        </div>
        <details className="mt-3 text-sm text-muted"><summary className="cursor-pointer py-2">Pendiente para la otra quincena · <strong>{formatMoney(deferred)}</strong></summary>
          {period.categories.filter(c => categoryPaidAmount(c) > 0 && categoryPendingAmount(c) > 0).map(c =>
            <button type="button" className="pending-link" key={c.id} onClick={() => showCategory(c.id)}><span>{c.name}</span><strong>{formatMoney(categoryPendingAmount(c))} ›</strong></button>)}
          {!deferred && <p>Sin saldos pendientes de abonos parciales.</p>}
        </details>
        {hasFunds && <div className="mt-3">
          <div className="budget-progress" role="progressbar" aria-label="Porcentaje del dinero asignado" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, Math.max(0, Math.round((1 - rate) * 100)))}>
            <span style={{ width: `${Math.min(100, Math.max(0, (1 - rate) * 100))}%` }} />
          </div>
          <p className="mt-2 text-xs text-muted">Margen libre · {Math.round(rate * 100)}%</p>
        </div>}
        </div>
      </section>

      <DailyTools key={period.id} period={period} />
      <SpendingPlanner key={"plan-" + period.id} period={period} />

      {hasFunds && <details className="bank-summary card mt-4 px-4 py-3">
        <summary className="cursor-pointer text-sm font-medium">
          Saldo después de pagos registrados <strong className="ml-2 tabular-nums"><MoneyAmount value={bankBalance} /></strong>
        </summary>
        <dl className="mt-3 space-y-2 border-t border-line pt-3 text-sm">
          <div className="flex flex-wrap justify-between gap-x-2">
            <dt>Pago recibido</dt><dd><MoneyAmount value={period.income} /></dd>
          </div>
          {Boolean(period.openingBalance) && <div className="flex flex-wrap justify-between gap-x-2"><dt>Saldo anterior</dt><dd>{formatMoney(period.openingBalance!)}</dd></div>}
          <div className="flex flex-wrap justify-between gap-x-2">
            <dt>Pagos registrados</dt><dd><MoneyAmount value={-paidRubrosTotal(period)} /></dd>
          </div>
          {period.categories.filter((category) => categoryPaidAmount(category) > 0).map((category) => (
            <div key={category.id} className="flex flex-wrap justify-between gap-x-2 pl-3 text-xs text-muted">
              <dt>{category.name} · {category.moneyLocation === "cash" ? "Efectivo" : "Cuenta"}</dt>
              <dd><MoneyAmount value={-categoryPaidAmount(category)} /></dd>
            </div>
          ))}
          <div className="flex flex-wrap justify-between gap-x-2">
            <dt>Apartado a ahorros</dt><dd><MoneyAmount value={-(period.setAside || 0)} /></dd>
          </div>
        </dl>
      </details>}

      {upcoming.length > 0 && (
        <section className="card mt-4 px-4 py-3" aria-label="Recordatorios de vencimiento">
          <h2 className="text-sm font-medium">Vencimientos</h2>
          <ul className="mt-2 space-y-2 text-sm">
            {upcoming.map(({ category, days: remainingDays }) => (
              <li key={category.id} className="flex flex-wrap justify-between gap-x-3">
                <span>{category.name}</span>
                <span className={remainingDays < 0 ? "text-bad" : "text-muted"}>
                  {remainingDays < 0 ? "Vencido" : remainingDays === 0 ? "Vence hoy" :
                    remainingDays === 1 ? "Vence mañana" : `Vence en ${remainingDays} días`}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="section-heading mt-8 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-2xl">Tus rubros</h2>
        <Button aria-haspopup="dialog" variant="ghost" onClick={() => setAddCategoryOpen(true)} className="text-gold bg-surface-2 px-3">
          <Plus className="size-4" /> Nuevo Rubro
        </Button>
      </div>

      <dl
        aria-label="Distribución del dinero de tus rubros pendientes"
        aria-live="polite"
        aria-atomic="true"
        className="distribution-strip card mt-4 grid grid-cols-2 divide-x divide-line py-3"
      >
        <div className="min-w-0 px-4">
          <dt className="text-sm text-muted">Por pagar en efectivo</dt>
          <dd className="mt-1 break-words font-display text-xl tabular-nums text-gold">
            {formatMoney(cash)}
          </dd>
        </div>
        <div className="min-w-0 px-4">
          <dt className="text-sm text-muted">Por pagar desde cuenta</dt>
          <dd className="mt-1 break-words font-display text-xl tabular-nums">
            {formatMoney(account)}
          </dd>
        </div>
      </dl>

      {rubros.length > 0 && <div className="rubro-filters">
        <input aria-label="Buscar rubro o nota" type="search" placeholder="Buscar rubro o nota" value={search} onChange={e => setSearch(e.target.value)} />
        <select aria-label="Estado del rubro" value={filter} onChange={e => setFilter(e.target.value)}>
          <option value="all">Todos</option><option value="pending">Pendientes</option>
          <option value="partial">Con abonos</option><option value="paid">Pagados</option>
        </select>
      </div>}
      {rubros.length > 0 && !visibleRubros.length && <p className="mt-3 text-sm text-muted" role="status">No hay rubros que coincidan. <button className="underline" onClick={() => { setSearch(""); setFilter("all"); }}>Ver todos</button></p>}
      <div className="rubros-list mt-3 grid gap-2">
        {visibleRubros.map((category) => {
          const total = categoryTotal(category);
          const open = openIds[category.id] ?? false;
          const isSaving = category.role === "life";
          const hasOutflow = category.items.length === 0
            ? !isSaving
            : category.items.some((item) => (item.roleOverride ?? category.role) !== "life");
          const paidAmount = categoryPaidAmount(category);
          const paid = total > 0 && paidAmount >= total;
          const dueDate = category.carriedDueDate ?? categoryDueDate(period.start, category.dueDay);

          return (
            <div key={category.id} className="category-card card overflow-hidden">
              <div className="rubro-bar">
                <h3><button type="button" id={"rubro-" + category.id} aria-expanded={open} aria-controls={open ? `category-${category.id}` : undefined}
                  onClick={() => setOpenIds(prev => ({ ...prev, [category.id]: !open }))}>
                  <span className="rubro-dot" style={{ backgroundColor: `var(--cat-${category.tone})` }} />
                  <span><strong>{category.name}</strong><small>{total === 0 ? "Sin monto" : paid ? "Pagado" : paidAmount > 0 ? `Abonado · faltan ${formatMoney(total - paidAmount)}` : "Pendiente"}</small></span>
                  <ChevronDown className={cn("size-4 shrink-0 text-muted", open && "rotate-180")} />
                </button></h3>
                <button type="button" className="rubro-amount" aria-label={`Editar monto de ${category.name}`} onClick={() => {
                  setEditingCategory(category.id); setOpenIds(prev => ({ ...prev, [category.id]: true })); setCategoryAmount(total);
                }}><MoneyAmount value={total} outflow={hasOutflow} /></button>
              </div>
              {!open && category.note && <p className="rubro-note-preview">{category.note}</p>}
              {open && <div id={`category-${category.id}`}>
                <div className="rubro-config">
                  <div className="flex items-center gap-2 mt-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); setCategoryRole(category.id, "need"); }}
                      aria-pressed={!isSaving}
                      className={cn("min-h-11 text-xs px-3 py-2 rounded-xl border", !isSaving ? "bg-bad/10 border-bad/40 text-bad" : "border-line text-muted")}
                    >
                      Gasto
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setCategoryRole(category.id, "life"); }}
                      aria-pressed={isSaving}
                      className={cn("min-h-11 text-xs px-3 py-2 rounded-xl border", isSaving ? "bg-good/10 border-good/40 text-good" : "border-line text-muted")}
                    >
                      Ahorro
                    </button>
                  </div>

                  <label
                    className={cn(
                      "inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border px-3 text-xs font-medium",
                      paid ? "border-good/40 bg-good/10 text-good" : "border-line text-muted",
                    )}
                  >
                    <input
                      type="checkbox"
                      className="size-4 shrink-0 accent-good"
                      aria-label={`Pagado: ${category.name}`}
                      checked={paid}
                      disabled={total <= 0}
                      onChange={(event) => {
                        const checked = event.currentTarget.checked;
                        announceChange(checked ? "Pago registrado" : "Pago retirado",
                          setCategoryPayment(category.id, checked ? "full" : 0));
                      }}
                    />
                    {paid ? "Pagado" : paidAmount > 0 ? "Pago parcial" : "Pendiente"}
                  </label>
                </div>
              {paidAmount > 0 && !paid && (
                <dl className="category-payment-summary" aria-label="Resumen del abono">
                  <div>
                    <dt>Pagado</dt>
                    <dd>{formatMoney(paidAmount)}</dd>
                  </div>
                  <div>
                    <dt>Pendiente</dt>
                    <dd>{formatMoney(total - paidAmount)}</dd>
                  </div>
                </dl>
              )}
              {dueDate && (
                <time className="category-due" dateTime={dueDate}>
                  Vence {dueDate.slice(8)}/{dueDate.slice(5, 7)}
                </time>
              )}
              <div className="category-actions">
                <RadioGroup.Root
                  aria-label={`Dónde dejar el dinero de ${category.name}`}
                  orientation="horizontal"
                  value={category.moneyLocation === "cash" ? "cash" : "account"}
                  onValueChange={(value) => {
                    const location = value === "cash" ? "cash" : "account";
                    setCategoryMoneyLocation(category.id, location);
                    playFeedback("select");
                  }}
                  data-feedback="off"
                  className="money-location-switch"
                >
                  <RadioGroup.Item value="account" className="money-location-option">
                    Cuenta
                  </RadioGroup.Item>
                  <RadioGroup.Item value="cash" className="money-location-option">
                    Efectivo
                  </RadioGroup.Item>
                </RadioGroup.Root>
                {!paid && total > 0 && (
                  <Button type="button" variant="quiet" aria-haspopup="dialog" className="category-abono" onClick={() => {
                    setDuplicateConfirmed(false);
                    setPaymentAmount(0);
                    setPaymentId(category.id);
                  }}>Registrar abono</Button>
                )}
              </div>

              <label className="category-note">
                <Pencil className="size-3.5 shrink-0 text-muted" aria-hidden="true" />
                <span className="sr-only">Nota de {category.name}</span>
                <textarea rows={1} value={category.note ?? ""} placeholder="Escribí una nota…"
                  onChange={event => setCategoryNote(category.id, event.currentTarget.value)} />
              </label>

              <CategoryPayments period={period} categoryId={category.id} />
                <div className="category-content p-4 border-t border-line bg-surface-2/50">
                  <ul className="flex flex-col gap-4">
                    {category.items.map((item) => (
                      <ItemRow
                        key={item.id}
                        name={item.name}
                        amount={item.amount}
                        max={item.max}
                        onAmount={(amount) => setItemAmount(item.id, amount)}
                        onName={(name) => renameItem(item.id, name)}
                        onRemove={() => removeItem(item.id)}
                        role={item.roleOverride || category.role}
                        onRoleChange={(newRole) => setItemRole(item.id, newRole)}
                      />
                    ))}
                  </ul>

                  {editingCategory === category.id && (
                    <div className="mt-3 rounded-xl border border-line bg-surface p-3 flex flex-col gap-3">
                      <p className="text-sm font-medium">Monto de {category.name}</p>
                      <MoneyField label="Monto del rubro" value={categoryAmount} onChange={setCategoryAmount} outflow={hasOutflow} />
                      <div className="flex flex-wrap gap-2">
                        <Button
                          full
                          onClick={() => {
                            const otherTotal = category.items.slice(1).reduce((sum, item) => sum + item.amount, 0);
                            const first = category.items[0];

                            if (first) {
                              setItemAmount(first.id, Math.max(0, categoryAmount - otherTotal));
                            } else {
                              addItem(category.id, category.name, categoryAmount);
                            }

                            setEditingCategory(null);
                            toast.success("Monto actualizado");
                          }}
                        >
                          Guardar monto
                        </Button>
                        <Button variant="ghost" onClick={() => setEditingCategory(null)}>
                          <X className="size-4" />
                        </Button>
                      </div>
                    </div>
                  )}

                  <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-line pt-3 text-sm">
                    <label className="flex min-h-11 items-center gap-2">
                      Vence cada mes
                      <select className="rounded-lg bg-surface px-2 py-2" value={category.dueDay ?? ""}
                        onChange={(event) => setCategorySchedule(category.id, {
                          dueDay: event.currentTarget.value ? Number(event.currentTarget.value) : undefined,
                        })}>
                        <option value="">Sin fecha</option>
                        {Array.from({ length: 31 }, (_, index) => index + 1).map((day) => (
                          <option key={day} value={day}>Día {day}</option>
                        ))}
                      </select>
                    </label>
                    <label className="flex min-h-11 items-center gap-2">
                      <input type="checkbox" className="accent-good" checked={category.recurring !== false}
                        onChange={(event) => setCategorySchedule(category.id, { recurring: event.currentTarget.checked })} />
                      Repetir en la próxima quincena
                    </label>
                  </div>

                  <Button variant="danger" className="mt-4 w-full" onClick={() => removeCategory(category.id)}>
                    <Trash2 className="size-4" /> Quitar rubro
                  </Button>
                </div>
              </div>}
            </div>
          );
        })}
      </div>

      {completedPeriodId && received && (
        <p className="mt-4 text-sm text-muted" role="status">
          Pagos completos. Ya podés revisar el cierre y elegir cuánto saldo trasladar.
        </p>
      )}
      <Button aria-haspopup="dialog" variant="ghost" className="mt-5" onClick={() => { setCarry(0); setRolloverOpen(true); }}>
        Revisar cierre de quincena
      </Button>
      <Modal title="Cierre de quincena" open={rolloverOpen} onOpenChange={setRolloverOpen}>
        <div className="flex flex-col gap-3 p-5">
          <p className="text-sm text-muted">
            Esta quincena quedará en Historial. Los pagos pendientes pasarán a la siguiente por el monto que falta.
          </p>
          {!received && <Paycheck key={period.id} period={period} />}
          <div className="daily-note"><div>Saldo estimado al cierre · <strong>{formatMoney(bankBalance)}</strong></div>
            <div>Pagos y abonos registrados · {formatMoney(paidRubrosTotal(period))}</div>
            <details><summary>Pendiente para la próxima quincena · {formatMoney(period.categories.reduce((sum, c) => sum + categoryPendingAmount(c), 0))}</summary>
              {period.categories.filter(c => categoryPendingAmount(c) > 0).map(c => <button type="button" className="pending-link" key={c.id} onClick={() => showCategory(c.id)}><span>{c.name}</span><strong>{formatMoney(categoryPendingAmount(c))} ›</strong></button>)}
            </details></div>
          <ExportRubros period={period} />
          <div>Saldo que querés trasladar<MoneyField label="Saldo que querés trasladar" value={carry} onChange={setCarry} /></div>
          {carry > Math.max(0, bankBalance) && <p className="text-sm text-bad">El traslado supera tu saldo estimado.</p>}
          {Boolean(period.trash?.length) && <p className="text-sm text-muted">Tenés movimientos en la papelera. Podés restaurarlos antes de cerrar.</p>}
          <Button disabled={carry > Math.max(0, bankBalance)} onClick={() => {
            openNext(true, true, undefined, carry);
            setRolloverOpen(false);
            toast.success("Nueva quincena lista");
          }}>Abrir con rubros recurrentes</Button>
          <Button variant="ghost" disabled={carry > Math.max(0, bankBalance)} onClick={() => {
            openNext(false, true, undefined, carry);
            setRolloverOpen(false);
            toast.success("Nueva quincena lista");
          }}>Abrir solo con pendientes</Button>
        </div>
      </Modal>
      <Modal title={paymentCategory ? `Abono a ${paymentCategory.name}` : "Registrar abono"}
        open={Boolean(paymentCategory)} onOpenChange={(open) => { if (!open) setPaymentId(null); }}>
        {paymentCategory && (
          <div className="flex flex-col gap-3 p-5">
            <p className="text-sm text-muted">Saldo del rubro {formatMoney(paymentRemaining)}</p>
            <MoneyField label="Monto del abono" value={paymentAmount} onChange={v => { setDuplicateConfirmed(false); setPaymentAmount(v); }} />
            {paymentAmount > 0 && paymentAmount < paymentRemaining && <p className="text-sm text-muted">Quedarán {formatMoney(paymentRemaining - paymentAmount)} para la otra quincena.</p>}
            {repeatedAbono && <p className="daily-note text-sm" role="status">Ya hay un abono por ese monto y concepto hoy.</p>}
            <Button disabled={paymentAmount <= 0 || paymentAmount > paymentRemaining} onClick={() => {
              if (repeatedAbono && !duplicateConfirmed) { setDuplicateConfirmed(true); return; }
              announceChange("Abono registrado", setCategoryPayment(paymentCategory.id,
                categoryPaidAmount(paymentCategory) + paymentAmount));
              setPaymentId(null);
            }}>{repeatedAbono && duplicateConfirmed ? "Confirmar otro abono igual" : "Guardar abono"}</Button>
            {categoryPaidAmount(paymentCategory) > 0 && (
              <Button variant="ghost" onClick={() => {
                announceChange("Abonos retirados", setCategoryPayment(paymentCategory.id, 0));
                setPaymentId(null);
              }}>Quitar abonos registrados</Button>
            )}
          </div>
        )}
      </Modal>

      <Modal title="Nuevo rubro" open={addCategoryOpen} onOpenChange={setAddCategoryOpen}>
        <div className="p-5 flex flex-col gap-4">

          <input
            type="text"
            placeholder="Ej. Cajita de ahorros LAFISE"
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            className="w-full rounded bg-surface-2 p-3 text-sm outline-none focus:ring-2 focus:ring-gold"
          />
          <Button
            full
            disabled={!newCategoryName.trim()}
            onClick={() => {
              if (newCategoryName.trim()) {
                const id = addCategory(newCategoryName, "need");
                if (id) showCategory(id);
                playFeedback("confirm");
                setNewCategoryName("");
                setAddCategoryOpen(false);
              }
            }}
          >
            Crear Rubro
          </Button>
        </div>
      </Modal>

      <Modal title="Agregar a ahorros" open={addToSavingsOpen} onOpenChange={setAddToSavingsOpen}>
        <div className="p-5 flex flex-col gap-4">
          <h2 className="text-xl font-bold">Agregar a Ahorros</h2>
          <p className="text-sm text-muted">¿Cuánto quieres apartar?</p>
          <MoneyField label="Monto a apartar" value={savingsAmount} onChange={setSavingsAmount} />

          <p className="text-sm font-medium mt-2">¿A qué cuenta?</p>
          <div className="flex flex-col gap-2">
            {['BAC', 'LAFISE', 'BANPRO'].map((banco) => (
              <Button
                key={banco}
                variant="ghost"
                className="w-full justify-between bg-surface-2"
                disabled={savingsAmount <= 0 || savingsAmount > surplus}
                onClick={() => {
                  const undo = transferToSavings(banco, savingsAmount);
                  if (!undo) {
                    toast.error("El monto supera el dinero disponible");
                    return;
                  }
                  announceChange("Ahorro registrado", undo);
                  setAddToSavingsOpen(false);
                }}
              >
                <span>{banco}</span>
                <span className="text-xs text-muted">+ <MoneyAmount value={savingsAmount} /></span>
              </Button>
            ))}
          </div>
        </div>
      </Modal>
    </div>
  );
}

function CategoryPayments({ period, categoryId }: { period: Period; categoryId: string }) {
  const entries = (period.movements ?? []).filter(m => m.kind === "payment" && m.categoryId === categoryId);
  if (!entries.length) return null;
  return <details className="rubro-payments">
    <summary>Historial de abonos ({entries.length})</summary>
    {[...entries].reverse().map(m => <div className="daily-row" key={m.id}>
      <div><strong>{m.amount < 0 ? "Ajuste" : "Abono"} · {m.date.slice(8)}/{m.date.slice(5, 7)}</strong>
        <small>{m.location === "cash" ? "Efectivo" : "Cuenta"} · {m.name}</small></div>
      <span>{formatMoney(m.amount)}</span>
    </div>)}
  </details>;
}
