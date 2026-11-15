import { MoneyAmount } from "@/components/ui";
import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/shell";
import { useFinance } from "@/lib/store";
import {
  categoryPaidAmount, categoryPendingAmount, categoryTotal, formatRange,
  periodExpenses, periodSurplus, roleAmount, sortedPeriods,
} from "@/lib/finance";

export const Route = createFileRoute("/_app/historial")({
  component: HistorialPage,
});

function HistorialPage() {
  const periods = useFinance((s) => s.periods) || [];
  const closedPeriods = sortedPeriods(periods.filter((p) => p && p.status === "closed"));

  return (
    <div>
      <PageHeader title="Historial" lede="Tus quincenas anteriores y en qué se fue tu dinero." />

      {closedPeriods.length === 0 ? (
        <div className="card mt-8 p-8 text-center">
          <p className="text-muted text-sm">
            Aún no tienes quincenas cerradas. Cuando cierres una, aparecerá aquí.
          </p>
        </div>
      ) : (
        <div className="mt-6 flex flex-col gap-4">
          {closedPeriods.map((savedPeriod) => {
            const period = { ...savedPeriod, categories: savedPeriod.categories ?? [] };
            const categories = period.categories.filter((category) => categoryTotal(category) > 0);
            const expenses = periodExpenses(period);
            const surplus = periodSurplus(period);

            return (
              <article key={period.id} className="card min-w-0 p-5">
                <div className="flex justify-between items-start gap-3">
                  <h2 className="min-w-0 font-medium">
                    {formatRange(period.start, period.end)}
                    <span className="text-muted text-xs block mt-1">{period.start.slice(0, 4)}</span>
                  </h2>
                  <span className="text-xs bg-surface-2 px-2 py-1 rounded text-muted shrink-0">Cerrada</span>
                </div>

                <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-4 text-sm mt-4 border-t border-line pt-4">
                  <div><dt className="text-muted text-xs">Ingreso</dt><dd className="font-medium"><MoneyAmount value={period.income || 0} /></dd></div>
                  <div><dt className="text-muted text-xs">Gastos</dt><dd className="font-medium"><MoneyAmount value={expenses} outflow /></dd></div>
                  <div><dt className="text-muted text-xs">Día a día</dt><dd className="font-medium"><MoneyAmount value={roleAmount(period, "life")} outflow /></dd></div>
                  <div><dt className="text-muted text-xs">Apartado para ahorro</dt><dd className="font-medium"><MoneyAmount value={period.setAside || 0} /></dd></div>
                  <div><dt className="text-muted text-xs">Libre</dt><dd className="font-medium"><MoneyAmount value={surplus} /></dd></div>
                </dl>

                <section className="mt-5 border-t border-line pt-4" aria-label="Resumen de movimientos">
                  <h3 className="font-medium text-sm">Resumen de movimientos</h3>
                  <p className="text-xs text-muted mt-1">Conceptos registrados al cerrar la quincena.</p>
                  <div className="flex flex-wrap justify-between items-start gap-2 py-4 text-sm">
                    <span>Ingreso de la quincena</span>
                    <span className="font-medium whitespace-nowrap"><MoneyAmount value={period.income || 0} /></span>
                  </div>

                  {categories.length === 0 ? (
                    <p className="text-sm text-muted py-3">No hay conceptos de gastos guardados en esta quincena.</p>
                  ) : (
                    <ul className="divide-y divide-line">
                      {categories.map((category) => {
                        const paid = categoryPaidAmount(category);
                        const pending = categoryPendingAmount(category);
                        return (
                          <li key={category.id} className="py-4">
                            <div className="flex flex-wrap justify-between items-start gap-2 text-sm">
                              <h4 className="min-w-0 break-words font-medium">{category.name}</h4>
                              <span className="font-medium whitespace-nowrap"><MoneyAmount value={categoryTotal(category)} outflow /></span>
                            </div>
                            <ul className="mt-2 space-y-2">
                              {category.items.filter((item) => item.amount > 0).map((item) => (
                                <li key={item.id} className="flex justify-between items-start gap-3 text-xs">
                                  <span className="min-w-0 break-words text-muted">{item.name}</span>
                                  <span className="shrink-0 whitespace-nowrap"><MoneyAmount value={item.amount} outflow /></span>
                                </li>
                              ))}
                            </ul>
                            <p className="text-xs text-muted mt-3 flex flex-wrap gap-x-2 gap-y-1">
                              {pending === 0 ? <span>Pagado</span> : paid > 0 ? (
                                <><span>Abonado: <MoneyAmount value={paid} outflow /></span><span>Pendiente: <MoneyAmount value={pending} outflow /></span></>
                              ) : <span>Pendiente de pago al cierre</span>}
                            </p>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  {period.setAside > 0 ? (
                    <div className="border-t border-line pt-4 flex flex-wrap justify-between gap-2 text-sm">
                      <span>Apartado para ahorro</span>
                      <span className="font-medium whitespace-nowrap"><MoneyAmount value={period.setAside} /></span>
                    </div>
                  ) : null}
                </section>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
