import type { AdvisorContext } from './advisor';

export function companionAdvice(context: AdvisorContext) {
  if (!context.hayQuincena || context.ingreso <= 0) return null;
  if (context.libre < 0) return { kind: 'over-budget', amount: -context.libre, text: 'Tus asignaciones superan tus ingresos por', action: 'Revisa tus rubros antes de añadir nuevos gastos.' };
  if (context.libre <= context.ingreso * .1) return { kind: 'low-margin', amount: context.libre, text: 'Te quedan por asignar', action: 'Mantén un margen para imprevistos y revisa tus pagos pendientes antes de darte un gusto.' };
  if (context.ahorroAsignado < context.ingreso * .1 && context.ahorroSugerido > 0) return { kind: 'saving', amount: Math.min(context.libre, context.ingreso * .1 - context.ahorroAsignado), text: 'Si ya registraste todos tus pagos, podrías apartar', action: 'Así completarías un 10% de tu ingreso destinado al ahorro. Es una sugerencia; no mueve dinero.' };
  return null;
}

const ledger = new Map<string, number>();
const STORAGE_KEY = 'doracash-advice-seen-v1';
export function claimAdvice(key: string, now = Date.now()) {
  let records = Object.fromEntries(ledger);
  try { records = { ...records, ...JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '{}') }; } catch { /* Storage may be unavailable. */ }
  if (records[key] || now - (records.last || 0) < 10 * 60 * 1000) return false;
  records[key] = now; records.last = now;
  ledger.set(key, now); ledger.set('last', now);
  try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(records)); } catch { /* In-memory fallback. */ }
  return true;
}
