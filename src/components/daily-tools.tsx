import { useMemo, useRef, useState, type FormEvent } from "react";
import { ArrowLeftRight, CalendarDays, Plus, Scale, Undo2 } from "lucide-react";
import { playFeedback } from "@/lib/feedback";
import { feedbackToast as toast } from "@/lib/feedback-toast";
import { Button, Modal } from "./ui";
import { categoryPendingAmount, formatMoney, type MoneyLocation, type Period } from "@/lib/finance";
import { balanceFlow, duplicateIds, expectedBalances, forecast, hasComparison, parseExpense, repeatedCharges, rounded, todayInManagua, type Movement } from "@/lib/daily";
import { useFinance } from "@/lib/store";

const place = { account: "Cuenta", cash: "Efectivo" };
const shortDate = (date: string) => date.slice(8, 10) + "/" + date.slice(5, 7);
type Tool = "expense" | "check" | "calendar" | null;

function undo(periodId: string, id: string) {
  if (useFinance.getState().undoMovement(periodId, id)) toast.undo("Movimiento enviado a la papelera");
  else toast.info("El rubro cambió o la quincena cerró. Revisá su movimiento más reciente.");
}

function saved(periodId: string, m: Movement) {
  toast.success(m.name + " · " + formatMoney(m.amount), { duration: 7500,
    action: { label: "Deshacer", onClick: () => undo(periodId, m.id) } });
}

function LocationSwitch({ value, change }: { value: MoneyLocation; change: (value: MoneyLocation) => void }) {
  return <div className="daily-switch" role="group" aria-label="Origen del dinero">
    {(["account", "cash"] as const).map(key => <button type="button" key={key} aria-pressed={value === key} onClick={() => change(key)}>{place[key]}</button>)}
  </div>;
}

function QuickExpense({ period, close }: { period: Period; close: () => void }) {
  const today = todayInManagua();
  const lastDate = today < period.end ? today : period.end.slice(0, 10);
  const [text, setText] = useState("");
  const [location, setLocation] = useState<MoneyLocation>(period.movements?.at(-1)?.location ?? "account");
  const [date, setDate] = useState(lastDate);
  const [categoryId, setCategoryId] = useState("");
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState("");
  const record = useFinance(s => s.recordExpense);
  const parsed = parseExpense(text);
  const target = period.categories.find(c => c.id === categoryId);
  const origin = target ? target.moneyLocation ?? "account" : location;
  const matches = parsed ? repeatedCharges(period.movements ?? [], parsed.name, parsed.amount, date) : [];
  const fingerprint = JSON.stringify([parsed, origin, date, categoryId, matches.map(m => m.id)]);
  const nextCharges = period.categories.filter(c => categoryPendingAmount(c) > 0);
  const recent = [...new Set((period.movements ?? []).filter(m => m.kind === "expense").slice(-8).reverse().map(m => m.amount + " " + m.name))].slice(0, 3);
  function submit(e: FormEvent) {
    e.preventDefault();
    if (!parsed) { setError("Escribí el monto y un concepto de hasta 40 caracteres."); playFeedback("warning"); return; }
    if (matches.length && confirm !== fingerprint) { setConfirm(fingerprint); playFeedback("warning"); return; }
    const result = record(period.id, { ...parsed, date, location: origin, categoryId }, confirm === fingerprint);
    if (result === "duplicate") { setConfirm(fingerprint); playFeedback("warning"); return; }
    if (result === "invalid") { setError("Revisá la fecha y que el gasto no supere el pendiente del rubro."); playFeedback("warning"); return; }
    saved(period.id, result); close();
  }
  return <form className="daily-form" onSubmit={submit}>
    <label>Monto y concepto<input autoFocus required maxLength={60} value={text} onChange={e => { setText(e.target.value); setError(""); }} placeholder="80 almuerzo" /></label>
    {recent.length > 0 && <div className="flex flex-wrap gap-2">{recent.map(v => <button type="button" className="daily-chip" key={v} onClick={() => setText(v)}>{v}</button>)}</div>}
    {target ? <p>Se aplicará al rubro desde {place[origin].toLowerCase()}.</p> : <LocationSwitch value={location} change={setLocation} />}
    <details><summary>Fecha y rubro</summary><div className="daily-form mt-3">
      <label>Fecha del gasto<input type="date" min={period.start.slice(0, 10)} max={lastDate} required value={date} onChange={e => setDate(e.target.value)} /></label>
      <label>Aplicar a<select value={categoryId} onChange={e => setCategoryId(e.target.value)}><option value="">Gasto adicional</option>
        {nextCharges.map(c => <option key={c.id} value={c.id}>{c.name} · faltan {formatMoney(categoryPendingAmount(c))}</option>)}
      </select></label>
    </div></details>
    {matches.length > 0 && <p role="status" className="daily-note">Posible cobro repetido. Ya figura {matches[0].name} por {formatMoney(matches[0].amount)} el {shortDate(date)} en {place[matches[0].location].toLowerCase()}. {confirm === fingerprint && "Confirmá solo si fue otro pago."}</p>}
    {error && <p role="alert" className="text-bad">{error}</p>}
    <Button type="submit">{matches.length && confirm === fingerprint ? "Registrar otro pago igual" : "Registrar gasto"}</Button>
  </form>;
}

