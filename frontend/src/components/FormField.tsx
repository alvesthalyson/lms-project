import type { ReactNode } from "react";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/cn";

/** Props that wire an input to its error message: spread onto the control. */
export function fieldA11y(id: string, error?: string) {
  return {
    id,
    "aria-invalid": error ? (true as const) : undefined,
    "aria-describedby": error ? `${id}-error` : undefined,
  };
}

interface FormFieldProps {
  label: string;
  /** Must equal the control's `id` (use `fieldA11y(id, error)` on the control). */
  htmlFor: string;
  error?: string;
  hint?: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
}

/** Label + control + error text. The error is a role="alert" paragraph right under the control. */
export function FormField({ label, htmlFor, error, hint, required, className, children }: FormFieldProps) {
  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={htmlFor}>
        {label}
        {required && (
          <span aria-hidden className="text-destructive">
            {" "}
            *
          </span>
        )}
      </Label>
      {children}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && (
        <p id={`${htmlFor}-error`} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
