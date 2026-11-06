import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/shell";
import {
  buildInsights,
  formatMoney,
  monthExpenseEstimate,
  openPeriod,
  periodExpenses,
  periodSurplus,
  roleAmount,
  savingsRate,
} from "@/lib/finance";
import { useFinance } from "@/lib/store";

export const Route = createFileRoute("/_app/plan")({
  component: PlanPage,
});

function PlanPage() {
  const periods = useFinance((state) => state.periods);
  const goals = useFinance((state) => state.goals);
  const period = openPeriod({ periods });
  const [cut, setCut] = useState(0);

  if (!period) {
    return (
      <div>
        <PageHeader title="Plan" lede="Abrí una quincena para ver el plan." />
      </div>
    );
  }

  const income = period.income;
  const expenses = periodExpenses(period);
  const surplus = periodSurplus(period);
  const needs = roleAmount(period, "need") + roleAmount(period, "debt");
  const life = roleAmount(period, "life");
  const save = Math.max(0, surplus);
  const pct = (amount: number) => (income > 0 ? (amount / income) * 100 : 0);
  const month = monthExpenseEstimate(period, periods);
  const insights = buildInsights(period, periods, goals);
  const maxCut = expenses;
  const imagined = surplus + Math.min(cut, maxCut);
  const imaginedRate = income > 0 ? Math.round((imagined / income) * 100) : 0;
  const yearAll = Math.max(0, surplus) * 24;
  const yearPlan = period.setAside * 24;

  return (
    <div>
      <PageHeader
        title="Plan"
        lede="Una lectura simple de esta quincena, sin hoja de cálculo."
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <article className="hero-card p-4">
          <p className="text-xs text-muted">Si el mes se parece</p>
          <p className="mt-2 font-display text-3xl tabular-nums">{formatMoney(month)}</p>
          <p className="mt-2 text-sm text-pretty text-muted">
            Gastos estimados del mes. Sirve de marca para el fondo de emergencia.
          </p>
        </article>
        <article className="card p-4">
          <p className="text-xs text-muted">En 24 quincenas</p>
          <p className="mt-2 font-display text-3xl tabular-nums text-good">{formatMoney(yearAll)}</p>
          <p className="mt-2 text-sm text-pretty text-muted">
            {period.setAside > 0
              ? `Si solo cumplís el plan de ${formatMoney(period.setAside)}, serían ${formatMoney(yearPlan)}.`
              : "Si apartás todo el margen de esta quincena, cada pago."}
          </p>
        </article>
      </div>

      <section className="card mt-4 p-4">
        <h2 className="font-display text-2xl">Regla 50 / 30 / 20</h2>
        <p className="mt-1 text-sm text-pretty text-muted">
          Necesidades y compromisos cerca del 50%, día a día del 30%, ahorro del 20%. La marca vertical es la referencia.
        </p>
        {income <= 0 ? (
          <p className="mt-4 text-sm">Definí el ingreso para comparar.</p>
        ) : (
          <div className="mt-4 flex flex-col gap-4">
            <Meter label="Necesidades y compromisos" amount={needs} value={pct(needs)} target={50} />
            <Meter label="Día a día" amount={life} value={pct(life)} target={30} />
            <Meter label="Ahorro" amount={save} value={pct(save)} target={20} good />
          </div>
        )}
      </section>

      <section className="card mt-4 p-4">
        <h2 className="font-display text-2xl">Si gastás menos</h2>
        <p className="mt-1 text-sm text-muted">
          Un recorte imaginario de {formatMoney(cut)}. No cambia tus rubros: solo muestra el margen.
        </p>
        <input
          type="range"
          className="range mt-2"
          min={0}
          max={Math.max(50, maxCut)}
          step={50}
          value={Math.min(cut, maxCut)}
          aria-label="Recorte imaginario de gastos"
          style={{ ["--p" as string]: `${maxCut > 0 ? (Math.min(cut, maxCut) / Math.max(50, maxCut)) * 100 : 0}%` }}
          onChange={(event) => setCut(Number(event.target.value))}
        />
        <p className="text-sm">
          Te quedarían {formatMoney(imagined)} · {imaginedRate}% de ahorro.
        </p>
      </section>

      <section className="mt-4 flex flex-col gap-3">
        {insights.map((insight) => (
          <article key={insight.title} className="card p-4">
            <p
              className={
                insight.tone === "good" ? "text-sm font-medium text-good" : insight.tone === "bad" ? "text-sm font-medium text-bad" : "text-sm font-medium text-gold"
              }
            >
              {insight.title}
            </p>
            <p className="mt-1 text-sm text-pretty text-muted">{insight.body}</p>
          </article>
        ))}
      </section>
    </div>
  );
}

function Meter({
  label,
  amount,
  value,
  target,
  good,
}: {
  label: string;
  amount: number;
  value: number;
  target: number;
  good?: boolean;
}) {
  const width = Math.max(0, Math.min(100, value));
  const over = !good && value > target + 3;
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
        <span>{label}</span>
        <span className="tabular-nums text-muted">
          {Math.round(value)}% · {formatMoney(amount)}
        </span>
      </div>
      <div className="relative h-2 rounded-full bg-surface-2">
        <div
          className={over ? "h-full rounded-full bg-bad" : good ? "h-full rounded-full bg-good" : "h-full rounded-full bg-gold-fill"}
          style={{ width: `${width}%` }}
        />
        <span
          className="absolute top-[-3px] h-3.5 w-0.5 rounded-full bg-fg"
          style={{ left: `${target}%` }}
        />
      </div>
    </div>
  );
}
