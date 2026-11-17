import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { CreditCard, Plus, Pencil, Trash2, Smartphone, ShieldCheck, ExternalLink, ContactRound } from "lucide-react";
import { OnlineShopping } from "@/components/online-shopping";
import { suggestIssuer, bankBrand } from "@/lib/online-payments";
import bacLogo from "@/assets/banks/bac.png";
import banproLogo from "@/assets/banks/banpro.png";
import lafiseLogo from "@/assets/banks/lafise.png";
import { toast } from "sonner";
import { PageHeader } from "@/components/shell";
import { Button, IconButton, Modal } from "@/components/ui";
import { useCards } from "@/lib/cards-store";
import { CARD_LIMIT, WALLET_LINKS, type CardDraft, type CardKind, type CardNetwork, type SavedCard } from "@/lib/cards";

export const Route = createFileRoute("/_app/tarjetas")({ component: CardsPage });

const bankImages = { bac: bacLogo, banpro: banproLogo, lafise: lafiseLogo };

function BankLabel({ bank }: { bank: string }) {
  const brand = bankBrand(bank);
  return <span className="inline-flex min-w-0 items-center gap-2">{brand && <img src={bankImages[brand]} width="28" height="28" alt="" className="size-7 shrink-0 rounded-md object-contain" />}<span>{bank}</span></span>;
}

