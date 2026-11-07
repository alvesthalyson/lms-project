import { describe, expect, it } from "vitest";

import { ApiError } from "@/api/errors";

import { mapApiErrorToForm } from "./form-errors";

const FIELDS = ["title", "isbn", "author_ids"] as const;

function validationError(fieldErrors: Record<string, string[]>): ApiError {
  return new ApiError({
    status: 400,
    code: "validation_error",
    detail: "One or more fields are invalid.",
    fieldErrors,
  });
}

describe("mapApiErrorToForm", () => {
  it("puts field errors on their fields and leaves no form-level message", () => {
    const mapped = mapApiErrorToForm(validationError({ isbn: ["A book with this ISBN already exists."] }), FIELDS);
    expect(mapped.fields).toEqual([{ name: "isbn", message: "A book with this ISBN already exists." }]);
    expect(mapped.formError).toBeNull();
  });

  it("joins several messages for one field", () => {
    const mapped = mapApiErrorToForm(validationError({ title: ["Too long.", "Contains forbidden text."] }), FIELDS);
    expect(mapped.fields).toEqual([{ name: "title", message: "Too long. Contains forbidden text." }]);
  });

  it("routes dotted paths to their root field", () => {
    const mapped = mapApiErrorToForm(validationError({ "author_ids.0": ["Invalid pk."] }), FIELDS);
    expect(mapped.fields).toEqual([{ name: "author_ids", message: "Invalid pk." }]);
  });

  it("turns unknown keys and non_field_errors into the form-level message", () => {
    const mapped = mapApiErrorToForm(
      validationError({ isbn: ["Bad ISBN."], non_field_errors: ["Provide exactly one of copy_id or book_id."], mystery: ["Odd."] }),
      FIELDS,
    );
    expect(mapped.fields).toEqual([{ name: "isbn", message: "Bad ISBN." }]);
    expect(mapped.formError).toBe("Provide exactly one of copy_id or book_id. Odd.");
  });

  it("falls back to the detail when a validation error carries no field errors", () => {
    expect(mapApiErrorToForm(validationError({}), FIELDS)).toEqual({
      fields: [],
      formError: "One or more fields are invalid.",
    });
  });

  it("shows business-rule and server errors as form-level messages only", () => {
    const conflict = new ApiError({ status: 409, code: "member_blocked", detail: "Member has unpaid fines." });
    expect(mapApiErrorToForm(conflict, FIELDS)).toEqual({ fields: [], formError: "Member has unpaid fines." });

    const throttled = new ApiError({ status: 429, code: "throttled", detail: "Request was throttled." });
    expect(mapApiErrorToForm(throttled, FIELDS).formError).toBe("Request was throttled.");
  });
});
