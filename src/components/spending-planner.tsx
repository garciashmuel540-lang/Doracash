import { useState } from "react";
import { Calculator, GraduationCap } from "lucide-react";
import { Button, Modal, MoneyField } from "./ui";
import { periodFunds, formatMoney, type Period } from "@/lib/finance";
import { dailyAllowance, forecast, rounded, todayInManagua } from "@/lib/daily";
import { useFinance } from "@/lib/store";
import { feedbackToast as toast } from "@/lib/feedback-toast";

function SundayForm({ period, close }: { period: Period; close: () => void }) {
  const [plan, setPlan] = useState(period.sundays ?? { fare: 0, food: 0, excluded: [] as string[] });
  const [page, setPage] = useState(0);
  const setSundayPlan = useFinance(s => s.setSundayPlan);
  const { sundays } = forecast({ ...period, sundays: plan }, todayInManagua());
  const dates = Array.from({ length: Math.min(5, Math.max(0, sundays.count - page * 5)) }, (_, i) =>
    new Date(sundays.firstSunday + (page * 5 + i) * 7 * 86400000).toISOString().slice(0, 10));
  return <div className="daily-form">
    <p>¿Cuánto necesitás para un domingo de clase en la UNAN? Incluí solo lo que aún no reservaste en otro rubro.</p>
    <div>Pasaje de ida y vuelta<MoneyField label="Pasaje de ida y vuelta" value={plan.fare} onChange={fare => setPlan({ ...plan, fare })} /></div>
    <div>Comida del domingo<MoneyField label="Comida del domingo" value={plan.food} onChange={food => setPlan({ ...plan, food })} /></div>
    {dates.length > 0 && <fieldset><legend>Domingos por cubrir esta quincena</legend>
      <p>Desmarcá los que ya pagaste o no vas a cursar.</p>
      {dates.map(date => <label key={date} className="sunday-date">
        <input type="checkbox" checked={!plan.excluded.includes(date)} onChange={e =>
          setPlan({ ...plan, excluded: e.target.checked ? plan.excluded.filter(d => d !== date) : [...plan.excluded, date] })} />
        {new Intl.DateTimeFormat("es-NI", { day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(date))}
      </label>)}
      {page > 0 && <Button variant="ghost" onClick={() => setPage(page - 1)}>Anteriores</Button>}
      {(page + 1) * 5 < sundays.count && <Button variant="ghost" onClick={() => setPage(page + 1)}>Siguientes</Button>}
    </fieldset>}
    <p className="daily-note" role="status">Reserva para {sundays.remaining} {sundays.remaining === 1 ? "domingo" : "domingos"} · <strong>{formatMoney(sundays.reserve)}</strong></p>
    <Button onClick={() => { setSundayPlan(period.id, plan); toast.success("Reserva dominical guardada"); close(); }}>Guardar reserva</Button>
  </div>;
}

export function SpendingPlanner({ period }: { period: Period }) {
  const [panel, setPanel] = useState<"sundays" | "purchase" | null>(null);
  const [price, setPrice] = useState(0);
  const { daily, days, available, sundays } = forecast(period, todayInManagua());
  const hasFunds = periodFunds(period) > 0;
  const after = rounded(available - price);
  const afterDaily = dailyAllowance(after, days);
  return <details className="card spending-tools" aria-label="Plan de gasto diario">
    <summary>Planificar mis gastos</summary>
    {hasFunds && daily !== null && <details className="mt-2 text-sm">
      <summary className="cursor-pointer py-2">¿Cuánto puedo gastar por día?</summary>
      <p className="text-muted">Si repartís el saldo libre entre los {days} {days === 1 ? "día que queda" : "días que quedan"} de esta quincena, son <strong>{formatMoney(daily)} por día</strong>.</p>
    </details>}
    {sundays.reserve > 0 && <p className="mt-1 text-xs text-muted">{formatMoney(sundays.reserve)} reservados para domingos de clase.</p>}
    <div className="daily-actions mt-3">
      <Button variant="quiet" disabled={!hasFunds} aria-haspopup="dialog" onClick={() => { setPrice(0); setPanel("purchase"); }}><Calculator className="size-4" /> ¿Me alcanza?</Button>
      <Button variant="quiet" aria-haspopup="dialog" onClick={() => setPanel("sundays")}><GraduationCap className="size-4" /> Domingos UNAN</Button>
    </div>
    <Modal open={panel !== null} onOpenChange={open => { if (!open) setPanel(null); }} title={panel === "sundays" ? "Domingos UNAN" : "¿Me alcanza?"}>
      {panel === "sundays" ? <SundayForm period={period} close={() => setPanel(null)} /> : <div className="daily-form">
        <p>Probá el precio de una compra antes de hacerla. La simulación no registra un gasto.</p>
        <div>Precio de la compra<MoneyField label="Precio de la compra" value={price} onChange={setPrice} /></div>
        <div className="daily-note" role="status">{price <= 0 ? `Disponible para compras: ${formatMoney(available)}.` : after < 0 ?
          <strong>Te faltarían {formatMoney(-after)}.</strong> : <><strong>Te alcanza. Te quedarían {formatMoney(after)}.</strong>
          {afterDaily !== null && <p>Podrías gastar {formatMoney(afterDaily)} por día durante el resto de esta quincena.</p>}</>}</div>
      </div>}
    </Modal>
  </details>;
}
