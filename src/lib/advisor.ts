import { categoryTotal, type Goal, type Period } from './finance.ts';

export function advisorContext(period: Period | undefined, goals: Goal[], tarjeta: string | null = null) {
  const money = (n: number | undefined) => Number.isFinite(n) ? Math.max(0, n!) : 0;
  const sum = (role: string) => period?.categories.reduce((total, c) => total + c.items.reduce((s, item) => s + ((item.roleOverride ?? c.role) === role ? money(item.amount) : 0), 0), 0) ?? 0;
  // Read the editable payment rows, not a stale card snapshot or category total.
  const isCardPayment = (name: string) => {
    const normalized = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    return /\btarjetas?\b/.test(normalized) && /\b(pagos?|credito)\b/.test(normalized);
  };
  const pagosTarjeta = period?.categories.flatMap(category => category.items
    .filter(item => isCardPayment(item.name) || isCardPayment(category.name))
    .map(item => ({ nombre: item.name, categoria: category.name, monto: money(item.amount),
      incluidoEnPresupuesto: true as const }))) ?? [];
  const deudaTarjetaManual = pagosTarjeta.length ? {
    monto: pagosTarjeta.reduce((total, item) => total + item.monto, 0),
    moneda: 'NIO' as const,
    fuente: 'Pago a tarjeta de crédito de la quincena abierta' as const,
    partidas: pagosTarjeta,
  } : null;
  const ingreso = money(period?.income);
  const gastos = sum('need');
  const compromisos = sum('debt');
  const ahorroAsignado = sum('life') + money(period?.setAside);
  const libre = ingreso - gastos - compromisos - ahorroAsignado;
  const disponible = Math.max(0, libre);
  const ahorroSugerido = Math.min(disponible, Math.floor(ingreso * .1));
  const reservaSugerida = Math.floor((disponible - ahorroSugerido) * .8);
  return {
    hayQuincena: Boolean(period), ingreso, gastos, compromisos, ahorroAsignado, libre,
    ahorroSugerido, reservaSugerida, gustosSugeridos: disponible - ahorroSugerido - reservaSugerida,
    ahorro: goals.reduce((s, g) => s + money(g.saved), 0),
    metas: goals.map(g => ({ nombre: g.name, ahorrado: money(g.saved), objetivo: money(g.target) })),
    rubros: period?.categories.map(c => ({ nombre: c.name, tipo: c.role, monto: categoryTotal(c) })) ?? [],
    inicio: period?.start ?? null, fin: period?.end ?? null,
    tarjeta, deudaTarjetaManual,
  };
}
export type AdvisorContext = ReturnType<typeof advisorContext>;
