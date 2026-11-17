import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeCard, normalizeCardList, CARD_LIMIT } from './cards.ts';
const card = { id: 'card-test', alias: 'Mi tarjeta', bank: 'Banco de prueba', kind: 'credit', network: 'Visa', last4: '0123', cutDay: 24, payDay: 9, walletReady: false };

test('no admite PAN completo ni credenciales adicionales al persistir una referencia', () => {
  const normalized = normalizeCard({ ...card, pan: '4111111111111111', cvv: '123', pin: '1234' });
  assert.deepEqual(normalized, card);
  assert.equal(normalizeCard({ ...card, last4: '4111111111111111' }), null);
  assert.equal(normalizeCard({ ...card, alias: '4111 1111 1111 1111' }), null);
  assert.equal(normalizeCard({ ...card, bank: '4111-1111-1111-1111' }), null);
});
test('valida fechas, tipo y red, y conserva ceros iniciales del sufijo', () => {
  assert.equal(normalizeCard(card)?.last4, '0123');
  for (const invalid of [{ cutDay: 0 }, { payDay: 32 }, { cutDay: 1.5 }, { network: 'Desconocida' }, { kind: 'cash' }, { walletReady: 'true' }]) {
    assert.equal(normalizeCard({ ...card, ...invalid }), null);
  }
  assert.deepEqual(normalizeCard({ ...card, kind: 'debit' }), { id: 'card-test', alias: 'Mi tarjeta', bank: 'Banco de prueba', kind: 'debit', network: 'Visa', last4: '0123', walletReady: false });
});
test('restauración rechaza el conjunto si una tarjeta es inválida, repetida o excede el máximo', () => {
  assert.deepEqual(normalizeCardList([]), []);
  assert.deepEqual(normalizeCardList([card]), [card]);
  assert.equal(normalizeCardList([card, { ...card, id: 'bad', last4: '12345' }]), null);
  assert.equal(normalizeCardList([card, card]), null);
  assert.equal(normalizeCardList(Array.from({ length: CARD_LIMIT + 1 }, (_, i) => ({ ...card, id: `test-${i}` }))), null);
});
