import { X } from "lucide-react";

import { cn } from "@/lib/cn";
import { useToastStore, type ToastVariant } from "@/lib/toast";

const VARIANT_CLASSES: Record<ToastVariant, string> = {
  success: "border-success/40 bg-background text-success",
  error: "border-destructive/40 bg-background text-destructive",
  info: "border-border bg-background text-foreground",
};

/** Renders the queue from lib/toast. Mounted once in AppLayout. */
export function Toaster() {
  const toasts = useToastStore((state) => state.toasts);
  const dismiss = useToastStore((state) => state.dismiss);

  return (
    <div aria-live="polite" className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role="status"
          className={cn(
            "pointer-events-auto flex items-start justify-between gap-2 rounded-md border p-3 text-sm shadow-md",
            VARIANT_CLASSES[toast.variant],
          )}
        >
          <span>{toast.message}</span>
          <button type="button" aria-label="Dismiss" onClick={() => dismiss(toast.id)} className="opacity-70 hover:opacity-100">
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
