import { useEffect, useRef, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { ChevronDown, MessageCircle, Send, Sparkles, X } from 'lucide-react';
import { useFinance } from '@/lib/store';
import { formatMoney, openPeriod } from '@/lib/finance';
import { advisorContext } from '@/lib/advisor';
import { companionAdvice, claimAdvice } from '@/lib/companion-advice';
import { CornerMascot } from './roaming-mascot';

type Character = 'doraemon' | 'shinchan';
export function FinancialCompanions() {
  const periods = useFinance(s => s.periods);
  const goals = useFinance(s => s.goals);
  const context = advisorContext(openPeriod({ periods }), goals);
  const fingerprint = JSON.stringify(context);
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const advice = companionAdvice(context);
  const adviceKey = advice ? `${context.inicio}:${new Date().toDateString()}:${advice.kind}` : null;
  const showingNotice = !open && notice === adviceKey && advice !== null;
  const [character, setCharacter] = useState<Character>('doraemon');
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const update = () => setVisible(!document.hidden);
    update(); document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);
  const controller = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (open || !visible || !adviceKey) return;
    const timer = window.setTimeout(() => {
      // Do not interrupt editing or another dialog.
      if (document.querySelector('[role="dialog"]') || /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || '')) return;
      if (!claimAdvice(adviceKey)) return;
      setCharacter(Math.random() < .5 ? 'doraemon' : 'shinchan');
      setNotice(adviceKey);
    }, 3000);
    return () => window.clearTimeout(timer);
  }, [adviceKey, open, visible]);
  useEffect(() => { controller.current?.abort(); setBusy(false); setAnswer(''); setError(''); }, [fingerprint, character]);
  useEffect(() => () => controller.current?.abort(), []);
  const toggleRef = useRef<HTMLButtonElement>(null);
  function close() { setOpen(false); setNotice(null); toggleRef.current?.focus(); }
  function toggle() {
    setNotice(null);
    if (!open) setCharacter(Math.random() < .5 ? 'doraemon' : 'shinchan');
    setOpen(value => !value);
  }
  async function ask(message: string) {
    if (busy || !message.trim()) return;
    const abort = new AbortController(); controller.current = abort;
    setBusy(true); setError(''); setAnswer('');
    try {
      const res = await fetch('/api/chat-ia', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: abort.signal,
        body: JSON.stringify({ mensaje: message, contexto: context, personaje: character }) });
      const result = await res.json();
      if (!res.ok || !result.ok) throw new Error(result.error || 'La IA no está disponible. Inténtalo de nuevo.');
      setAnswer(result.respuesta); setQuestion('');
    } catch (e) { if (!abort.signal.aborted) setError(e instanceof Error ? e.message : 'No se pudo conectar con la IA.'); }
    finally { if (!abort.signal.aborted) setBusy(false); }
  }
  const name = character === 'doraemon' ? 'Doraemon' : 'Shin Chan';
  return <aside className="companions" data-active={open || showingNotice} onKeyDown={e => { if (e.key === 'Escape') close(); }} data-motion={visible ? "playing" : "paused"} aria-label="Compañeros financieros">
    <div className="companion-dock">
      <button ref={toggleRef} className="companion-restore" aria-expanded={open} onClick={toggle}><MessageCircle size={18} /> Compañeros</button>
      {(open || showingNotice) && <div className="companion-characters"><CornerMascot character={character} expanded={open} mood={busy ? 'thinking' : showingNotice || answer ? 'talking' : 'hello'} onActivate={() => { setNotice(null); setOpen(true); }} /></div>}
    </div>
    {showingNotice && <div className="companion-bubble" role="status">
      <div><strong>{name}</strong><p>{advice.text} <strong>{formatMoney(advice.amount)}</strong>. {advice.action}</p></div>
      <button className="companion-icon" aria-label="Cerrar consejo" onClick={close}><X size={18} /></button>
    </div>}
    {open && <section className="companion-panel" aria-label={`Consejos de ${name}`} onKeyDown={e => { if (e.key === 'Escape') setOpen(false); }}>
      <header className="companion-header"><div><p className="companion-eyebrow">TU EQUIPO FINANCIERO</p><h2>{name} te acompaña</h2></div><button className="companion-icon" aria-label="Minimizar compañeros" onClick={close}><ChevronDown size={20} /></button></header>
      <div className="companion-tabs" role="group" aria-label="Elegir compañero">
        {(['doraemon', 'shinchan'] as const).map(c => <button key={c} aria-pressed={c === character} onClick={() => { setCharacter(c); }}><span>{c === 'doraemon' ? 'Doraemon' : 'Shin Chan'}<small>{c === 'doraemon' ? 'Tu bolsillo del futuro' : 'Gustitos con cabeza'}</small></span></button>)}
      </div>
      <div className="companion-scroll">
        <p className="companion-eyebrow"><Sparkles size={13} /> CÁLCULO CON TUS DATOS</p>
        {!context.hayQuincena || context.ingreso <= 0 ? <p className="companion-copy">Abre tu quincena y registra tus ingresos y compromisos. Así podremos orientarte sin inventar montos.</p> : context.libre < 0 ? <p className="companion-copy">Tus asignaciones superan el ingreso por <strong>{formatMoney(-context.libre)}</strong>. Revisa los gastos y pagos pendientes antes de añadir compras o ahorro.</p> : <>
          <p className="companion-copy">Después de los gastos, compromisos y ahorro registrados, quedan <strong>{formatMoney(context.libre)}</strong> por asignar.</p>
          <div className="companion-budget"><div><span>Ahorro adicional</span><strong>{formatMoney(context.ahorroSugerido)}</strong></div><div><span>Reserva para pendientes</span><strong>{formatMoney(context.reservaSugerida)}</strong></div><div><span>Tope para gustitos</span><strong>{formatMoney(context.gustosSugeridos)}</strong></div></div>
          <p className="companion-note">Propuesta conservadora: hasta 10% del ingreso para ahorrar; del resto, 80% de reserva y 20% para gustos. Confirma que registraste todos tus pagos. No mueve dinero.</p>
        </>}
        <p className="companion-note">No tenemos límite, saldo, tasa ni fechas de tu tarjeta. Sin esos datos no podemos calcular una compra segura a crédito.</p>
        <button className="companion-primary" disabled={busy || !context.hayQuincena || context.ingreso <= 0} onClick={() => ask('Analiza mi quincena y dame tres recomendaciones concretas de ahorro, gastos y gustitos. Usa los cálculos y explica qué datos faltan.')}><Sparkles size={16} />{busy ? 'Consultando la IA…' : 'Pedir consejo a la IA'}</button>
        {answer && <div className="companion-answer" role="status"><strong>{name}</strong><p>{answer}</p></div>}
        {error && <p role="alert" className="companion-error">{error}</p>}
      </div>
      <form className="companion-form" onSubmit={e => { e.preventDefault(); void ask(question); }}><input ref={inputRef} aria-label={`Pregunta a ${name}`} maxLength={1200} placeholder="¿Cómo organizo mi dinero?" value={question} onChange={e => setQuestion(e.target.value)} /><button className="companion-icon" aria-label="Enviar pregunta" disabled={busy || !question.trim()}><Send size={18} /></button></form>
      <footer className="companion-footer"><Link to="/ia" onClick={() => setOpen(false)}>Abrir chat completo</Link><button onClick={close}><X size={13} /> Ocultar mascotas</button></footer>
    </section>}

  </aside>;
}
