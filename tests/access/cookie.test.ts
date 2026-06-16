import { describe, it, expect } from "vitest";
import { signUnlockToken, verifyUnlockToken, unlockCookieName } from "@/lib/access/cookie";

const SECRET = "test-secret";
const NOW = 1_000_000; // epoch seconds (fixed for determinism)

describe("unlock cookie tokens", () => {
  it("verifies a freshly signed token", () => {
    const token = signUnlockToken("abc123", NOW + 3600, SECRET);
    expect(verifyUnlockToken(token, "abc123", NOW, SECRET)).toBe(true);
  });
  it("rejects a token for a different publicId", () => {
    const token = signUnlockToken("abc123", NOW + 3600, SECRET);
    expect(verifyUnlockToken(token, "other99", NOW, SECRET)).toBe(false);
  });
  it("rejects an expired token", () => {
    const token = signUnlockToken("abc123", NOW - 1, SECRET);
    expect(verifyUnlockToken(token, "abc123", NOW, SECRET)).toBe(false);
  });
  it("rejects a tampered signature", () => {
    const token = signUnlockToken("abc123", NOW + 3600, SECRET);
    expect(verifyUnlockToken(token + "ff", "abc123", NOW, SECRET)).toBe(false);
  });
  it("rejects a token signed with a different secret", () => {
    const token = signUnlockToken("abc123", NOW + 3600, SECRET);
    expect(verifyUnlockToken(token, "abc123", NOW, "wrong")).toBe(false);
  });
  it("scopes the cookie name to the publicId", () => {
    expect(unlockCookieName("abc123")).toBe("pu_abc123");
  });
});
