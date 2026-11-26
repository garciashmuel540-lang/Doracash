import { useEffect, useState } from "react";
import { Button } from "./ui";
import { cloud, monitorFinance } from "@/lib/cloud-finance";

export function useCloudFinance() {
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const [status, setStatus] = useState("");
  useEffect(() => {
    if (!cloud) return;
    const { data } = cloud.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null));
    return () => data.subscription.unsubscribe();
  }, []);
  const userId = user?.id;
  useEffect(() => {
    setStatus("");
    if (userId) return monitorFinance(userId, setStatus);
  }, [userId]);
  return { user, status };
}

export function CloudSettings({ user, status, recovery = false }: ReturnType<typeof useCloudFinance> & { recovery?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (!cloud) return null;
  return <section className="card grid gap-3 p-4">
    <h3 className="font-semibold">Guardado en Supabase</h3>
    {user ? <>
      <p className="break-words text-sm">{user.email}</p>
      <p role="status" className="text-sm text-muted">{status || "Comprobando el guardado…"}</p>
      <Button variant="quiet" onClick={async () => {
        const result = await cloud!.auth.signOut({ scope: "local" });
        setError(result.error ? "No se pudo cerrar la sesión." : "");
      }}>Desconectar este dispositivo</Button>
    </> : <form className="grid gap-3" onSubmit={async event => {
      event.preventDefault();
      const form = event.currentTarget;
      const fields = new FormData(form);
      setError(""); setBusy(true);
      try {
        const result = await cloud!.auth.signInWithPassword({ email: String(fields.get("email")).trim(), password: String(fields.get("password")) });
        if (result.error) setError("No se pudo iniciar sesión. Revisá tu correo, contraseña y conexión.");
        else form.reset();
      } catch { setError("No se pudo conectar con Supabase."); }
      finally { setBusy(false); }
    }}>
      <p className="text-sm text-muted">{recovery ? "Ingresá con la misma cuenta que usaste para guardar tus quincenas y metas." : "Vinculá tu cuenta para guardar las quincenas y metas que ya tenés y los cambios que hagás después."}</p>
      <label className="grid gap-1 text-sm">Correo de tu cuenta
        <input className="rounded-xl bg-surface-2 px-3 py-2" type="email" name="email" autoComplete="username" required />
      </label>
      <label className="grid gap-1 text-sm">Contraseña
        <input className="rounded-xl bg-surface-2 px-3 py-2" type="password" name="password" autoComplete="current-password" required />
      </label>
      <Button type="submit" disabled={busy}>{busy ? "Conectando…" : recovery ? "Iniciar sesión y recuperar" : "Vincular cuenta"}</Button>
    </form>}
    {error && <p role="alert" className="text-sm text-bad">{error}</p>}
  </section>;
}
