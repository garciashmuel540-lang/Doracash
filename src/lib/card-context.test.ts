import test from 'node:test';
import assert from 'node:assert/strict';
import { cardContextFromHash, normalizeCardContext, CARD_CONTEXT_LIMIT } from './card-context.ts';
import { advisorContext } from './advisor.ts';
test('importación conserva monedas, saltos y signos sin publicar datos en una consulta URL', () => {
  const card = 'Banco de prueba\nSaldo C$ 123 + comisión C$ 7; límite USD 80';
  assert.equal(cardContextFromHash('#tarjeta=' + encodeURIComponent(card)), card);
  assert.equal(cardContextFromHash('#seccion'), null);
  assert.throws(() => cardContextFromHash('#tarjeta=' + 'x'.repeat(CARD_CONTEXT_LIMIT + 1)));
});
test('sin perfil no se inventan datos y el perfil no altera el presupuesto', () => {
  assert.equal(advisorContext(undefined, []).tarjeta, null);
  const result = advisorContext(undefined, [], 'Saldo reportado C$ 123');
  assert.equal(result.tarjeta, 'Saldo reportado C$ 123');
  assert.equal(result.libre, 0);
  assert.equal(result.gustosSugeridos, 0);
  assert.equal(normalizeCardContext(null), '');
});
