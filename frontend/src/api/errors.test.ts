import axios, { AxiosError, type AxiosAdapter } from "axios";
import { describe, expect, it } from "vitest";

import { ApiError, toApiError } from "./errors";

/** An axios instance whose "server" answers with a fixed status and body (no network). */
function clientAnswering(status: number, data: unknown) {
  const adapter: AxiosAdapter = async (config) => {
    throw new AxiosError(`HTTP ${status}`, "ERR_BAD_REQUEST", config, {}, {
      data,
      status,
      statusText: String(status),
      headers: {},
      config,
      request: {},
    });
  };
  return axios.create({ adapter, baseURL: "http://test" });
}

describe("toApiError", () => {
  it("parses the API's {detail, code, field_errors} body", async () => {
    const client = clientAnswering(400, {
      detail: "One or more fields are invalid.",
      code: "validation_error",
      field_errors: { isbn: ["Enter a valid ISBN-10 or ISBN-13."] },
    });

    const error = toApiError(await client.get("/books/").catch((e: unknown) => e));
    expect(error instanceof ApiError).toBe(true);
    expect(error.status).toBe(400);
    expect(error.code).toBe("validation_error");
    expect(error.detail).toBe("One or more fields are invalid.");
    expect(error.fieldErrors).toEqual({ isbn: ["Enter a valid ISBN-10 or ISBN-13."] });
  });

  it("keeps the business-rule code of a 409", async () => {
    const client = clientAnswering(409, { detail: "Member has unpaid fines.", code: "member_blocked", field_errors: {} });
    const error = toApiError(await client.post("/loans/").catch((e: unknown) => e));
    expect(error.status).toBe(409);
    expect(error.code).toBe("member_blocked");
  });

  it("falls back to a generic message when the body is not the API's error shape", async () => {
    const client = clientAnswering(502, "<html>Bad gateway</html>");
    const error = toApiError(await client.get("/books/").catch((e: unknown) => e));
    expect(error.status).toBe(502);
    expect(error.code).toBe("error");
    expect(error.detail).toBe("Request failed (502).");
  });

  it("describes a request that never got a response as a network error", () => {
    const error = toApiError(new AxiosError("Network Error", "ERR_NETWORK"));
    expect(error.status).toBe(0);
    expect(error.code).toBe("network_error");
  });

  it("returns an ApiError unchanged and wraps unknown values", () => {
    const original = new ApiError({ status: 404, code: "not_found", detail: "Not found." });
    expect(toApiError(original)).toBe(original);
    expect(toApiError(new Error("boom")).detail).toBe("boom");
    expect(toApiError("weird").code).toBe("unknown_error");
  });
});
