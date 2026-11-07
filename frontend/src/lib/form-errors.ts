import type { ApiError } from "@/api/errors";

export interface MappedFormErrors {
  /** Messages to attach to a specific form field (feed to react-hook-form's setError). */
  fields: Array<{ name: string; message: string }>;
  /** A message for the whole form, or null when every error landed on a field. */
  formError: string | null;
}

/**
 * Turn the API's `{detail, code, field_errors}` into per-field messages.
 *
 * - Keys may be dotted paths (`author_ids.0`); the root segment picks the field.
 * - Keys that are not in `knownFields` (such as `non_field_errors`) become the form-level message.
 * - Anything that is not a `validation_error` (409 business rules, 429, 500, network) is form-level.
 */
export function mapApiErrorToForm(error: ApiError, knownFields: readonly string[]): MappedFormErrors {
  if (error.code !== "validation_error") {
    return { fields: [], formError: error.detail };
  }

  const byField = new Map<string, string[]>();
  const unmapped: string[] = [];

  for (const [key, messages] of Object.entries(error.fieldErrors)) {
    const root = key.split(".")[0] ?? key;
    if (knownFields.includes(root)) {
      byField.set(root, [...(byField.get(root) ?? []), ...messages]);
    } else {
      unmapped.push(...messages);
    }
  }

  const fields = [...byField.entries()].map(([name, messages]) => ({
    name,
    message: messages.join(" "),
  }));

  let formError: string | null = null;
  if (unmapped.length > 0) formError = unmapped.join(" ");
  else if (fields.length === 0) formError = error.detail;

  return { fields, formError };
}
