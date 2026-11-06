import { useEffect, useState, type CSSProperties } from "react";
import { ChevronDown, Plus, Trash2, X } from "lucide-react";
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
  const goals = useFinance((state) => state.goals);
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
  const addToGoal = useFinance((state) => state.addToGoal);
  const addGoal = useFinance((state) => state.addGoal);
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
    <div className="pb-24">
      <PageHeader
        title="Esta quincena"
        lede={`${formatRange(period.start, period.end)} · ${daysLabel(days)}`}
      />

      <div className="world-banner"><span className="world-banner-mark" /><div><p>TU QUINCENA, CON SUPERPODERES</p><span>Cuida tu futuro. Disfruta el presente.</span></div><span className="world-banner-dot" /></div>
      <section className="hero-card p-5">
        <p className="text-xs text-muted">Tu bolsillo disponible</p>
        <p className="mt-1 font-display text-5xl leading-none tabular-nums text-good">{formatMoney(surplus)}</p>
        <p className="mt-3 text-sm text-muted">de {formatMoney(period.income)} de ingreso</p>
        <Button full className="mt-3" onClick={() => { setSavingsAmount(surplus); setAddToSavingsOpen(true); }} disabled={surplus <= 0}>
          Agregar a ahorros
        </Button>
        <div className="mt-5 flex items-center justify-between text-sm border-t border-line pt-4">
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
      </section>

      <section className="mt-6">
        <label className="text-sm font-medium">Ingreso neto de la quincena</label>
        <div className="mt-1">
          <MoneyField label="Ingreso neto de la quincena" value={period.income} onChange={setIncome} />
        </div>
      </section>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-2xl">Salidas</h2>
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
            <div key={category.id} className="rounded-xl border border-line bg-surface shadow-sm overflow-hidden">
              <div 
                className="category-heading flex flex-wrap items-center justify-between gap-3 p-4 cursor-pointer"
                onClick={() => setOpenIds((prev) => ({ ...prev, [category.id]: !open }))}
              >
                <div className="flex min-w-0 flex-1 basis-40 flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: `var(--cat-${category.tone})` }} />
                    <h3 className="min-w-0 font-medium text-base break-words">{category.name}</h3>
                  </div>
                  
                  {/* Botón para cambiar entre Gasto / Ahorro directamente aquí */}
                  <div className="flex items-center gap-2 mt-1">
                    <button 
                      onClick={(e) => { e.stopPropagation(); setCategoryRole(category.id, "need"); }}
                      className={cn("min-h-11 text-xs px-3 py-2 rounded-xl border", !isSaving ? "bg-bad/10 border-bad/40 text-bad" : "border-line text-muted")}
                    >
                      Gasto
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); setCategoryRole(category.id, "life"); }}
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
                      setCategoryAmount(total);
                    }}
                    className="font-display text-lg tabular-nums rounded-xl px-3 py-2 break-all text-gold hover:bg-surface-2 active:scale-95 transition"
                    aria-label={`Editar monto de ${category.name}`}
                  >
                    {formatMoney(total)}
                  </button>
                  <ChevronDown className={cn("size-5 text-muted transition-transform", open && "rotate-180")} />
                </div>
              </div>
              
              {open && (
                <div className="p-4 border-t border-line bg-surface-2/50">
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
