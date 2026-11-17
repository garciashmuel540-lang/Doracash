import test from 'node:test';
import assert from 'node:assert/strict';

test('agrega, edita, elimina, deshace y recupera referencias tras recargar', async () => {
  const values = new Map<string, string>();
  const storage: Storage = {
    get length() { return values.size; },
    clear: () => values.clear(),
    key: index => [...values.keys()][index] ?? null,
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
    removeItem: key => { values.delete(key); },
  };
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage: storage } });
  const { useCards } = await import('./cards-store.ts');
  const draft = { alias: 'Prueba', bank: 'Banco de prueba', kind: 'credit' as const, network: 'Visa' as const, last4: '0123', cutDay: 24, payDay: 9, walletReady: false };
  assert.equal(useCards.getState().save(draft), true);
  const id = useCards.getState().cards[0].id;
  assert.equal(useCards.getState().save({ ...draft, kind: 'debit' }, id), true);
  assert.equal(useCards.getState().cards[0].cutDay, undefined);
  assert.equal(useCards.getState().cards[0].last4, '0123');
  assert.equal(useCards.getState().save({ ...draft, last4: '4111111111111111' }), false);
  assert.equal(useCards.getState().cards.length, 1);
  const persisted = storage.getItem('doracash-cards-v1')!;
  const undo = useCards.getState().remove(id)!;
  assert.equal(useCards.getState().cards.length, 0);
  assert.equal(undo(), true);
  assert.equal(undo(), false);
  useCards.getState().replace([]);
  storage.setItem('doracash-cards-v1', persisted);
  await useCards.persist.rehydrate();
  assert.equal(useCards.getState().cards[0].id, id);
  assert.equal(useCards.getState().cards[0].last4, '0123');
  assert.equal(useCards.getState().replace([{ ...draft, id, payDay: 99 }]), false);
  assert.equal(useCards.getState().cards.length, 1);
  useCards.getState().replace([]);
});
