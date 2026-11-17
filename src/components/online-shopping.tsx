import { useState } from "react";
import { Code2, ExternalLink, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { Button, Modal } from "@/components/ui";
import { hostedCheckout } from "@/lib/online-payments";

const activation = "https://www.baccredomatic.com/es-ni/personas/otros-servicios/solicitud-de-activacion-del-servicio-click-pay/solicitud";

export function OnlineShopping() {
  const [merchantOpen, setMerchantOpen] = useState(false);
  return <section className="wallet-explainer card">
    <span className="cards-empty-icon"><ShoppingBag className="size-6" /></span>
    <div className="min-w-0">
      <h2>Compras en línea</h2>
      <p>Vinculá tu tarjeta directamente con el proveedor que acepten tus tiendas. El número completo y el CVV se ingresan allí.</p>
      <a className="wallet-link" href={activation} target="_blank" rel="noopener noreferrer">Activar Click to Pay con BAC <ExternalLink className="size-4" /></a>
      <a className="wallet-link" href="https://www.paypal.com/myaccount/wallet" target="_blank" rel="noopener noreferrer">Vincular en mi cartera de PayPal <ExternalLink className="size-4" /></a>
      <Button className="mt-3" variant="ghost" onClick={() => setMerchantOpen(true)}><Code2 className="size-4" /> Crear botón para mi tienda</Button>
    </div>
    <Modal open={merchantOpen} onOpenChange={setMerchantOpen} title="Botón para tu tienda" description="Usá un enlace de cobro de tu cuenta de comercio en PayPal o Tilopay.">
      <MerchantButton />
    </Modal>
  </section>;
}

function MerchantButton() {
  const [link, setLink] = useState("");
  const payment = hostedCheckout(link);
  const destination = payment ? new URL("pagar", window.location.href) : null;
  if (destination && payment) destination.searchParams.set("enlace", payment.url);
  const html = destination && payment
    ? `<a href="${destination.href}" rel="noreferrer" style="display:inline-block;padding:12px 20px;border-radius:24px;background:#203247;color:#edf2f7;font:600 16px system-ui;text-decoration:none">Pagar con Doracash · ${payment.provider}</a>`
    : "";
  async function copy() {
    try { await navigator.clipboard.writeText(html); toast.success("Botón copiado"); }
    catch { toast.info("Seleccioná y copiá el código del recuadro."); }
  }
  return <div className="card-form">
    <label>Enlace de cobro<input type="url" autoComplete="off" maxLength={256} value={link} onChange={e => setLink(e.target.value)} placeholder="Pegá el enlace que generó tu proveedor" /></label>
    {link && !payment && <p className="text-sm text-muted" role="status">Usá el enlace original de paypal.com/ncp/payment/ o app.tilopay.com/link/.</p>}
    {payment && destination && <>
      <p className="text-sm text-muted">Pegá este código en tu tienda. El cliente pasará por Doracash y confirmará el comercio y el monto en {payment.provider}.</p>
      <label>Código HTML<textarea rows={4} readOnly className="rounded-lg border border-line p-3" value={html} onFocus={e => e.target.select()} /></label>
      <Button onClick={copy}>Copiar botón</Button>
      <a className="wallet-link" href={destination.href} target="_blank" rel="noopener noreferrer">Ver el paso de pago <ExternalLink className="size-4" /></a>
    </>}
  </div>;
}
