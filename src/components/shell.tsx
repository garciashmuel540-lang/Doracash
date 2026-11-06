import { createContext, useContext, useEffect, useState } from "react";
import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import { Home, PiggyBank, History, LineChart, Settings, Sun, Moon, Sparkles } from "lucide-react";
import { Toaster, toast } from "sonner";
import { cn } from "@/lib/cn";
import { useFinance, sanitizeData, importFinance } from "@/lib/store";
import { FinancialCompanions } from "./financial-companions";
import { MascotAvatar } from "./mascot-avatar";
import { Button, Modal, IconButton } from "@/components/ui";

const NAV = [
  { to: "/", label: "Quincena", icon: Home, exact: true },
  { to: "/ahorro", label: "Ahorros", icon: PiggyBank },
  { to: "/historial", label: "Historial", icon: History },
  { to: "/plan", label: "Plan", icon: LineChart },
];

type ShellContextValue = {
  openSettings: () => void;
  theme: "light" | "dark";
  setTheme: (theme: "light" | "dark") => void;
};

const ShellContext = createContext<ShellContextValue | null>(null);

export function useShell() {
  const ctx = useContext(ShellContext);
  if (!ctx) throw new Error("useShell must be used within Shell");
  return ctx;
}

export function Shell({ children }: { children: React.ReactNode }) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const theme = useFinance((state) => state.theme);
  const setTheme = useFinance((state) => state.setTheme);
  const path = useLocation().pathname;

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  return (
    <ShellContext.Provider value={{ openSettings: () => setSettingsOpen(true), theme, setTheme }}>
      <div className="mx-auto flex min-h-dvh max-w-6xl">
        {/* Barra Lateral (Escritorio) */}
        <aside className="hidden w-64 shrink-0 flex-col px-6 py-8 md:flex">
          <Brand />
          <nav className="mt-12 flex flex-col gap-2" aria-label="Secciones">
            {NAV.map((item) => {
              const active = item.exact ? path === item.to : path.startsWith(item.to);
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-h-12 items-center gap-3 rounded-2xl px-4 text-sm font-medium transition-all duration-200",
                    active 
                      ? "bg-gold text-gold-ink shadow-lg shadow-gold/20" 
                      : "text-muted hover:bg-surface hover:text-fg"
                  )}
                >
                  <Icon className={cn("size-5", active ? "text-white" : "")} />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="mt-auto pt-8">
            <Button variant="ghost" className="w-full justify-start gap-3 text-muted hover:text-gold" onClick={() => setSettingsOpen(true)}>
              <Settings className="size-5" /> Ajustes
            </Button>
            <p className="mt-4 text-xs text-pretty text-muted/60">
              Cada pago, un margen. Apartá antes de que se mezcle con el resto.
            </p>
          </div>
        </aside>

        {/* Contenido Principal */}
        <div className="min-w-0 flex-1 relative">
          <main className="px-4 pt-6 pb-40 md:px-8 md:pt-10 md:pb-44 min-h-dvh">
            {children}
          </main>
          

        </div>
      </div>

      {/* Barra de Navegación Flotante (Móvil) */}
      <nav
        className="fixed bottom-5 inset-x-4 z-30 glass-nav rounded-3xl md:hidden"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.35rem)" }}
        aria-label="Secciones móviles"
      >
        <div className="mx-auto flex max-w-lg items-center justify-around px-2 py-2">
          {NAV.map((item) => {
            const active = item.exact ? path === item.to : path.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 rounded-2xl px-3 py-2 transition-all duration-300",
                  active ? "text-gold bg-white/5" : "text-muted hover:text-fg"
                )}
              >
                <Icon className={cn("size-5 transition-transform", active && "scale-110")} />
                <span className="text-[10px] font-medium tracking-wide">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
      
      <Toaster
        position="top-center"
        theme={theme}
        toastOptions={{
          style: {
            background: "rgba(20, 45, 80, 0.85)",
            backdropFilter: "blur(12px)",
            border: "1px solid rgba(255, 255, 255, 0.15)",
            color: "var(--fg)",
            borderRadius: "1rem",
          },
        }}
      />
    </ShellContext.Provider>
  );
}

