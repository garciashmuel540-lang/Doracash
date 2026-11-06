import { useState, useRef, useEffect } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { ArrowUpRight, MessageCircle, Send, Sparkles } from 'lucide-react';
import { useFinance } from '@/lib/store';
import { advisorContext } from '@/lib/advisor';
import { PageHeader } from '@/components/shell';
import { AdvisorMessage } from '@/components/advisor-message';
import { Button } from '@/components/ui';
import { openPeriod } from '@/lib/finance';
import { useCardContext } from '@/lib/use-card-context';
import { recentChatHistory } from '@/lib/chat-history';

export const Route = createFileRoute('/_app/ia')({ component: IAChatPage });
type Character = 'doraemon' | 'shinchan';
type Message = { role: 'user' | 'model'; text: string };
const prompts = ['¿Cómo puedo ahorrar esta quincena?', 'Ayúdame a ordenar mis gastos', '¿Tengo margen para un gustito?'];

function IAChatPage() {
  const [conversations, setConversations] = useState<Record<Character, Message[]>>({ doraemon: [], shinchan: [] });
  const [personaje, setPersonaje] = useState<Character>('doraemon');
  const [input, setInput] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const tarjeta = useCardContext();
  const periods = useFinance(s => s.periods);
  const goals = useFinance(s => s.goals);
  const mensajes = conversations[personaje];
  const name = personaje === 'doraemon' ? 'Doraemon' : 'Shin Chan';

  useEffect(() => () => requestRef.current?.abort(), []);
  useEffect(() => {
    if (mensajes.length) endRef.current?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'nearest' });
  }, [mensajes, cargando]);

  async function enviar(text = input) {
    const message = text.trim();
    if (!message || cargando || requestRef.current) return;
    const abort = new AbortController();
    requestRef.current = abort;
    const nuevoMensaje: Message = { role: 'user', text: message };
    setConversations(current => ({ ...current, [personaje]: [...current[personaje], nuevoMensaje] }));
    setInput(''); setError(''); setCargando(true);
    try {
      const res = await fetch('/api/chat-ia', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.any([abort.signal, AbortSignal.timeout(30000)]),
        body: JSON.stringify({ mensaje: message, contexto: advisorContext(openPeriod({ periods }), goals, tarjeta || null), personaje, historial: recentChatHistory(mensajes) }),
      });
      const result = await res.json();
      if (!res.ok || !result.ok || typeof result.respuesta !== 'string') throw new Error(result.error || 'La IA no pudo responder. Inténtalo de nuevo.');
      if (!abort.signal.aborted) setConversations(current => ({ ...current, [personaje]: [...current[personaje], { role: 'model', text: result.respuesta }] }));
    } catch (e) {
      if (!abort.signal.aborted) {
        setConversations(current => ({ ...current, [personaje]: current[personaje].slice(0, -1) }));
        setError(e instanceof Error ? e.message : 'No se pudo conectar con la IA.'); setInput(message);
      }
    } finally {
      requestRef.current = null;
      if (!abort.signal.aborted) { setCargando(false); inputRef.current?.focus(); }
    }
  }

  return <>
    <PageHeader title="Tu equipo financiero" lede="Una conversación para poner tus números en orden." />
    <section className="chat-card card" aria-label="Chat financiero">
      <header className="chat-header">
        <div className="companion-tabs" role="group" aria-label="Elegir asistente">
          {(['doraemon', 'shinchan'] as const).map(c => <button key={c} aria-pressed={personaje === c} disabled={cargando} onClick={() => { setPersonaje(c); setError(''); }}><span>{c === 'doraemon' ? 'Doraemon' : 'Shin Chan'}<small>{c === 'doraemon' ? 'Planifica tu futuro' : 'Disfruta con equilibrio'}</small></span></button>)}
        </div>
        <span className="chat-private"><span className="companion-online" /> Con tus datos registrados</span>
      </header>
      <div className="chat-messages" role="log" aria-label={`Conversación con ${name}`} aria-live="polite" aria-busy={cargando}>
        {!mensajes.length && <div className="chat-welcome">
          <span className="chat-welcome-icon"><MessageCircle size={26} /></span>
          <p className="page-eyebrow">UN POCO DE CLARIDAD</p>
          <h2>Tu dinero, en conversación.</h2>
          <p>Soy {name}. Revisemos tus gastos, tus ahorros o ese gustito que tienes en mente.</p>
          <div className="chat-suggestions">{prompts.map(prompt => <button key={prompt} onClick={() => void enviar(prompt)}>{prompt}<ArrowUpRight size={16} /></button>)}</div>
        </div>}
        {mensajes.map((m, i) => <div key={i} className={`chat-message ${m.role === 'user' ? 'chat-message-user' : 'chat-message-advisor'}`}>
          <span className="chat-message-label">{m.role === 'user' ? 'Tú' : name}</span>
          {m.role === 'model' ? <AdvisorMessage text={m.text} /> : <p className="whitespace-pre-wrap">{m.text}</p>}
        </div>)}
        {cargando && <div className="chat-thinking" role="status"><Sparkles size={16} /><span>{name} está preparando tu respuesta</span><span className="typing-dots" aria-hidden="true"><i /><i /><i /></span></div>}
        <div ref={endRef} />
      </div>
      {error && <p role="alert" className="chat-error">{error}</p>}
      <form className="chat-composer" onSubmit={e => { e.preventDefault(); void enviar(); }}>
        <input ref={inputRef} value={input} maxLength={1200} onChange={e => setInput(e.target.value)} aria-label="Pregunta a tu compañero financiero" placeholder="Hablemos de tus finanzas…" />
        <Button type="submit" disabled={cargando || !input.trim()}><Send size={16} /><span className="hidden sm:inline">Enviar</span></Button>
      </form>
      <p className="chat-footnote">Orientación con tus registros. No mueve dinero ni consulta tu banco.</p>
    </section>
  </>;
}
