import { categoryTotal, type Goal, type Period } from './finance.ts';

export function advisorContext(period: Period | undefined, goals: Goal[], tarjeta: string | null = null) {
  const money = (n: number | undefined) => Number.isFinite(n) ? Math.max(0, n!) : 0;
  const sum = (role: string) => period?.categories.reduce((total, c) => total + c.items.reduce((s, item) => s + ((item.roleOverride ?? c.role) === role ? money(item.amount) : 0), 0), 0) ?? 0;
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
    tarjeta,
  };
}
export type AdvisorContext = ReturnType<typeof advisorContext>;