export function PageHeader({ title, lede }: { title: string; lede?: string }) {
  const { openSettings, theme, setTheme } = useShell();
  return (
    <header className="page-header mb-8">
      <div className="header-controls flex gap-0 bg-surface/50 rounded-full border border-line/50">
        <IconButton
          label={theme === "dark" ? "Usar tema claro" : "Usar tema oscuro"}
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="size-11 rounded-full hover:bg-white/10"
        >
          {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
        </IconButton>
        <IconButton label="Ajustes" onClick={openSettings} className="size-11 rounded-full hover:bg-white/10">
          <Settings className="size-4" />
        </IconButton>
      </div>
      <div className="page-heading min-w-0">
        <p className="text-[10px] font-bold tracking-[0.2em] text-gold uppercase mb-1">DORACASH · TU MUNDO FINANCIERO</p>
        <h1 className="font-display text-3xl md:text-4xl leading-tight text-fg drop-shadow-sm">{title}</h1>
      </div>
      <FinancialCompanions />
      {lede ? <p className="page-lede text-sm text-pretty text-muted">{lede}</p> : null}
    </header>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-3">
      <span className="brand-mascot"><MascotAvatar character="doraemon" /></span>
      <div>
        <p className="font-display text-2xl leading-none text-fg">Doracash</p>
        <p className="mt-1 text-[10px] uppercase tracking-widest text-gold/80 font-semibold">Un futuro con gustitos</p>
      </div>
    </div>
  );
}

// El diálogo de configuración se mantiene igual por ahora para no romper la lógica
function SettingsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [confirmReset, setConfirmReset] = useState(false);
  const [error, setError] = useState("");
  const reset = useFinance((state) => state.reset);

  useEffect(() => {
    if (!open) {
      setConfirmReset(false);
      setError("");
    }
  }, [open]);

  function download() {
    const { periods, goals, theme, introDismissed } = useFinance.getState();
    const blob = new Blob([JSON.stringify({ version: 1, periods, goals, theme, introDismissed }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "quincena-respaldo.json";
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Respaldo descargado");
  }

  function onFile(file: File | undefined) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (!sanitizeData(parsed)) {
          setError("Ese archivo no parece un respaldo de Doracash.");
          return;
        }
        importFinance(parsed);
        setError("");
        onOpenChange(false);
        toast.success("Respaldo restaurado");
      } catch {
        setError("No se pudo leer el archivo.");
      }
    };
    reader.readAsText(file);
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Ajustes" description="Todo queda guardado en este dispositivo.">
      <div className="flex flex-col gap-3">
        <Button variant="quiet" full onClick={download}>Descargar respaldo</Button>
        <label className="flex min-h-11 cursor-pointer items-center justify-center rounded-full bg-surface-2 px-5 text-sm font-medium">
          Restaurar respaldo
          <input type="file" accept="application/json,.json" className="sr-only" onChange={(event) => onFile(event.target.files?.[0])} />
        </label>
        {error ? <p className="text-sm text-bad">{error}</p> : null}
        {confirmReset ? (
          <div className="card p-4">
            <p className="text-sm text-pretty">Se borra lo que cargaste y vuelve el punto de partida.</p>
            <div className="mt-3 flex gap-2">
              <Button variant="primary" onClick={() => { reset(); setConfirmReset(false); onOpenChange(false); toast.success("Listo, volviste al inicio"); }}>Sí, reiniciar</Button>
              <Button variant="ghost" onClick={() => setConfirmReset(false)}>Cancelar</Button>
            </div>
          </div>
        ) : (
          <Button variant="danger" onClick={() => setConfirmReset(true)}>Volver al punto de partida</Button>
        )}
      </div>
    </Modal>
  );
}
