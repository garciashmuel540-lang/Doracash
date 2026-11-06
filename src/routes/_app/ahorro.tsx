import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Trash2, Plus } from "lucide-react";
import { PageHeader } from "@/components/shell";
import { Button, Modal, MoneyField } from "@/components/ui";
import { useFinance } from "@/lib/store";
import { formatMoney, categoryTotal } from "@/lib/finance";

export const Route = createFileRoute("/_app/ahorro")({
  component: AhorroPage,
});

function AhorroPage() {
  const goals = useFinance((s) => s.goals);
  const periods = useFinance((s) => s.periods);
  const addGoal = useFinance((s) => s.addGoal);
  const updateGoal = useFinance((s) => s.updateGoal);
  const removeGoal = useFinance((s) => s.removeGoal);
  
  const [newAccountOpen, setNewAccountOpen] = useState(false);
  const [accountName, setAccountName] = useState("");
  const [accountAmount, setAccountAmount] = useState(0);

  const period = periods.find((p) => p.status === "open");
  
  // Sumamos el dinero de las cuentas de ahorro
  const inAccounts = goals.reduce((acc, g) => acc + g.saved, 0);
  
  // Sumamos los rubros de la quincena marcados como "Ahorro"
  const savingsInPeriod = period
    ? period.categories
        .filter((c) => c.role === "life" || c.role === "debt")
        .reduce((acc, c) => acc + categoryTotal(c), 0)
    : 0;

  const totalAhorrado = inAccounts + savingsInPeriod;

  return (
    <div className="pb-24">
      <PageHeader
        title="Ahorro"
        lede="Aquí guardas el dinero que no vas a gastar."
      />

      <section className="hero-card p-5 mb-8">
        <p className="text-xs text-muted">Ahorro Total Acumulado</p>
        <p className="mt-1 font-display text-5xl leading-none tabular-nums text-good">{formatMoney(totalAhorrado)}</p>
        
        <div className="mt-4 flex flex-col gap-1 text-sm border-t border-line pt-3">
          <p className="flex justify-between">
            <span className="text-muted">En cuentas de ahorro:</span>
            <span className="font-medium">{formatMoney(inAccounts)}</span>
          </p>
          {savingsInPeriod > 0 && (
            <p className="flex justify-between text-green-400">
              <span>En rubros de esta quincena:</span>
              <span className="font-medium">{formatMoney(savingsInPeriod)}</span>
            </p>
          )}
        </div>
      </section>

      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-2xl">Tus Cuentas de Ahorro</h2>
        <Button variant="ghost" onClick={() => setNewAccountOpen(true)} className="text-gold bg-surface-2 px-3">
          <Plus className="size-4" /> Nueva
        </Button>
      </div>

      {goals.length === 0 ? (
        <p className="text-sm text-muted bg-surface-2 p-4 rounded-lg">
          Agrega una cuenta (como Cajita LAFISE o BAC) para empezar a trackear tu dinero guardado.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {goals.map((account) => (
            <div key={account.id} className="rounded-xl border border-line bg-surface p-4">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-medium text-lg">{account.name}</h3>
                <button onClick={() => removeGoal(account.id)} className="text-red-400 hover:text-red-300 p-1">
                  <Trash2 className="size-5" />
                </button>
              </div>
              
              <div className="flex items-center gap-2">
                <label className="text-sm text-muted">Saldo actual:</label>
                <div className="flex-1">
                  <MoneyField 
                    value={account.saved} 
                    onChange={(val) => updateGoal(account.id, { saved: val } as any)} 
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal para nueva cuenta */}
      <Modal open={newAccountOpen} onOpenChange={setNewAccountOpen}>
        <div className="p-5 flex flex-col gap-4">
          <h2 className="text-xl font-bold">Nueva Cuenta de Ahorro</h2>
          <input
            type="text"
            placeholder="Ej. Cuenta BAC, Cajita LAFISE..."
            value={accountName}
            onChange={(e) => setAccountName(e.target.value)}
            className="w-full rounded bg-surface-2 p-3 text-sm outline-none"
          />
          <div>
            <label className="text-xs text-muted mb-1 block">Monto inicial (opcional)</label>
            <MoneyField value={accountAmount} onChange={setAccountAmount} />
          </div>
          <Button 
            full 
            disabled={!accountName.trim()} 
            onClick={() => {
              // Usamos la estructura de metas, pero adaptada a cuentas
              addGoal({ name: accountName, target: 999999, saved: accountAmount, kind: "custom" });
              setNewAccountOpen(false);
              setAccountName("");
              setAccountAmount(0);
            }}
          >
            Crear Cuenta
          </Button>
        </div>
      </Modal>
    </div>
  );
}
