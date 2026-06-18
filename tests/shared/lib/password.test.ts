import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "@/shared/lib/password";

describe("password hashing", () => {
  it("verifies the correct password", () => {
    const stored = hashPassword("hunter2!");
    expect(verifyPassword("hunter2!", stored)).toBe(true);
  });
  it("rejects a wrong password", () => {
    const stored = hashPassword("hunter2!");
    expect(verifyPassword("nope", stored)).toBe(false);
  });
  it("uses a random salt (two hashes of same password differ)", () => {
    expect(hashPassword("same")).not.toBe(hashPassword("same"));
  });
  it("rejects malformed stored values", () => {
    expect(verifyPassword("x", "garbage")).toBe(false);
  });
});
