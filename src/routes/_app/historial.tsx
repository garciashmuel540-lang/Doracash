import { MoneyAmount } from "@/components/ui";
import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/shell";
import { useFinance } from "@/lib/store";
import {
  categoryPaidAmount, categoryPendingAmount, categoryTotal, formatRange, formatMoney,
  periodExpenses, periodSurplus, roleAmount, sortedPeriods,
} from "@/lib/finance";

export const Route = createFileRoute("/_app/historial")({
  component: HistorialPage,
});

function HistorialPage() {
  const periods = useFinance((s) => s.periods) || [];
  const closedPeriods = sortedPeriods(periods.filter((p) => p && p.status === "closed"));

  return (
    <div className="history-page">
      <PageHeader title="Historial" lede="Tus quincenas anteriores y en qué se fue tu dinero." />

      {closedPeriods.length === 0 ? (
        <div className="card mt-8 p-8 text-center">
          <p className="text-muted text-sm">
            Aún no tienes quincenas cerradas. Cuando cierres una, aparecerá aquí.
          </p>
        </div>
      ) : (
        <div className="mt-6 flex flex-col gap-4">
          {closedPeriods.map((savedPeriod, index) => {
            const period = { ...savedPeriod, categories: savedPeriod.categories ?? [] };
            const categories = period.categories.filter((category) => categoryTotal(category) > 0 || category.note?.trim());
            const expenses = periodExpenses(period);
            const surplus = periodSurplus(period);
            const previous = closedPeriods[index + 1];
            const previousExpenses = previous ? periodExpenses({ ...previous, categories: previous.categories ?? [] }) : 0;
            const change = Math.round((expenses - previousExpenses) * 1000) / 1000;

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
                  <div><dt className="text-muted text-xs">Pago recibido</dt><dd className="font-medium"><MoneyAmount value={period.income || 0} /></dd></div>
                  {Boolean(period.openingBalance) && <div><dt className="text-muted text-xs">Recibido del cierre anterior</dt><dd><MoneyAmount value={period.openingBalance!} /></dd></div>}
                  {period.carriedOut !== undefined && <div><dt className="text-muted text-xs">Saldo trasladado</dt><dd><MoneyAmount value={period.carriedOut} /></dd></div>}
                  <div><dt className="text-muted text-xs">Gastos</dt><dd className="font-medium"><MoneyAmount value={expenses} outflow /></dd></div>
                  <div><dt className="text-muted text-xs">Día a día</dt><dd className="font-medium"><MoneyAmount value={roleAmount(period, "life")} outflow /></dd></div>
                  <div><dt className="text-muted text-xs">Apartado para ahorro</dt><dd className="font-medium"><MoneyAmount value={period.setAside || 0} /></dd></div>
                  <div><dt className="text-muted text-xs">Libre</dt><dd className="font-medium"><MoneyAmount value={surplus} /></dd></div>
                </dl>

                {previous && <p className="daily-note mt-3 text-sm">
                  {change === 0 ? "Presupuestaste lo mismo en gastos" : `Presupuestaste ${formatMoney(Math.abs(change))} ${change > 0 ? "más" : "menos"} en gastos`}
                  {" que en la quincena del "}{formatRange(previous.start, previous.end)}.
                </p>}
                <details className="group mt-4 border-t border-line" aria-label="Resumen de movimientos">
                  <summary className="min-h-11 cursor-pointer rounded-lg py-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold">
                    <span className="group-open:hidden">Ver movimientos</span>
                    <span className="hidden group-open:inline">Ocultar movimientos</span>
                  </summary>
                  <p className="text-xs text-muted mt-1">Conceptos registrados al cerrar la quincena.</p>
                  <div className="flex flex-wrap justify-between items-start gap-2 py-4 text-sm">
                    <span>Pago de esta quincena{period.incomeReceivedOn && ` · ${period.incomeReceivedOn.split("-").reverse().join("/")}`}</span>
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
                            {category.note && <p className="mt-1 whitespace-pre-wrap break-words text-sm text-muted">{category.note}</p>}
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
                </details>
                {Boolean(period.movements?.length) && <details className="mt-2 border-t border-line">
                  <summary className="min-h-11 cursor-pointer py-3 text-sm font-medium">Actividad registrada ({period.movements!.length})</summary>
                  {[...period.movements!].reverse().map(m => <div className="daily-row" key={m.id}>
                    <div><strong>{m.name}</strong><small>{m.date.slice(8)}/{m.date.slice(5, 7)} · {m.location === "cash" ? "Efectivo" : "Cuenta"}</small></div>
                    {m.kind === "transfer" ? <span>Traslado · {formatMoney(m.amount)}</span> : <MoneyAmount value={-m.amount} />}
                  </div>)}
                </details>}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
