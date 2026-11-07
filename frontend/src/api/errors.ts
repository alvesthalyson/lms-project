import axios from "axios";

export type FieldErrors = Record<string, string[]>;

/**
 * Every failed API call surfaces as an ApiError, so UI code only ever deals
 * with one shape: `status`, a stable machine-readable `code`, a human `detail`
 * and per-field messages.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fieldErrors: FieldErrors;

  constructor(init: { status: number; code: string; detail: string; fieldErrors?: FieldErrors }) {
    super(init.detail);
    this.name = "ApiError";
    this.status = init.status;
    this.code = init.code;
    this.fieldErrors = init.fieldErrors ?? {};
  }

  get detail(): string {
    return this.message;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeFieldErrors(value: unknown): FieldErrors {
  const result: FieldErrors = {};
  if (!isRecord(value)) return result;
  for (const [key, messages] of Object.entries(value)) {
    if (Array.isArray(messages)) result[key] = messages.map(String);
    else if (typeof messages === "string") result[key] = [messages];
  }
  return result;
}

/** Convert anything thrown by the HTTP layer into an ApiError. Safe to call on an ApiError. */
export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;

  if (axios.isAxiosError(error)) {
    const status = error.response?.status ?? 0;
    const data: unknown = error.response?.data;

    if (isRecord(data) && typeof data.detail === "string") {
      return new ApiError({
        status,
        code: typeof data.code === "string" ? data.code : "error",
        detail: data.detail,
        fieldErrors: normalizeFieldErrors(data.field_errors),
      });
    }
    if (!error.response) {
      return new ApiError({
        status: 0,
        code: "network_error",
        detail: "Cannot reach the server. Check your connection and try again.",
      });
    }
    return new ApiError({ status, code: "error", detail: `Request failed (${status}).` });
  }

  return new ApiError({
    status: 0,
    code: "unknown_error",
    detail: error instanceof Error ? error.message : "Something went wrong.",
  });
}