function CardsPage() {
  const cards = useCards(s => s.cards);
  const save = useCards(s => s.save);
  const remove = useCards(s => s.remove);
  const [filter, setFilter] = useState<"all" | CardKind>("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<SavedCard | null>(null);
  const [walletCard, setWalletCard] = useState<SavedCard | null>(null);
  const [walletOpen, setWalletOpen] = useState(false);
  const shown = cards.filter(c => filter === "all" || c.kind === filter);

  function openForm(card: SavedCard | null) {
    setEditing(card);
    setFormOpen(true);
  }
  function deleteCard(card: SavedCard) {
    const undo = remove(card.id);
    if (undo) toast.success("Referencia eliminada", {
      action: { label: "Deshacer", onClick: () => {
        if (undo()) toast.success("Tarjeta restaurada");
        else toast.info("No se pudo restaurar la tarjeta.");
      } }, duration: 8000,
    });
  }

  return (
    <div className="cards-page">
      <PageHeader title="Tus tarjetas" lede="Crédito y débito, en un mismo lugar." />
      <div className="cards-toolbar">
        <div><p className="page-eyebrow">TU CARTERA</p><h2>{cards.length} {cards.length === 1 ? "tarjeta registrada" : "tarjetas registradas"}</h2></div>
        <Button onClick={() => openForm(null)} disabled={cards.length >= CARD_LIMIT}><Plus className="size-4" /> Agregar tarjeta</Button>
      </div>
      <p className="cards-privacy"><ShieldCheck className="size-4" /> Referencias guardadas en este dispositivo. De la numeración solo quedan guardados los últimos 4 dígitos.</p>
      {cards.length > 0 && <div className="cards-filters" role="group" aria-label="Filtrar tarjetas">
        {([['all', 'Todas'], ['credit', 'Crédito'], ['debit', 'Débito']] as const).map(([value, label]) => (
          <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>
        ))}
      </div>}
      {cards.length === 0 ? (
        <section className="cards-empty card">
          <span className="cards-empty-icon"><CreditCard className="size-7" /></span>
          <h2>Tu cartera empieza aquí.</h2>
          <p>Agrega una referencia de tus tarjetas para identificarlas y recordar tus fechas de corte y pago.</p>
          <Button variant="quiet" onClick={() => openForm(null)}>Agregar mi primera tarjeta <Plus className="size-4" /></Button>
        </section>
      ) : shown.length === 0 ? <p className="card p-6 text-sm text-muted">Aún no tienes tarjetas de {filter === "credit" ? "crédito" : "débito"} registradas.</p> : (
        <div className="payment-cards-grid">
          {shown.map(card => (
            <article className="payment-card" data-kind={card.kind} key={card.id} aria-label={`${card.alias}, terminada en ${card.last4}`}>
              <div className="payment-card-top"><BankLabel bank={card.bank} /><span className="payment-card-network">{card.network}</span></div>
              <div className="payment-card-name"><CreditCard className="size-6" /><h2>{card.alias}</h2></div>
              <p className="payment-card-number" aria-label={`Terminada en ${card.last4}`}><span aria-hidden="true">••••</span> {card.last4}</p>
              <div className="payment-card-meta"><span>{card.kind === "credit" ? "Crédito" : "Débito"}</span><span>Registro local</span></div>
              {card.kind === "credit" && (card.cutDay || card.payDay) && <dl className="payment-card-dates">
                {card.cutDay && <div><dt>Corte mensual</dt><dd>Día {card.cutDay}</dd></div>}
                {card.payDay && <div><dt>Pago mensual</dt><dd>Día {card.payDay}</dd></div>}
              </dl>}
              <p className="payment-card-wallet"><Smartphone className="size-4" /> {card.walletReady ? "Activada en Wallet, según tu registro" : "NFC sin verificar en Google Wallet"}</p>
              <div className="payment-card-actions">
                <Button variant="ghost" onClick={() => { setWalletCard(card); setWalletOpen(true); }}><Smartphone className="size-4" /> {card.walletReady ? "Usar Google Wallet" : "Configurar NFC"}</Button>
                <IconButton label={`Editar ${card.alias}`} onClick={() => openForm(card)}><Pencil className="size-4" /></IconButton>
                <IconButton label={`Eliminar ${card.alias}`} onClick={() => deleteCard(card)}><Trash2 className="size-4" /></IconButton>
              </div>
            </article>
          ))}
        </div>
      )}

      <OnlineShopping />
      <section className="wallet-explainer card">
        <span className="cards-empty-icon"><Smartphone className="size-6" /></span>
        <div><h2>Pagos sin contacto</h2><p>El pago NFC se hace en Google Wallet, con una tarjeta admitida por tu banco y un teléfono compatible. Guardarla en Doracash no la activa para pagar.</p>
          <Button variant="quiet" onClick={() => { setWalletCard(null); setWalletOpen(true); }}>Ver cómo configurar NFC <ExternalLink className="size-4" /></Button>
        </div>
      </section>
      <Modal open={formOpen} onOpenChange={setFormOpen} title={editing ? "Editar tarjeta" : "Agregar tarjeta"} description="Guarda una referencia, sin los datos necesarios para cobrar.">
        <CardForm initial={editing} onSave={draft => {
          if (!save(draft, editing?.id)) return false;
          setFormOpen(false);
          toast.success(editing ? "Tarjeta actualizada" : "Tarjeta registrada");
          return true;
        }} />
      </Modal>
      <Modal open={walletOpen} onOpenChange={setWalletOpen} title="Pagar con el celular" description={walletCard ? `${walletCard.alias} · •••• ${walletCard.last4}` : "Activa una tarjeta compatible en Google Wallet."}>
        <div className="wallet-guide">
          <p>Doracash guarda la referencia de tu tarjeta. <strong>El pago se realiza desde Google Wallet; Doracash no procesa pagos NFC.</strong></p>
          <ol>
            <li><strong>Comprueba tu tarjeta.</strong> Tu banco y Google Wallet deben admitir esa tarjeta. La red Visa o Mastercard, por sí sola, no confirma la compatibilidad.</li>
            <li><strong>Añádela en Google Wallet.</strong> Abre la app, toca «Añadir a Wallet» y «Tarjeta de pago». Completa allí la verificación del banco.</li>
            <li><strong>Prepara el teléfono.</strong> Activa NFC, configura Wallet como app de pago predeterminada y cumple sus requisitos de seguridad. Después desbloquea el celular y acércalo al datáfono.</li>
          </ol>
          <a className="wallet-link wallet-link-primary" href={WALLET_LINKS.app} target="_blank" rel="noopener noreferrer"><Smartphone className="size-4" /> Google Wallet en Google Play <ExternalLink className="size-4" /></a>
          <p className="wallet-link-note">Desde Google Play puedes abrirla si está instalada o instalarla. Selecciona la tarjeta dentro de Wallet.</p>
          <a className="wallet-link" href={WALLET_LINKS.support} target="_blank" rel="noopener noreferrer">Consultar tarjetas admitidas en Nicaragua <ExternalLink className="size-4" /></a>
          <a className="wallet-link" href={WALLET_LINKS.setup} target="_blank" rel="noopener noreferrer">Guía oficial para agregar una tarjeta <ExternalLink className="size-4" /></a>
          {walletCard && <p className="wallet-link-note">Cuando Wallet confirme que está lista, puedes marcar «Ya la activé en Google Wallet» al editar esta referencia. Doracash no comprueba esa activación.</p>}
        </div>
      </Modal>
    </div>
  );
}

function CardForm({ initial, onSave }: { initial: SavedCard | null; onSave: (draft: CardDraft) => boolean }) {
  const [prefix, setPrefix] = useState("");
  const suggestion = suggestIssuer(prefix);
  const [alias, setAlias] = useState(initial?.alias ?? "");
  const [bank, setBank] = useState(initial?.bank ?? "");
  const [kind, setKind] = useState<CardKind>(initial?.kind ?? "credit");
  const [network, setNetwork] = useState<CardNetwork>(initial?.network ?? "Visa");
  const [last4, setLast4] = useState(initial?.last4 ?? "");
  const [cutDay, setCutDay] = useState(initial?.cutDay?.toString() ?? "");
  const [payDay, setPayDay] = useState(initial?.payDay?.toString() ?? "");
  const [walletReady, setWalletReady] = useState(initial?.walletReady ?? false);
  const [error, setError] = useState("");
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!/^\d{4}$/.test(last4)) { setError("Escribe únicamente los últimos 4 dígitos de tu tarjeta."); return; }
    if (!onSave({ alias, bank, kind, network, last4, walletReady,
      ...(kind === "credit" && cutDay ? { cutDay: Number(cutDay) } : {}),
      ...(kind === "credit" && payDay ? { payDay: Number(payDay) } : {}),
    })) setError("Revisa el nombre y el banco. No incluyas números completos de tarjeta. El máximo es de 30 referencias.");
  }
  return <form className="card-form" onSubmit={submit} autoComplete="off">
    <p className="cards-privacy"><ContactRound className="size-4" /> No ingreses número completo, CVV ni PIN.</p>
    <label>Nombre para identificarla<input autoComplete="off" value={alias} maxLength={40} required placeholder="Ej. Mi tarjeta del día a día" onChange={e => setAlias(e.target.value)} /></label>
    <details className="rounded-xl border border-line p-3">
      <summary className="cursor-pointer text-sm">Identificar banco por los primeros 6 dígitos</summary>
      <label className="mt-3">Primeros 6 dígitos (opcional)<input inputMode="numeric" autoComplete="off" value={prefix} placeholder="000000" onChange={e => {
        if (/^\d{0,6}$/.test(e.target.value)) setPrefix(e.target.value);
      }} /></label>
      <p className="wallet-link-note" aria-live="polite">{suggestion ? "Revisá la sugerencia antes de aplicarla." : prefix.length === 6 ? "Sin coincidencia. Podés escribir el banco abajo." : "La búsqueda se hace en tu teléfono y el prefijo se descarta."}</p>
      {suggestion && <Button className="mt-2" variant="quiet" onClick={() => {
        setBank(suggestion.bank); setNetwork(suggestion.network); setWalletReady(false); setPrefix("");
      }}>Usar <BankLabel bank={suggestion.bank} /> · {suggestion.network}</Button>}
    </details>
    <label>Banco o emisor<input autoComplete="off" value={bank} maxLength={60} required placeholder="Ej. BAC, Banpro, LAFISE…" onChange={e => { setBank(e.target.value); setWalletReady(false); }} /></label>
    <div className="card-form-row">
      <label>Tipo<select value={kind} onChange={e => { setKind(e.target.value as CardKind); setWalletReady(false); }}><option value="credit">Crédito</option><option value="debit">Débito</option></select></label>
      <label>Red<select value={network} onChange={e => { setNetwork(e.target.value as CardNetwork); setWalletReady(false); }}>{(["Visa", "Mastercard", "American Express", "Otra"] as const).map(n => <option key={n} value={n}>{n}</option>)}</select></label>
    </div>
    <label>Últimos 4 dígitos<input name="card-reference-suffix" autoComplete="off" inputMode="numeric" value={last4} required placeholder="1234" pattern="[0-9]{4}" aria-describedby="card-suffix-help" onChange={e => {
      if (/^\d{0,4}$/.test(e.target.value)) { setLast4(e.target.value); setWalletReady(false); setError(""); }
      else setError("Solo se aceptan los últimos 4 dígitos, nunca el número completo.");
    }} /></label>
    <p className="wallet-link-note" id="card-suffix-help">Estos cuatro dígitos sirven para reconocerla; no permiten pagar.</p>
    {kind === "credit" && <div className="card-form-row">
      <label>Día de corte (opcional)<select value={cutDay} onChange={e => setCutDay(e.target.value)}><option value="">Sin definir</option>{Array.from({ length: 31 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}</select></label>
      <label>Día de pago (opcional)<select value={payDay} onChange={e => setPayDay(e.target.value)}><option value="">Sin definir</option>{Array.from({ length: 31 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}</select></label>
    </div>}
    <label className="card-wallet-check"><input type="checkbox" checked={walletReady} onChange={e => setWalletReady(e.target.checked)} /><span>Ya la activé en Google Wallet<small>Márcalo solo después de que Wallet confirme que puedes pagar. Es un dato indicado por ti.</small></span></label>
    {error && <p className="text-sm text-bad" role="alert">{error}</p>}
    <Button type="submit" full>{initial ? "Guardar cambios" : "Guardar tarjeta"}</Button>
  </form>;
}
