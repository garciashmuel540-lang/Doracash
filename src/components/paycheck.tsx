import { useState } from "react";
import { Button, Modal, MoneyField } from "./ui";
import { formatMoney, todayInManagua, type Period } from "@/lib/finance";
import { useFinance } from "@/lib/store";
import { feedbackToast as toast } from "@/lib/feedback-toast";

function PaycheckForm({ period, close }: { period: Period; close: () => void }) {
  const editing = period.income > 0;
  const [amount, setAmount] = useState(period.income);
  const [date, setDate] = useState(period.incomeReceivedOn ?? (editing ? "" : todayInManagua()));
  const save = useFinance(s => s.savePaycheck);
  return <form className="daily-form" onSubmit={e => {
    e.preventDefault();
    if (!save(period.id, amount, date || undefined)) {
      toast.error("Revisá el monto, la fecha y la quincena abierta.");
      return;
    }
    toast.success(amount > 0 ? "Pago de la quincena guardado" : "Pago retirado de esta quincena");
    close();
  }}>
    <div>¿Cuánto te pagaron?<MoneyField label="Monto del pago recibido" value={amount} onChange={setAmount} /></div>
    <label>Fecha en que te pagaron<input type="date" value={date} max={todayInManagua()} required={!editing} onChange={e => setDate(e.target.value)} /></label>
    {editing && amount === 0 && <p>Al guardar, esta quincena volverá a quedar pendiente de pago. Tus gastos seguirán anotados.</p>}
    <Button type="submit" disabled={!editing && amount <= 0}>{editing && amount === 0 ? "Quitar pago recibido" : "Guardar pago"}</Button>
  </form>;
}

export function Paycheck({ period }: { period: Period }) {
  const [open, setOpen] = useState(false);
  const received = period.income > 0;
  return <div className="paycheck-summary">
    <div className="paycheck-copy">
      <p className="balance-income-label">{received ? "Pago recibido de esta quincena" : "Pago de esta quincena"}</p>
      {received && <p className="mt-1 font-display text-2xl tabular-nums">{formatMoney(period.income)}</p>}
      {received && period.incomeReceivedOn && <p className="text-xs text-muted">Recibido el <time dateTime={period.incomeReceivedOn}>{period.incomeReceivedOn.split("-").reverse().join("/")}</time></p>}
    </div>
    <Button className="mt-2" variant={received ? "quiet" : "primary"} aria-haspopup="dialog" onClick={() => setOpen(true)}>
      {received ? "Editar pago recibido" : "Registrar mi pago"}
    </Button>
    <Modal open={open} onOpenChange={setOpen} title={received ? "Editar pago recibido" : "Registrar mi pago"}>
      {open && <PaycheckForm period={period} close={() => setOpen(false)} />}
    </Modal>
  </div>;
}
