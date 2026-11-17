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

import { hostedCheckout, suggestIssuer, bankBrand } from "./online-payments.ts";

test("issuer suggestions use a six-digit local prefix and are optional", () => {
  assert.equal(suggestIssuer("455284")?.bank, "BAC Credomatic");
  assert.equal(suggestIssuer("403132")?.network, "Visa");
  for (const invalid of ["", "000000", "1234", "4552840000000000"]) assert.equal(suggestIssuer(invalid), null);
  assert.equal(bankBrand("Banco de América Central"), "bac");
  assert.equal(bankBrand("Otro banco"), null);
});

test("checkout only accepts a hosted payment link on the expected provider", () => {
  assert.equal(hostedCheckout("https://app.tilopay.com/link/MjMwMjQ=")?.provider, "Tilopay");
  assert.equal(hostedCheckout("https://www.paypal.com/ncp/payment/123456789ABCD")?.provider, "PayPal");
  for (const link of ["", "https://www.paypal.com.example.org/ncp/payment/123456789ABCD", "https://app.tilopay.com/link/123?redirect=bad", "https://app.tilopay.com/link/../admin", "javascript:alert(1)"]) {
    assert.equal(hostedCheckout(link), null);
  }
});
