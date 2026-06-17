import { describe, it, expect } from "vitest";
import { isEditor, isAdmin, canEditProposals, ROLES } from "@/shared/auth/roles";

describe("roles", () => {
  it("admin and editor can edit proposals; pending cannot", () => {
    expect(canEditProposals(ROLES.ADMIN)).toBe(true);
    expect(canEditProposals(ROLES.EDITOR)).toBe(true);
    expect(canEditProposals(ROLES.PENDING)).toBe(false);
  });
  it("isAdmin only for admin", () => {
    expect(isAdmin(ROLES.ADMIN)).toBe(true);
    expect(isAdmin(ROLES.EDITOR)).toBe(false);
  });
  it("isEditor true for editor and admin", () => {
    expect(isEditor(ROLES.EDITOR)).toBe(true);
    expect(isEditor(ROLES.ADMIN)).toBe(true);
    expect(isEditor(ROLES.PENDING)).toBe(false);
  });
  it("predicates are false for null/undefined", () => {
    expect(isEditor(null)).toBe(false);
    expect(isAdmin(undefined)).toBe(false);
    expect(canEditProposals(null)).toBe(false);
  });
});
