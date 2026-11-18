import { createClient } from "@supabase/supabase-js";
import { useFinance, sanitizeData } from "./store";
import type { Data } from "./finance";

type Snapshot = Pick<Data, "periods" | "goals" | "theme"> & { introDismissed: boolean };
const url = import.meta.env.VITE_DORACASH_SUPABASE_URL;
const key = import.meta.env.VITE_DORACASH_SUPABASE_KEY;
export const cloud = typeof window !== "undefined" && url && key
  ? createClient(String(url), String(key), { auth: { storageKey: "doracash-auth-v1", detectSessionInUrl: false } })
  : null;

function localSnapshot(): Snapshot {
  const persisted = localStorage.getItem("finanzas-store");
  const data = persisted === null ? useFinance.getState() : JSON.parse(persisted).state;
  if (!sanitizeData(data)) throw new Error("No se pudo verificar la copia local. Se conserva en este dispositivo.");
  return { periods: data.periods, goals: data.goals, theme: data.theme, introDismissed: !!data.introDismissed };
}

function canonical(data: unknown): string {
  return JSON.stringify(data, (_key, value) => {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return Object.fromEntries(Object.keys(value).sort().map(k => [k, value[k]]));
    }
    return value;
  });
}

async function digest(text: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, "0")).join("");
}

export function monitorFinance(userId: string, status: (message: string) => void) {
  const client = cloud;
  if (!client) return () => {};
  const checkpoint = "doracash-base:" + userId;
  let stopped = false;
  let running = false;
  let queued = false;
  let timer: ReturnType<typeof setTimeout>;
  let retryMs = 2000;

  function schedule(delay = 350) {
    if (stopped) return;
    clearTimeout(timer);
    timer = setTimeout(run, delay);
  }

  async function run() {
    if (stopped) return;
    if (running) { queued = true; return; }
    running = true;
    try {
      if (!useFinance.persist.hasHydrated()) await useFinance.persist.rehydrate();
      if (!navigator.onLine) throw new Error("Sin conexión. Tus cambios quedan guardados en este dispositivo.");
      const { data, error } = await client!.rpc("doracash_leer").maybeSingle();
      if (stopped) return;
      if (error) throw new Error("No se pudo consultar Supabase. Se volverá a intentar.");
      const row = data as { revision: number; datos: Snapshot | null } | null;
      if (!row) { status("Esta cuenta no tiene acceso a las finanzas de Dora Cash."); return; }
      const local = localSnapshot();
      const localText = canonical(local);
      const fingerprint = await digest(localText);
      const previous = localStorage.getItem(checkpoint);
      const remote = row.datos;
      if (remote && !sanitizeData(remote)) throw new Error("La copia de Supabase requiere revisión.");
      const remoteHash = remote ? await digest(canonical(remote)) : null;
      if (stopped) return;
      if (canonical(localSnapshot()) !== localText) { queued = true; return; }
      if (remoteHash === fingerprint) {
        localStorage.setItem(checkpoint, fingerprint);
      } else if (remote && (previous === fingerprint || (!previous && !local.periods.length && !local.goals.length))) {
        useFinance.setState({ periods: remote.periods, goals: remote.goals, theme: remote.theme, introDismissed: !!remote.introDismissed });
        localStorage.setItem(checkpoint, remoteHash!);
      } else if (remote && previous !== remoteHash) {
        status("Hay cambios distintos en este dispositivo y en la nube. Ambas copias se conservan. Descargá el respaldo local antes de conciliarlas.");
        return;
      } else if (!remote && !local.periods.length && !local.goals.length) {
        status("Cuenta vinculada. Tu primera quincena se guardará automáticamente.");
        return;
      } else {
        const saved = await client!.rpc("doracash_guardar", { version_previa: row.revision, documento: local });
        if (stopped) return;
        if (saved.error) throw new Error("Pendiente de subir. Se volverá a intentar.");
        if (saved.data !== row.revision + 1) { queued = true; return; }
        localStorage.setItem(checkpoint, fingerprint);
      }
      retryMs = 2000;
      status("Tus finanzas están sincronizadas con Supabase.");
    } catch (error) {
      if (!stopped) {
        status(error instanceof Error ? error.message : "Sincronización pendiente.");
        schedule(retryMs);
        retryMs = Math.min(retryMs * 2, 60000);
      }
    } finally {
      running = false;
      if (queued) { queued = false; schedule(); }
    }
  }
  const unsubscribe = useFinance.subscribe((next, prev) => {
    if (next.periods !== prev.periods || next.goals !== prev.goals || next.theme !== prev.theme || next.introDismissed !== prev.introDismissed) {
      status("Cambios pendientes de sincronizar.");
      schedule();
    }
  });
  const resume = () => schedule(0);
  const onStorage = (event: StorageEvent) => {
    if (event.key === "finanzas-store") void useFinance.persist.rehydrate();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener("online", resume);
  window.addEventListener("focus", resume);
  schedule(0);
  return () => {
    stopped = true;
    clearTimeout(timer);
    unsubscribe();
    window.removeEventListener("storage", onStorage);
    window.removeEventListener("online", resume);
    window.removeEventListener("focus", resume);
  };
}