function readAmount(raw: string, signed = false) {
  if (!(signed ? /^-?\d+(?:[.,]\d{1,3})?$/ : /^\d+(?:[.,]\d{1,3})?$/).test(raw.trim())) return null;
  const value = Number(raw.trim().replace(",", "."));
  return Math.abs(value) <= 100_000_000 ? value : null;
}

function Reconcile({ period }: { period: Period }) {
  const [cash, setCash] = useState("");
  const [account, setAccount] = useState("");
  const [edit, setEdit] = useState<"first" | "last" | undefined>();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const cashField = useRef<HTMLInputElement>(null);
  const removeLastCheck = useFinance(s => s.removeLastCheck);
  const [transfer, setTransfer] = useState("");
  const [from, setFrom] = useState<MoneyLocation>("account");
  const checkBalances = useFinance(s => s.checkBalances);
  const recordTransfer = useFinance(s => s.recordTransfer);
  const c = readAmount(cash), a = readAmount(account, true), t = readAmount(transfer);
  const record = period.reconciliation;
  const expected = record && edit !== "first" && expectedBalances(record.first, edit === "last" ? record.last.flow : balanceFlow(period));
  function clearForm() {
    setEdit(undefined); setCash(""); setAccount(""); setConfirmDelete(false);
  }
  function editCheck(which: "first" | "last") {
    if (!record) return;
    setConfirmDelete(false); setEdit(which);
    setCash(String(record[which].counted.cash)); setAccount(String(record[which].counted.account));
    cashField.current?.focus();
  }
  const lastExpected = record && expectedBalances(record.first, record.last.flow);
  function difference(count: number, estimate: number) {
    const delta = rounded(count - estimate);
    return delta === 0 ? "Coincide" : (delta < 0 ? "Faltan " : "Sobran ") + formatMoney(Math.abs(delta));
  }
  return <div className="daily-form">
    <p>{edit ? `Corregí las cantidades del ${edit === "first" ? "primer" : "último"} conteo del ${shortDate(record![edit].date)}.` : record ? "Compará lo que tenés con los movimientos registrados desde tu primer conteo." : "Anotá cuánto tenés ahora en cada lugar. Este primer conteo será la base de la quincena."}</p>
    <form className="daily-form" onSubmit={e => { e.preventDefault(); if (c !== null && a !== null && checkBalances(period.id, { cash: c, account: a }, edit)) {
      clearForm(); toast.success(edit ? "Conteo corregido" : record ? "Comparación guardada" : "Primer conteo guardado");
    } }}>
      {(["cash", "account"] as const).map(k => {
        const value = k === "cash" ? c : a;
        return <label key={k}>{k === "cash" ? "Efectivo contado" : "Saldo que muestra tu banco"}
          <input ref={k === "cash" ? cashField : undefined} inputMode="decimal" placeholder="C$ 0.00" required value={k === "cash" ? cash : account} onChange={e => (k === "cash" ? setCash : setAccount)(e.target.value)} />
          {expected && <small>Esperado {formatMoney(expected[k])}{value !== null && " · " + difference(value, expected[k])}</small>}
        </label>;
      })}
      <Button type="submit" disabled={a === null || c === null}>{edit ? "Guardar corrección" : record ? "Guardar comparación" : "Guardar primer conteo"}</Button>
      {edit && <Button variant="ghost" onClick={clearForm}>Cancelar edición</Button>}
    </form>
    {record && lastExpected && <div className="daily-note"><strong>Último conteo · {shortDate(record.last.date)}</strong>
      {(["cash","account"] as const).map(k => <p key={k}>{place[k]} · {formatMoney(record.last.counted[k])} · {difference(record.last.counted[k], lastExpected[k])}</p>)}
      {!edit && <div className="mt-2 flex flex-wrap gap-1">
        <Button variant="quiet" onClick={() => editCheck("last")}>Corregir conteo</Button>
        {hasComparison(record) && <Button variant="ghost" onClick={() => editCheck("first")}>Corregir primer conteo</Button>}
        <Button variant="ghost" onClick={() => setConfirmDelete(true)}>Borrar conteo</Button>
      </div>}
      {confirmDelete && <div className="mt-3"><p>{hasComparison(record) ? "¿Borrar el último conteo y volver al anterior disponible?" : "¿Borrar tu primer conteo y volver a ingresar los saldos iniciales?"}</p>
        <div className="flex flex-wrap gap-2"><Button variant="quiet" onClick={() => {
          if (removeLastCheck(period.id)) { clearForm(); toast.undo("Conteo borrado"); }
        }}>Sí, borrar conteo</Button><Button variant="ghost" onClick={() => setConfirmDelete(false)}>Cancelar</Button></div></div>}
    </div>}
    <details><summary><ArrowLeftRight className="inline size-4" /> Registrar traslado</summary>
      <form className="daily-form mt-3" onSubmit={e => { e.preventDefault(); if (!t) return; const m = recordTransfer(period.id, from, t); if (m) { saved(period.id, m); setTransfer(""); } }}>
        <label>Dirección<select value={from} onChange={e => setFrom(e.target.value as MoneyLocation)}><option value="account">Cuenta → Efectivo</option><option value="cash">Efectivo → Cuenta</option></select></label>
        <label>Monto trasladado<input inputMode="decimal" placeholder="C$ 0.00" value={transfer} onChange={e => setTransfer(e.target.value)} /></label>
        <Button variant="quiet" type="submit" disabled={!t || t <= 0}>Guardar traslado</Button>
      </form>
    </details>
  </div>;
}

