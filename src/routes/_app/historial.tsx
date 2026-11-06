import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/shell";
import { useFinance } from "@/lib/store";
import { formatMoney, periodExpenses, periodSurplus } from "@/lib/finance";

export const Route = createFileRoute("/_app/historial")({
  component: HistorialPage,
});

function HistorialPage() {
  const periods = useFinance((s) => s.periods) || [];
  
  // Filtramos solo los periodos cerrados (el historial)
  const closedPeriods = periods.filter((p) => p && p.status === "closed");

  return (
    <div>
      <PageHeader
        title="Historial"
        lede="Tus quincenas anteriores."
      />

      {closedPeriods.length === 0 ? (
        <div className="card mt-8 p-8 text-center">
          <p className="text-muted text-sm">
            Aún no tienes quincenas cerradas. Cuando cierres una, aparecerá aquí.
          </p>
        </div>
      ) : (
        <div className="mt-6 flex flex-col gap-4">
          {closedPeriods.map((period) => {
            // Validación por si algún periodo viejo no tiene categorías
            const expenses = period.categories ? periodExpenses(period) : 0;
            const surplus = period.categories ? periodSurplus(period) : 0;
            
            return (
              <div key={period.id} className="card p-5">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-medium">
                    {new Date(period.start).toLocaleDateString()} - {new Date(period.end).toLocaleDateString()}
                  </h3>
                  <span className="text-xs bg-surface-2 px-2 py-1 rounded text-muted">Cerrada</span>
                </div>
                
                <div className="flex justify-between text-sm mt-4 border-t border-line pt-3">
                  <div>
                    <p className="text-muted text-xs">Ingreso</p>
                    <p className="font-medium">{formatMoney(period.income || 0)}</p>
                  </div>
                  <div>
                    <p className="text-muted text-xs">Gastos</p>
                    <p className="font-medium">{formatMoney(expenses)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-muted text-xs">Libre</p>
                    <p className="font-medium text-good">{formatMoney(surplus)}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
