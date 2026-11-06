export const CARD_CONTEXT_KEY = 'doracash-card-context-v1';
export const CARD_CONTEXT_LIMIT = 6000;
export function normalizeCardContext(value: unknown): string {
  return typeof value === 'string' ? value.trim().slice(0, CARD_CONTEXT_LIMIT) : '';
}
export function cardContextFromHash(hash: string): string | null {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  if (!params.has('tarjeta')) return null;
  const value = params.get('tarjeta');
  if (!value || value.length > CARD_CONTEXT_LIMIT) throw new Error('Los datos de tarjeta no son válidos.');
  return normalizeCardContext(value);
}