function Calendar({ period }: { period: Period }) {
  const today = todayInManagua();
  const { dueThrough, rows, undated } = forecast(period, today);
  const setPayday = useFinance(s => s.setPayday);
  return <div className="daily-form">
    {period.income <= 0 && <details><summary>Fecha prevista de pago</summary>
      <label>Revisar vencimientos hasta<input type="date" value={dueThrough} onChange={e => { if (e.target.value) setPayday(period.id, e.target.value); }} /></label>
    </details>}
    <h3>Vencimientos hasta el {shortDate(dueThrough)}</h3>
    {rows.length === 0 && <p>Sin pagos pendientes con fecha hasta ese día.</p>}
    {rows.map(row => <div className="daily-row" key={row.id}><div><strong>{row.name}</strong><small>{shortDate(row.date)} · {row.date < today ? "Vencido" : row.date === today ? "Hoy" : "Pendiente"}</small></div>
      <div className="text-right"><strong>{formatMoney(row.amount)}</strong><small className={row.balance < 0 ? "text-bad" : ""}>Al pagar: {formatMoney(row.balance)}</small></div></div>)}
    {undated > 0 && <p>Además tenés {formatMoney(undated)} pendientes sin fecha.</p>}
    <p>El saldo proyectado toma en cuenta el dinero registrado y los pagos pendientes con fecha.</p>
  </div>;
}

