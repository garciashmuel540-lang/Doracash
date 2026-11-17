import { useEffect } from "react";

/** Delegation also covers dialog buttons rendered in a portal. */
export function MaterialMotion() {
  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const ripples = new Set<HTMLElement>();
    function onPointerDown(event: PointerEvent) {
      if (motion.matches || event.button !== 0 || !(event.target instanceof Element)) return;
      const target = event.target.closest<HTMLElement>(
        ".material-button, .material-icon, .nav-item, .money-location-option, .companion-primary, .companion-tabs > button, .chat-suggestions button",
      );
      if (!target || target.matches(":disabled, [aria-disabled='true']")) return;
      const rect = target.getBoundingClientRect();
      const radius = Math.hypot(rect.width, rect.height);
      const ripple = document.createElement("span");
      ripple.className = "material-ripple";
      ripple.setAttribute("aria-hidden", "true");
      Object.assign(ripple.style, {
        width: `${radius * 2}px`, height: `${radius * 2}px`,
        left: `${event.clientX - rect.left - radius}px`,
        top: `${event.clientY - rect.top - radius}px`,
      });
      ripples.add(ripple);
      ripple.addEventListener("animationend", () => {
        ripples.delete(ripple);
        ripple.remove();
      }, { once: true });
      target.append(ripple);
    }
    document.addEventListener("pointerdown", onPointerDown, { passive: true });
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      ripples.forEach(ripple => ripple.remove());
    };
  }, []);
  return null;
}
