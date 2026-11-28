import { currentSundayReserve, budgetItems, splitPayment, categoryPaidAmount, roleAmount, deferredPaymentsTotal, type Role, type Goal, type Period } from './finance.ts';

export function advisorContext(period: Period | undefined, goals: Goal[], tarjeta: string | null = null) {
  const money = (n: number | undefined) => Number.isFinite(n) ? Math.max(0, n!) : 0;
  const sum = (role: Role) => period ? roleAmount(period, role) : 0;
  // Read the editable payment rows, not a stale card snapshot or category total.
  const isCardPayment = (name: string) => {
    const normalized = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    return /\btarjetas?\b/.test(normalized) && /\b(pagos?|credito)\b/.test(normalized);
  };
  const pagosTarjeta = period?.categories.flatMap(category => splitPayment(category)
    .filter(({ item }) => isCardPayment(item.name) || isCardPayment(category.name))
    .map(({ item, pending }) => ({ nombre: item.name, categoria: category.name, monto: pending,
      incluidoEnPresupuesto: categoryPaidAmount(category) === 0 }))) ?? [];
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
  const saldoAnterior = money(period?.openingBalance);
  const reservaDominical = period ? currentSundayReserve(period) : 0;
  const libre = ingreso + saldoAnterior - gastos - compromisos - ahorroAsignado - reservaDominical;
  const disponible = Math.max(0, libre);
  const ahorroSugerido = Math.min(disponible, Math.floor(ingreso * .1));
  const reservaSugerida = Math.floor((disponible - ahorroSugerido) * .8);
  return {
    hayQuincena: Boolean(period), ingreso, saldoAnterior, reservaDominical, gastos, compromisos, ahorroAsignado, libre,
    ahorroSugerido, reservaSugerida, gustosSugeridos: disponible - ahorroSugerido - reservaSugerida,
    ahorro: goals.reduce((s, g) => s + money(g.saved), 0),
    metas: goals.map(g => ({ nombre: g.name, ahorrado: money(g.saved), objetivo: money(g.target) })),
    rubros: period?.categories.map(c => ({ nombre: c.name, tipo: c.role, monto: budgetItems(c).reduce((total, item) => total + Number(item.amount), 0) })) ?? [],
    pendienteParaOtraQuincena: period ? deferredPaymentsTotal(period) : 0,
    inicio: period?.start ?? null, fin: period?.end ?? null,
    tarjeta, deudaTarjetaManual,
  };
}
export type AdvisorContext = ReturnType<typeof advisorContext>;
