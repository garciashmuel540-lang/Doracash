import { useSyncExternalStore } from 'react';
import { CARD_CONTEXT_KEY, normalizeCardContext } from './card-context';
const EVENT = 'doracash-card-updated';
function read() {
  try { return normalizeCardContext(localStorage.getItem(CARD_CONTEXT_KEY)); } catch { return ''; }
}
function subscribe(callback: () => void) {
  window.addEventListener('storage', callback);
  window.addEventListener(EVENT, callback);
  return () => { window.removeEventListener('storage', callback); window.removeEventListener(EVENT, callback); };
}
export function saveCardContext(value: string) {
  const normalized = normalizeCardContext(value);
  if (normalized) localStorage.setItem(CARD_CONTEXT_KEY, normalized);
  else localStorage.removeItem(CARD_CONTEXT_KEY);
  window.dispatchEvent(new Event(EVENT));
}
export function useCardContext() {
  return useSyncExternalStore(subscribe, read, () => '');
}
