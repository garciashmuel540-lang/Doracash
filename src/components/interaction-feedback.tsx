import { useEffect } from "react";
import {
  feedbackSequence,
  playFeedback,
  prepareFeedbackAudio,
  useFeedbackSettings,
  type FeedbackCue,
} from "@/lib/feedback";

const controls = "button, a[href], summary, input[type='button'], input[type='submit']";

function cueFor(control: HTMLElement): FeedbackCue | null {
  if (control.matches("[aria-haspopup='dialog']")) return "open";
  if (control.matches("[aria-expanded]")) {
    return control.getAttribute("aria-expanded") === "true" ? "close" : "open";
  }
  if (control.matches("summary")) return control.closest("details")?.open ? "close" : "open";
  if (control.matches(".nav-item"))
    return control.matches("[aria-current='page']") ? null : "navigate";
  if (control.matches("[aria-pressed], [role='radio']")) {
    return control.matches("[aria-pressed='true'], [aria-checked='true']") ? null : "select";
  }
  return "tap";
}

export function InteractionFeedback() {
  useEffect(() => {
    void useFeedbackSettings.persist?.rehydrate();
    const pending = new Set<number>();

    // Wait for the action handler so explicit success or error cues replace the generic click.
    function defer(cue: FeedbackCue) {
      const sequence = feedbackSequence;
      const timer = window.setTimeout(() => {
        pending.delete(timer);
        if (sequence === feedbackSequence) playFeedback(cue);
      }, 0);
      pending.add(timer);
    }

    function onClick(event: MouseEvent) {
      if (!event.isTrusted || event.button !== 0 || !(event.target instanceof Element)) return;
      const control = event.target.closest<HTMLElement>(controls);
      if (!control || control.matches(":disabled, [aria-disabled='true']")) return;
      if (control.closest("[data-feedback='off']")) return;
      const cue = cueFor(control);
      if (cue) {
        prepareFeedbackAudio();
        defer(cue);
      }
    }

    function onChange(event: Event) {
      if (!event.isTrusted || !(event.target instanceof HTMLElement)) return;
      if (
        event.target.matches("select, input[type='checkbox'], input[type='radio']") &&
        !event.target.closest("[data-feedback='off']")
      )
        defer("select");
    }

    document.addEventListener("click", onClick, true);
    document.addEventListener("change", onChange, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("change", onChange, true);
      pending.forEach((timer) => window.clearTimeout(timer));
    };
  }, []);

  return null;
}
