import { issuerRanges } from "./issuer-ranges.ts";

export function suggestIssuer(prefix: string) {
  if (!/^\d{6}$/.test(prefix)) return null;
  return issuerRanges.find(group => group.prefixes.includes(prefix)) ?? null;
}

export function bankBrand(bank: string) {
  const name = bank.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  if (/^(bac( credomatic)?|credomatic( de nicaragua)?|banco de america central)(,? s\.?a\.?)?$/.test(name)) return "bac";
  if (/^(banpro( grupo promerica)?|banco de la produccion)(,? s\.?a\.?)?$/.test(name)) return "banpro";
  if (/^(banco )?lafise( bancentro)?(,? s\.?a\.?)?$/.test(name)) return "lafise";
  return null;
}

/** Only canonical provider payment paths can be emitted in merchant HTML. */
export function hostedCheckout(input: string) {
  const link = input.trim();
  if (/^https:\/\/www\.paypal\.com\/ncp\/payment\/[A-Z0-9]{13}$/.test(link)) {
    return { provider: "PayPal", url: link };
  }
  if (/^https:\/\/app\.tilopay\.com\/link\/[A-Za-z0-9_-]{2,96}={0,2}$/.test(link)) {
    return { provider: "Tilopay", url: link };
  }
  return null;
}
