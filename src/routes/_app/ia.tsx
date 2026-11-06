import { useState, useRef, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useFinance } from "@/lib/store";
import { advisorContext } from "@/lib/advisor";
import { PageHeader } from "@/components/shell";
import { openPeriod } from "@/lib/finance";

export const Route = createFileRoute("/_app/ia")({
  component: IAChatPage,
});

import { useCardContext } from "@/lib/use-card-context";

type Message = { role: "user" | "ia"; text: string };

function IAChatPage() {
  const [mensajes, setMensajes] = useState<Message[]>([
    { role: "ia", text: "¡Hola! Soy tu asistente. ¿En qué te puedo ayudar hoy?" }
  ]);
  const [personaje, setPersonaje] = useState<"doraemon" | "shinchan">("doraemon");
  const [input, setInput] = useState("");
  const [cargando, setCargando] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  
  const tarjeta = useCardContext();
  const data = useFinance((s) => s);
  const period = openPeriod(data);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensajes]);

  async function enviar() {
    if (!input.trim() || cargando) return;
    
    const nuevoMensaje: Message = { role: "user", text: input };
    setMensajes((m) => [...m, nuevoMensaje]);
    setInput("");
    setCargando(true);

    // Preparamos los datos reales para la IA
    const contexto = advisorContext(period, data.goals, tarjeta || null);

    try {
      const res = await fetch("/api/chat-ia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(30000),
        body: JSON.stringify({ mensaje: nuevoMensaje.text, contexto, personaje }),
      });
      const json = await res.json();
      
      if (json.ok) {
        setMensajes((m) => [...m, { role: "ia", text: json.respuesta }]);
      } else {
        setMensajes((m) => [...m, { role: "ia", text: `⚠️ ${json.error}` }]);
      }
    } catch (e) {
      setMensajes((m) => [...m, { role: "ia", text: `⚠️ Error de red` }]);
    } finally {
      setCargando(false);
    }
  }

  return (
    <>
      <PageHeader title="Tu equipo financiero" />
      <div className="flex flex-col min-h-96 max-w-2xl mx-auto">
      <header className="py-4 border-b border-line">
        <div className="companion-tabs mt-4">{(["doraemon", "shinchan"] as const).map(c => <button key={c} aria-pressed={personaje === c} onClick={() => setPersonaje(c)}>{c === "doraemon" ? "Doraemon" : "Shin Chan"}</button>)}</div>
      </header>

      <div className="flex-1 min-h-64 overflow-y-auto py-4 space-y-4">
        {mensajes.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] break-words whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm ${
              m.role === "user" ? "bg-gold text-gold-ink rounded-br-sm" : "bg-surface-2 text-fg rounded-bl-sm"
            }`}>
              {m.text}
            </div>
          </div>
        ))}
        {cargando && <div className="text-sm text-muted animate-pulse">Escribiendo...</div>}
        <div ref={endRef} />
      </div>

      <div className="py-4 border-t border-line flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && enviar()}
          aria-label="Pregunta a tu compañero financiero"
          placeholder="Pregúntame sobre tus finanzas..."
          className="min-w-0 flex-1 rounded-full bg-surface-2 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-gold"
        />
        <button
          onClick={enviar}
          disabled={cargando || !input.trim()}
          className="shrink-0 rounded-full bg-gold px-4 text-gold-ink font-bold disabled:opacity-50"
        >
          Enviar
        </button>
      </div>
      </div>
    </>
  );
}
