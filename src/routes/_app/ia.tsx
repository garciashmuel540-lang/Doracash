import { useState, useRef, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useFinance } from "@/lib/store";
import { periodExpenses, openPeriod } from "@/lib/finance";

export const Route = createFileRoute("/_app/ia")({
  component: IAChatPage,
});

type Message = { role: "user" | "ia"; text: string };

function IAChatPage() {
  const [mensajes, setMensajes] = useState<Message[]>([
    { role: "ia", text: "¡Hola! Soy tu asistente. ¿En qué te puedo ayudar hoy?" }
  ]);
  const [input, setInput] = useState("");
  const [cargando, setCargando] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  
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
    const contexto = {
      libre: (period?.income || 0) - (period ? periodExpenses(period) : 0),
      gastos: period ? periodExpenses(period) : 0,
      ahorro: data.goals.reduce((acc, g) => acc + g.saved, 0),
      metas: data.goals.map(g => `${g.name} (${g.saved}/${g.target})`).join(', ')
    };

    try {
      const res = await fetch("/api/chat-ia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mensaje: nuevoMensaje.text, contexto }),
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
    <div className="flex flex-col h-[calc(100vh-80px)] max-w-2xl mx-auto px-4">
      <header className="py-4 border-b border-line">
        <h1 className="font-display text-2xl flex items-center gap-2">
          <span className="text-2xl">✨</span> Asistente IA
        </h1>
      </header>

      <div className="flex-1 overflow-y-auto py-4 space-y-4">
        {mensajes.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm ${
              m.role === "user" ? "bg-[#1E90FF] text-white rounded-br-sm" : "bg-surface-2 text-fg rounded-bl-sm"
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
          placeholder="Pregúntame sobre tus finanzas..."
          className="flex-1 rounded-full bg-surface-2 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-gold"
        />
        <button
          onClick={enviar}
          disabled={cargando || !input.trim()}
          className="rounded-full bg-[#1E90FF] px-6 text-white font-bold disabled:opacity-50"
        >
          Enviar
        </button>
      </div>
    </div>
  );
}