export function DailyTools({ period }: { period: Period }) {
  const [tool, setTool] = useState<Tool>(null);
  const [showAll, setShowAll] = useState(false);
  const [onlyMatches, setOnlyMatches] = useState(false);
  const [query, setQuery] = useState("");
  const restore = useFinance(s => s.restoreMovement);
  const entries = period.movements;
  const future = period.start.slice(0, 10) > todayInManagua();
  const recent = useMemo(() => [...(entries ?? [])].reverse(), [entries]);
  const matches = useMemo(() => duplicateIds(entries ?? []), [entries]);
  const search = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const filtered = recent.filter(m => (!onlyMatches || !matches.size || matches.has(m.id)) &&
    search([m.name, m.date, shortDate(m.date), place[m.location], m.amount].join(" ")).includes(search(query.trim())));
  return <section className="daily-tools card" aria-label="Operaciones de la quincena">
    <div className="daily-actions">
      <Button disabled={future} title={future ? "Disponible al comenzar esta quincena" : undefined} aria-haspopup="dialog" onClick={() => setTool("expense")}><Plus className="size-4" /> Gasto rápido</Button>
      <Button variant="quiet" aria-haspopup="dialog" onClick={() => setTool("check")}><Scale className="size-4" /> Conciliar</Button>
      <Button variant="quiet" aria-haspopup="dialog" onClick={() => setTool("calendar")}><CalendarDays className="size-4" /> Calendario</Button>
    </div>
    {recent.length > 0 && <details className="mt-3"><summary>Movimientos de la quincena ({recent.length})</summary>
      <label className="daily-form mb-2">Buscar movimiento<input type="search" value={query} placeholder="Concepto, fecha o monto" onChange={e => setQuery(e.target.value)} /></label>
      {!filtered.length && <p className="text-sm text-muted">Ningún movimiento coincide.</p>}
      {matches.size > 0 && <Button variant="quiet" className="mb-2" aria-pressed={onlyMatches} onClick={() => setOnlyMatches(!onlyMatches)}>{onlyMatches ? "Mostrar todos los movimientos" : "Revisar posibles repetidos (" + matches.size + ")"}</Button>}
      {(showAll ? filtered : filtered.slice(0, 5)).map(m => <div className="daily-row" key={m.id}>
        <div><strong>{m.name}</strong><small>{shortDate(m.date)} · {place[m.location]}{m.kind === "transfer" ? " → " + place[m.location === "cash" ? "account" : "cash"] : ""}{matches.has(m.id) && " · Posible repetido"}</small></div>
        <span className={m.kind === "transfer" ? "" : m.amount >= 0 ? "text-bad" : "text-good"}>{formatMoney(m.kind === "transfer" ? m.amount : -m.amount)}</span>
        <button type="button" className="daily-undo" aria-label={"Deshacer " + m.name} onClick={() => undo(period.id, m.id)}><Undo2 className="size-4" /></button>
      </div>)}
      {filtered.length > 5 && <Button variant="ghost" onClick={() => setShowAll(!showAll)}>{showAll ? "Ver menos" : "Ver todos"}</Button>}
    </details>}
    {Boolean(period.trash?.length) && <details className="mt-2"><summary>Papelera de movimientos ({period.trash!.length})</summary>
      {[...period.trash!].reverse().map(({ movement: m, note }) => <div className="daily-row flex-wrap" key={m.id}>
        <div><strong>{m.name}</strong><small>{shortDate(m.date)} · {formatMoney(m.amount)} · {place[m.location]}</small>
        {note && <small>{note}</small>}</div>
        <Button variant="quiet" onClick={() => {
          if (restore(period.id, m.id)) toast.success("Movimiento restaurado");
          else toast.info("Revisá los abonos de este rubro. Restaurá primero el abono anterior y comprobá el monto del rubro.");
        }}>Restaurar</Button></div>)}
    </details>}
    <Modal open={tool !== null} onOpenChange={open => { if (!open) setTool(null); }} title={tool === "expense" ? "Gasto rápido" : tool === "check" ? "Conciliar saldos" : "Calendario de la quincena"}>
      {tool === "expense" ? <QuickExpense period={period} close={() => setTool(null)} /> : tool === "check" ? <Reconcile period={period} /> : tool === "calendar" ? <Calendar period={period} /> : null}
    </Modal>
  </section>;
}
