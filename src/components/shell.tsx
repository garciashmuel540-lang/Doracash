import { createContext, useContext, useEffect, useState, type CSSProperties } from "react";
import { Link, useLocation } from "@tanstack/react-router";
import { WalletCards, PiggyBank, History, LineChart, Settings, Sun, Moon, Sparkles, ArrowUpRight } from "lucide-react";
import { Toaster } from "sonner";
import { feedbackToast as toast } from "@/lib/feedback-toast";
import { cn } from "@/lib/cn";
import { useFinance, sanitizeData, importFinance } from "@/lib/store";
import { CloudSettings, useCloudFinance } from "./cloud-settings";
import { FinancialCompanions } from "./financial-companions";
import { InteractionFeedback } from "./interaction-feedback";
import { FeedbackSettings } from "./feedback-settings";
import { Button, Modal, IconButton } from "@/components/ui";

const NAV = [
  { to: "/", label: "Quincena", icon: WalletCards, exact: true },
  { to: "/ahorro", label: "Ahorros", icon: PiggyBank },
  { to: "/historial", label: "Historial", icon: History },
  { to: "/plan", label: "Plan", icon: LineChart },
  { to: "/ia", label: "Asistente", icon: Sparkles },
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
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "dark" ? "#0b2139" : "#e4f3ff");
  }, [theme]);

  return (
    <ShellContext.Provider value={{ openSettings: () => setSettingsOpen(true), theme, setTheme }}>
      <InteractionFeedback />
      <div className="app-frame">
      <a href="#main-content" className="skip-link">Ir al contenido</a>
      <div className="app-workspace mx-auto flex w-full max-w-7xl">
        {/* Barra Lateral (Escritorio) */}
        <aside className="desktop-sidebar hidden w-60 shrink-0 flex-col px-5 py-8 md:flex">
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
                    "nav-item flex min-h-12 items-center gap-3 rounded-2xl px-4 text-sm font-medium",
                    active 
                      ? "bg-gold text-gold-ink shadow-lg shadow-gold/20" 
                      : "text-muted hover:bg-surface hover:text-fg"
                  )}
                >
                  <Icon className="size-5" />
                  {item.label}
                  {active && <ArrowUpRight className="ml-auto size-4 opacity-70" />}
                </Link>
              );
            })}
          </nav>
          <div className="mt-auto pt-8">
            <Button aria-haspopup="dialog" variant="ghost" className="w-full justify-start gap-3 text-muted hover:text-gold" onClick={() => setSettingsOpen(true)}>
              <Settings className="size-5" /> Ajustes
            </Button>
          </div>
        </aside>

        {/* Contenido Principal */}
        <div className="min-w-0 flex-1 relative">
          <main id="main-content" tabIndex={-1} className="app-main px-4 pt-6 pb-8 md:px-8 md:pt-10">
            <div key={path} className="page-content">{children}</div>
          </main>
          

        </div>
      </div>

      {/* Barra de Navegación Flotante (Móvil) */}
      <nav
        className="mobile-navigation md:hidden"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.35rem)" }}
        aria-label="Secciones móviles"
      >
        <div className="mobile-nav-track mx-auto grid max-w-lg grid-cols-5 items-center px-2 py-2" style={{ "--nav-index": Math.max(0, NAV.findIndex(item => item.exact ? path === item.to : path.startsWith(item.to))) } as CSSProperties}>
          <span className="nav-indicator" aria-hidden="true" />
          {NAV.map((item) => {
            const active = item.exact ? path === item.to : path.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "nav-item flex min-h-12 min-w-0 flex-col items-center justify-center gap-1 rounded-2xl px-1 py-2",
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

      </div>
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
      
      <Toaster
        position="top-center"
        theme={theme}
        toastOptions={{
          style: {
            background: "var(--surface)",
            border: "1px solid var(--line)",
            color: "var(--fg)",
            borderRadius: "1.25rem",
            boxShadow: "var(--clay-lift)",
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
      <div className="header-controls flex gap-1 rounded-full p-1" role="group" aria-label="Apariencia y ajustes">
        <IconButton
          label={theme === "dark" ? "Usar tema claro" : "Usar tema oscuro"}
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="size-11 rounded-full hover:bg-white/10"
        >
          {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
        </IconButton>
        <IconButton aria-haspopup="dialog" label="Ajustes" onClick={openSettings} className="size-11 rounded-full hover:bg-white/10">
          <Settings className="size-4" />
        </IconButton>
      </div>
      <div className="page-heading min-w-0">
        <p className="page-eyebrow mb-2"><span className="wordmark-dot" aria-hidden="true" /> Doracash </p>
        <h1 className="font-display text-3xl md:text-4xl leading-tight text-fg">{title}</h1>
      </div>
      <FinancialCompanions />
      {lede ? <p className="page-lede text-sm text-pretty text-muted">{lede}</p> : null}
    </header>
  );
}

function Brand() {
  return (
    <div className="brand-lockup">
      <span className="brand-emblem" aria-hidden="true"><WalletCards className="size-6" /></span>
      <div>
        <p className="brand-name">doracash<span>.</span></p>
        <p className="brand-caption">Tu dinero, a tu ritmo.</p>
      </div>
    </div>
  );
}

function SettingsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const sync = useCloudFinance();
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
    <Modal open={open} onOpenChange={onOpenChange} title="Ajustes" description="Personalizá los efectos y administrá los datos de este dispositivo.">
      <div className="flex flex-col gap-3">
        <FeedbackSettings />
        <CloudSettings {...sync} />
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
              <Button variant="primary" onClick={() => { reset(); localStorage.removeItem("doracash-cards-v1"); setConfirmReset(false); onOpenChange(false); toast.success("Listo, volviste al inicio"); }}>Sí, reiniciar</Button>
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
