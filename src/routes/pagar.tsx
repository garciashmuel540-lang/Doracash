import { createFileRoute, Link } from "@tanstack/react-router";
import { ExternalLink, Wallet } from "lucide-react";
import { hostedCheckout } from "@/lib/online-payments";

export const Route = createFileRoute("/pagar")({
  validateSearch: (params: Record<string, unknown>) => ({
    enlace: typeof params.enlace === "string" && params.enlace.length <= 256 ? params.enlace : "",
  }),
  component: Checkout,
});

function Checkout() {
  const payment = hostedCheckout(Route.useSearch().enlace);
  return <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-5 px-5 py-10">
    <span className="cards-empty-icon"><Wallet className="size-6" /></span>
    <h1 className="text-3xl font-semibold">Pagar con Doracash</h1>
    {payment ? <>
      <p className="text-muted">Vas a continuar a {payment.provider}. Allí verás quién recibe el pago, el monto y las tarjetas disponibles antes de confirmar.</p>
      <a className="wallet-link wallet-link-primary" href={payment.url} rel="noreferrer">Continuar a {payment.provider} <ExternalLink className="size-4" /></a>
      <small className="text-muted">Destino: {new URL(payment.url).hostname}</small>
    </> : <p role="status">El enlace de cobro no es válido. Pedile al comercio que te envíe uno nuevo.</p>}
    <Link to="/tarjetas" className="text-sm underline">Ir a mis tarjetas</Link>
  </main>;
}
