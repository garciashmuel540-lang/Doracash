import * as RadioGroup from "@radix-ui/react-radio-group";
import { useEffect, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, ChevronDown, Plus, PiggyBank, Trash2, Wallet, X } from "lucide-react";
import { toast } from "sonner";
import { MoneyAmount, Button, Modal, MoneyField } from "@/components/ui";
import { PageHeader } from "@/components/shell";
import { playSelectionHaptic } from "@/lib/haptics";
import { cn } from "@/lib/cn";
import { repeatedCharges, todayInManagua } from "@/lib/daily";
import { DailyTools } from "./daily-tools";
import { ItemRow } from "@/components/item-row";
import {
  categoryTotal,
  allPaymentsComplete,
  categoryPendingAmount,
  categoryPaidAmount,
  categoryDueDate,
  paidRubrosTotal,
  daysLabel,
  daysUntil,
  estimatedBankBalance,
  formatMoney,
  formatRange,
  periodExpenses,
  pendingMoneyLocations,
  periodSurplus,
  ratePhrase,
  rateTone,
  savingsRate,
} from "@/lib/finance";
import { useFinance } from "@/lib/store";

export function QuincenaPanel() {
  const periods = useFinance((state) => state.periods);
  const intent = useFinance((state) => state.intent);
  const clearIntent = useFinance((state) => state.clearIntent);
  const setIncome = useFinance((state) => state.setIncome);
  const setItemRole = useFinance((state) => state.setItemRole);
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
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [duplicateConfirmed, setDuplicateConfirmed] = useState(false);
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

  useEffect(() => {
    if (!completedPeriodId) return;
    const timer = window.setTimeout(() => {
      openNext(true, true, completedPeriodId);
    }, 8000);
    return () => window.clearTimeout(timer);
  }, [completedPeriodId, openNext]);

  if (!period) {
    return (
      <div className="dashboard-home">
        <PageHeader title="Tu quincena, en orden." lede="Un espacio para tu dinero y tus próximos pasos." />
        <section className="empty-balance hero-card">
          <span className="empty-balance-icon" aria-hidden="true"><Wallet className="size-7" /></span>
          <p className="page-eyebrow">UN NUEVO COMIENZO</p>
          <h2>Haz espacio para<br />lo que te importa.</h2>
          <p>Organiza tus gastos, separa tus ahorros y decide qué puedes disfrutar esta quincena.</p>
          <Button onClick={() => { openNext(); toast.success("Nueva quincena lista"); }}>
            Abrir la siguiente <ArrowUpRight className="size-4" />
          </Button>
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

  function announceChange(message: string, undo: (() => boolean) | null) {
    if (!undo) return;
    toast.success(message, {
      duration: 7500,
      action: {
        label: "Deshacer",
        onClick: () => {
          if (undo()) toast.success("Cambio deshecho");
          else toast.info("El registro cambió. Puedes ajustarlo desde su rubro o cuenta.");
        },
      },
    });
  }

  const bankBalance = estimatedBankBalance(period);
  const expenses = periodExpenses(period);
  const surplus = periodSurplus(period);
  const { cash, account } = pendingMoneyLocations(period);
  const rate = savingsRate(period);
  const tone = rateTone(rate);
  const safeEnd = (period.end && !isNaN(new Date(period.end).getTime()))
    ? period.end
    : new Date(new Date().getTime() + 14 * 24 * 60 * 60 * 1000).toISOString();
  const days = daysUntil(safeEnd);

  return (
    <div className="dashboard-home">
      <PageHeader
        title="Tu quincena, en orden."
        lede={`${formatRange(period.start, period.end)} · ${daysLabel(days)}`}
      />

      <section className="hero-card balance-overview">
        <div className="balance-main">
          <div className="balance-topline"><p className="balance-eyebrow"><Wallet className="size-4" /> Disponible para ti</p><span className="currency-badge">C$ · NIO</span></div>
          <p className={cn("balance-amount font-display tabular-nums", surplus < 0 ? "text-bad" : "text-fg")}><MoneyAmount value={surplus} /></p>
          <p className="balance-caption">Cuida tu futuro. Disfruta el presente.</p>
          <Button className="mt-6" onClick={() => { setSavingsAmount(surplus); setAddToSavingsOpen(true); }} disabled={surplus <= 0}>
            <PiggyBank className="size-4" /> Agregar a ahorros <ArrowUpRight className="size-4" />
          </Button>
        </div>
        <div className="balance-details">
          <label className="balance-income-label"><ArrowDownLeft className="size-4" /> Ingreso de la quincena</label>
          <div className="balance-income mt-2"><MoneyField label="Ingreso neto de la quincena" value={period.income} onChange={setIncome} /></div>
          <div className="balance-stats mt-5 flex items-start justify-between gap-4 text-sm">
          <div>
            <p className="text-muted">Gastos</p>
            <p className="font-display text-xl tabular-nums"><MoneyAmount value={expenses} outflow /></p>
          </div>
          <div className="text-right">
            <p className="text-muted">Margen disponible</p>
            <p className={cn("font-display text-xl tabular-nums", tone === "good" ? "text-good" : tone === "bad" ? "text-bad" : "")}>
              {Math.round(rate * 100)}%
            </p>
            <p className="text-xs text-muted">{ratePhrase(rate)}</p>
          </div>
        </div>
        <div className="budget-progress" role="progressbar" aria-label="Porcentaje del ingreso asignado" aria-valuemin={0} aria-valuemax={100} aria-valuenow={period.income > 0 ? Math.min(100, Math.max(0, Math.round((1 - rate) * 100))) : 0}><span style={{ width: `${period.income > 0 ? Math.min(100, Math.max(0, (1 - rate) * 100)) : 0}%` }} /></div>
        <p className="mt-2 text-xs text-muted">{period.income > 0 ? 'Lo que ya asignaste de tu ingreso' : 'Registra tu ingreso para ver tu margen'}</p>
        </div>
      </section>

      <DailyTools key={period.id} period={period} />

      <details className="bank-summary card mt-4 px-4 py-3">
        <summary className="cursor-pointer text-sm font-medium">
          Saldo estimado <strong className="ml-2 tabular-nums"><MoneyAmount value={bankBalance} /></strong>
        </summary>
        <dl className="mt-3 space-y-2 border-t border-line pt-3 text-sm">
          <div className="flex flex-wrap justify-between gap-x-2">
            <dt>Ingreso neto</dt><dd><MoneyAmount value={period.income} /></dd>
          </div>
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
      </details>

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
        <div><p className="page-eyebrow mb-1">CADA CÓRDOBA, EN SU LUGAR</p><h2 className="font-display text-2xl">Tus rubros</h2></div>
        <Button variant="ghost" onClick={() => setAddCategoryOpen(true)} className="text-gold bg-surface-2 px-3">
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
          <dt className="text-sm text-muted">Efectivo a retirar</dt>
          <dd className="mt-1 break-words font-display text-xl tabular-nums text-gold">
            {formatMoney(cash)}
          </dd>
        </div>
        <div className="min-w-0 px-4">
          <dt className="text-sm text-muted">Pendiente en cuenta</dt>
          <dd className="mt-1 break-words font-display text-xl tabular-nums">
            {formatMoney(account)}
          </dd>
        </div>
      </dl>

      <div className="rubros-list mt-4 grid gap-3">
        {period.categories.filter(c => !quickIds.has(c.id)).map((category) => {
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
              <RadioGroup.Root
                aria-label={`Dónde dejar el dinero de ${category.name}`}
                orientation="horizontal"
                value={category.moneyLocation === "cash" ? "cash" : "account"}
                onValueChange={(value) => {
                  const location = value === "cash" ? "cash" : "account";
                  setCategoryMoneyLocation(category.id, location);
                  playSelectionHaptic();
                }}
                className="money-location-switch mx-4 grid max-w-xs grid-cols-2 gap-1 rounded-full border border-line bg-surface-2 p-1"
              >
                <RadioGroup.Item value="account" className="money-location-option">
                  Cuenta
                </RadioGroup.Item>
                <RadioGroup.Item value="cash" className="money-location-option">
                  Efectivo
                </RadioGroup.Item>
              </RadioGroup.Root>
              <div className="category-heading flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="category-identity flex min-w-0 flex-1 basis-40 flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: `var(--cat-${category.tone})` }} />
                    <h3 className="min-w-0 flex-1 font-medium text-base break-words"><button className="category-disclosure" aria-expanded={open} aria-controls={`category-${category.id}`} onClick={() => setOpenIds(prev => ({ ...prev, [category.id]: !open }))}>{category.name}<ChevronDown className={cn("size-4 shrink-0 text-muted transition-transform", open && "rotate-180")} /></button></h3>
                  </div>

                  {/* Botón para cambiar entre Gasto / Ahorro directamente aquí */}
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
                </div>

                <div className="category-payment flex min-w-0 max-w-full flex-wrap items-center gap-3">
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
                        playSelectionHaptic();
                      }}
                    />
                    {paid ? "Pagado" : paidAmount > 0 ? "Pago parcial" : "Pendiente"}
                  </label>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingCategory(category.id);
                      setOpenIds(prev => ({ ...prev, [category.id]: true }));
                      setCategoryAmount(total);
                    }}
                    className="font-display text-lg tabular-nums rounded-xl px-3 py-2 break-all text-gold hover:bg-surface-2 active:scale-95 transition"
                    aria-label={`Editar monto de ${category.name}`}
                  >
                    <MoneyAmount value={total} outflow={hasOutflow} />
                  </button>
                </div>
              </div>

              {(total > 0 || dueDate) && (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 pb-3 text-xs text-muted">
                  {paidAmount > 0 && !paid && (
                    <span>Pagado {formatMoney(paidAmount)} · Pendiente {formatMoney(total - paidAmount)}</span>
                  )}
                  {dueDate && <time dateTime={dueDate}>Vence {dueDate.slice(8)}/{dueDate.slice(5, 7)}</time>}
                  {!paid && total > 0 && (
                    <Button type="button" variant="ghost" className="px-4 text-xs leading-snug text-gold [overflow-wrap:anywhere]" onClick={() => {
                      setDuplicateConfirmed(false);
                      setPaymentAmount(0);
                      setPaymentId(category.id);
                    }}>Registrar abono</Button>
                  )}
                </div>
              )}

              {open && (
                <div id={`category-${category.id}`} className="category-content p-4 border-t border-line bg-surface-2/50">
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
              )}
            </div>
          );
        })}
      </div>

      {completedPeriodId && (
        <p className="mt-4 text-sm text-muted" role="status">
          Pagos completos. La siguiente quincena se abrirá en unos segundos.
        </p>
      )}
      <Button variant="ghost" className="mt-5" onClick={() => setRolloverOpen(true)}>
        Pasar a la siguiente quincena
      </Button>
      <Modal title="Abrir otra quincena" open={rolloverOpen} onOpenChange={setRolloverOpen}>
        <div className="flex flex-col gap-3 p-5">
          <p className="text-sm text-muted">
            Esta quincena quedará en Historial. Los pagos pendientes pasarán a la siguiente por el monto que falta.
          </p>
          <Button onClick={() => {
            openNext(true, true);
            setRolloverOpen(false);
            toast.success("Nueva quincena lista");
          }}>Abrir con rubros recurrentes</Button>
          <Button variant="ghost" onClick={() => {
            openNext(false, true);
            setRolloverOpen(false);
            toast.success("Nueva quincena lista");
          }}>Abrir solo con pendientes</Button>
        </div>
      </Modal>
      <Modal title={paymentCategory ? `Abono a ${paymentCategory.name}` : "Registrar abono"}
        open={Boolean(paymentCategory)} onOpenChange={(open) => { if (!open) setPaymentId(null); }}>
        {paymentCategory && (
          <div className="flex flex-col gap-3 p-5">
            <p className="text-sm text-muted">Pendiente {formatMoney(paymentRemaining)}</p>
            <MoneyField label="Monto del abono" value={paymentAmount} onChange={v => { setDuplicateConfirmed(false); setPaymentAmount(v); }} />
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
                addCategory(newCategoryName, "need");
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
