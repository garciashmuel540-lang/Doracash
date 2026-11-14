export function playSelectionHaptic() {
  if (typeof navigator !== "undefined") navigator.vibrate?.(5);
}
