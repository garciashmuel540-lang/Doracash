import { useEffect } from "react";

const controls =
  'button, a[href], summary, input[type="checkbox"], input[type="radio"], [role="button"], [role="switch"], [role="tab"], [role="radio"], [role="menuitem"]';

export function HapticFeedback() {
  useEffect(() => {
    if (typeof navigator.vibrate !== "function") return;

    function onClick(event: MouseEvent) {
      if (!event.isTrusted || !(event.target instanceof Element)) return;
      const control = event.target.closest(controls);
      if (!control || control.closest(':disabled, [aria-disabled="true"], [inert]')) return;

      const confirmingPayment =
        control instanceof HTMLInputElement &&
        control.hasAttribute("data-haptic-payment") &&
        control.checked;
      navigator.vibrate(confirmingPayment ? [14, 32, 18] : 10);
    }

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  return null;
}
