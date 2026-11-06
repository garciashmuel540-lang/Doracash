import test from 'node:test';
import assert from 'node:assert/strict';
import { advisorContext } from './advisor.ts';
import { periodSurplus, type Period } from './finance.ts';
const period: Period = {
  id: 'test', start: '2026-11-01', end: '2026-11-15', income: 10000, status: 'open', setAside: 500, contributions: [],
  categories: [
    { id: 'needs', name: 'Hogar', role: 'need', tone: 0, items: [{ id: 'rent', name: 'Alquiler', amount: 3000, max: 5000 }, { id: 'override', name: 'Deuda', amount: 1000, max: 1000, roleOverride: 'debt' }] },
    { id: 'debt', name: 'Tarjeta', role: 'debt', tone: 1, items: [{ id: 'payment', name: 'Pago', amount: 1000, max: 2000 }] },
    { id: 'saving', name: 'Ahorro', role: 'life', tone: 2, items: [{ id: 'saved', name: 'Reserva', amount: 1000, max: 2000 }] },
  ],
};
test('recomendaciones descuentan deuda, rubros de ahorro y apartados sin reutilizar saldos de metas', () => {
  const result = advisorContext(period, [{ id: 'bank', name: 'Banco', saved: 50000, target: 100000, kind: 'custom' }]);
  assert.equal(result.libre, 3500);
  assert.equal(result.compromisos, 2000);
  assert.equal(result.ahorroAsignado, 1500);
  assert.equal(periodSurplus(period), result.libre);
  assert.equal(result.ahorroSugerido + result.reservaSugerida + result.gustosSugeridos, result.libre);
  assert.equal(result.tarjeta, null);
});
test('déficit y ausencia de ingreso nunca autorizan ahorro ni gustitos', () => {
  for (const input of [undefined, { ...period, income: 0 }, { ...period, income: 2000 }]) {
    const result = advisorContext(input, []);
    assert.equal(result.ahorroSugerido, 0);
    assert.equal(result.reservaSugerida, 0);
    assert.equal(result.gustosSugeridos, 0);
  }
});
test('reparto no excede el disponible ni con importes pequeños', () => {
  for (let ingreso = 0; ingreso < 100; ingreso++) {
    const result = advisorContext({ ...period, income: ingreso, categories: [], setAside: 0 }, []);
    assert.equal(result.ahorroSugerido + result.reservaSugerida + result.gustosSugeridos, ingreso);
  }
});
