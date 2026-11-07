import { describe, expect, it } from "vitest";

import { STAFF_ROLES, decideAccess, hasAnyRole, isStaff } from "./access";
import type { Role } from "./types";

const as = (role: Role) => ({ role });

describe("hasAnyRole", () => {
  it("matches the user's own role", () => {
    expect(hasAnyRole(as("MEMBER"), ["MEMBER"])).toBe(true);
    expect(hasAnyRole(as("LIBRARIAN"), ["LIBRARIAN"])).toBe(true);
    expect(hasAnyRole(as("MEMBER"), ["LIBRARIAN", "ADMIN"])).toBe(false);
  });

  it("treats ADMIN as a superset of LIBRARIAN, but not of MEMBER-only screens", () => {
    expect(hasAnyRole(as("ADMIN"), ["LIBRARIAN"])).toBe(true);
    expect(hasAnyRole(as("LIBRARIAN"), ["ADMIN"])).toBe(false);
    expect(hasAnyRole(as("ADMIN"), ["MEMBER"])).toBe(false);
  });

  it("is false when nobody is signed in", () => {
    expect(hasAnyRole(null, STAFF_ROLES)).toBe(false);
    expect(hasAnyRole(undefined, ["MEMBER"])).toBe(false);
  });
});

describe("isStaff", () => {
  it("is true for librarians and admins only", () => {
    expect(isStaff(as("ADMIN"))).toBe(true);
    expect(isStaff(as("LIBRARIAN"))).toBe(true);
    expect(isStaff(as("MEMBER"))).toBe(false);
    expect(isStaff(null)).toBe(false);
  });
});

describe("decideAccess", () => {
  it("waits while the session is being restored", () => {
    expect(decideAccess({ status: "loading", user: null })).toEqual({ type: "loading" });
  });

  it("sends anonymous visitors to the login page", () => {
    expect(decideAccess({ status: "anonymous", user: null })).toEqual({ type: "login" });
    expect(decideAccess({ status: "authenticated", user: null })).toEqual({ type: "login" });
  });

  it("allows any signed-in user when no role is required", () => {
    expect(decideAccess({ status: "authenticated", user: as("MEMBER") })).toEqual({ type: "allow" });
  });

  it("forbids a signed-in user who lacks the required role", () => {
    expect(decideAccess({ status: "authenticated", user: as("MEMBER"), allowedRoles: STAFF_ROLES })).toEqual({
      type: "forbidden",
    });
  });

  it("allows staff on staff routes, admins included", () => {
    expect(decideAccess({ status: "authenticated", user: as("LIBRARIAN"), allowedRoles: STAFF_ROLES })).toEqual({
      type: "allow",
    });
    expect(decideAccess({ status: "authenticated", user: as("ADMIN"), allowedRoles: ["LIBRARIAN"] })).toEqual({
      type: "allow",
    });
  });
});
