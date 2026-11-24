import { toast } from "sonner";
import { playFeedback } from "./feedback";

export const feedbackToast = {
  success(...args: Parameters<typeof toast.success>) {
    playFeedback("confirm");
    return toast.success(...args);
  },
  undo(...args: Parameters<typeof toast.success>) {
    playFeedback("undo");
    return toast.success(...args);
  },
  error(...args: Parameters<typeof toast.error>) {
    playFeedback("warning");
    return toast.error(...args);
  },
  info(...args: Parameters<typeof toast.info>) {
    playFeedback("warning");
    return toast.info(...args);
  },
};
