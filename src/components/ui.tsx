import { cva, type VariantProps } from "class-variance-authority";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useId, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { formatPlain, parseMoney } from "@/lib/finance";

const buttonStyles = cva(
  "inline-flex min-h-11 max-w-full whitespace-normal py-2 text-center items-center justify-center gap-2 rounded-full px-5 text-sm font-medium transition-opacity duration-200 disabled:cursor-not-allowed disabled:opacity-40",
  {
    variants: {
      variant: {
        primary: "bg-gold-fill text-gold-ink hover:opacity-90",
        quiet: "bg-surface-2 text-fg hover:opacity-80",
        ghost: "bg-transparent px-3 text-muted hover:text-fg",
        danger: "bg-transparent px-3 text-bad",
      },
      full: {
        true: "w-full",
        false: "",
      },
    },
    defaultVariants: { variant: "primary", full: false },
  },
);

export function Button({
  className,
  variant,
  full,
  type,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonStyles>) {
  return (
    <button
      type={type ?? "button"}
      className={cn(buttonStyles({ variant, full }), className)}
      {...props}
    />
  );
}

export function IconButton({
  label,
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      className={cn(
        "grid size-11 shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-fg",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function MoneyField({
  value,
  onChange,
  label,
  className,
  size = "md",
}: {
  value: number;
  onChange: (value: number) => void;
  label: string;
  className?: string;
  size?: "md" | "lg";
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const id = useId();
  const shown = draft ?? formatPlain(value);

  return (
    <div className={cn("field min-w-0 flex items-center gap-1 px-3", size === "lg" ? "h-14" : "h-11", className)}>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <span className="shrink-0 text-sm text-muted" aria-hidden="true">
        C$
      </span>
      <input
        id={id}
        inputMode="numeric"
        autoComplete="off"
        aria-label={label}
        className={cn(
          "w-full min-w-0 bg-transparent text-right tabular-nums outline-none",
          size === "lg" ? "text-2xl font-medium" : "text-base",
        )}
        value={shown}
        onFocus={(event) => event.currentTarget.select()}
        onChange={(event) => {
          const digits = event.target.value.replace(/[^\d]/g, "");
          setDraft(digits);
          onChange(parseMoney(digits));
        }}
        onBlur={() => setDraft(null)}
      />
    </div>
  );
}

export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-overlay" />
        <Dialog.Content className="sheet fixed inset-x-0 bottom-0 z-50 max-h-[88dvh] overflow-y-auto rounded-t-3xl bg-surface px-5 pt-5 pb-8 shadow-none outline-none md:inset-x-auto md:top-1/2 md:bottom-auto md:left-1/2 md:w-[28rem] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-3xl">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="min-w-0 break-words">
              <Dialog.Title className="font-display text-2xl text-fg">{title}</Dialog.Title>
              {description ? (
                <Dialog.Description className="mt-1 text-sm text-pretty text-muted">
                  {description}
                </Dialog.Description>
              ) : (
                <Dialog.Description className="sr-only">{title}</Dialog.Description>
              )}
            </div>
            <Dialog.Close
              className="grid size-11 shrink-0 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-fg"
              aria-label="Cerrar"
            >
              <X className="size-5" />
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
