import { useEffect, useState } from "react";
import { ArrowUpRight, ChevronDown, Plus, PiggyBank, Trash2, Wallet, X } from "lucide-react";
import { toast } from "sonner";
import { Button, Modal, MoneyField } from "@/components/ui";
import { PageHeader } from "@/components/shell";
import { cn } from "@/lib/cn";
import { ItemRow } from "@/components/item-row";
import {
  categoryTotal,
  daysLabel,
  daysUntil,
  formatMoney,
  formatRange,
  periodExpenses,
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
  const renameItem = useFinance((state) => state.renameItem);
  const addItem = useFinance((state) => state.addItem);
  const removeItem = useFinance((state) => state.removeItem);
  const addCategory = useFinance((state) => state.addCategory);
  const removeCategory = useFinance((state) => state.removeCategory);
  const setItemAmount = useFinance((state) => state.setItemAmount);
  const transferToSavings = useFinance(state => state.transferToSavings);
  const openNext = useFinance((state) => state.openNext);

  const period = periods.find((item) => item.status === "open");
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
      <div>
        <PageHeader title="Sin quincena abierta" lede="La anterior ya quedó archivada." />
        <Button onClick={() => { openNext(); toast.success("Nueva quincena lista"); }}>
          Abrir la siguiente
        </Button>
      </div>
    );
  }

  const expenses = periodExpenses(period);
  const surplus = periodSurplus(period);
  const rate = savingsRate(period);
  const tone = rateTone(rate);
  const safeEnd = (period.end && !isNaN(new Date(period.end).getTime())) 
    ? period.end 
    : new Date(new Date().getTime() + 14 * 24 * 60 * 60 * 1000).toISOString();
  const days = daysUntil(safeEnd);

  return (
    <div>
      <PageHeader
        title="Esta quincena"
        lede={`${formatRange(period.start, period.end)} · ${daysLabel(days)}`}
      />

      <section className="hero-card balance-overview">
        <div className="balance-main">
          <p className="balance-eyebrow"><Wallet className="size-4" /> TU BOLSILLO DISPONIBLE</p>
          <p className={cn("balance-amount font-display tabular-nums", surplus < 0 ? "text-bad" : "text-fg")}>{formatMoney(surplus)}</p>
          <p className="mt-3 text-sm text-muted">Cuida tu futuro. Disfruta el presente.</p>
          <Button className="mt-6" onClick={() => { setSavingsAmount(surplus); setAddToSavingsOpen(true); }} disabled={surplus <= 0}>
            <PiggyBank className="size-4" /> Agregar a ahorros <ArrowUpRight className="size-4" />
          </Button>
        </div>
        <div className="balance-details">
          <label className="text-xs font-medium text-muted">Ingreso neto de la quincena</label>
          <div className="mt-2"><MoneyField label="Ingreso neto de la quincena" value={period.income} onChange={setIncome} /></div>
          <div className="mt-5 flex items-start justify-between gap-4 text-sm">
          <div>
            <p className="text-muted">Gastos</p>
            <p className="font-display text-xl tabular-nums">{formatMoney(expenses)}</p>
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

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <div><p className="page-eyebrow mb-1">CADA CÓRDOBA, EN SU LUGAR</p><h2 className="font-display text-2xl">Tus rubros</h2></div>
        <Button variant="ghost" onClick={() => setAddCategoryOpen(true)} className="text-gold bg-surface-2 px-3">
          <Plus className="size-4" /> Nuevo Rubro
        </Button>
      </div>

      <div className="mt-4 flex flex-col gap-4">
        {period.categories.map((category) => {
          const total = categoryTotal(category);
          const open = openIds[category.id] ?? false;
          const isSaving = category.role === "life";
          
          return (
            <div key={category.id} className="category-card card overflow-hidden">
              <div className="category-heading flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="flex min-w-0 flex-1 basis-40 flex-col gap-1">
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

                <div className="flex min-w-0 max-w-full flex-wrap items-center gap-3">
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
                    {formatMoney(total)}
                  </button>
                </div>
              </div>
              
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
                      <MoneyField label="Monto del rubro" value={categoryAmount} onChange={setCategoryAmount} />
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
                  
                  <Button variant="danger" className="mt-4 w-full" onClick={() => removeCategory(category.id)}>
                    <Trash2 className="size-4" /> Quitar rubro
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <Modal title="Nuevo rubro" open={addCategoryOpen} onOpenChange={setAddCategoryOpen}>
        <div className="p-5 flex flex-col gap-4">
          <h2 className="text-xl font-bold">Nuevo Rubro</h2>
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
                  if (!transferToSavings(banco, savingsAmount)) {
                    toast.error("El monto supera el dinero disponible");
                    return;
                  }
                  toast.success("Ahorro registrado y descontado del disponible");
                  setAddToSavingsOpen(false);
                }}
              >
                <span>{banco}</span>
                <span className="text-xs text-muted">+ {formatMoney(savingsAmount)}</span>
              </Button>
            ))}
          </div>
        </div>
      </Modal>
    </div>
  );
}
