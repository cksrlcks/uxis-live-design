import { describe, it, expect } from "vitest";
import { deriveViewerName } from "@/shared/access/viewer-name";

describe("deriveViewerName", () => {
  it("returns null for guests (no profile)", () => {
    expect(deriveViewerName(null)).toBe(null);
  });
  it("prefers displayName when present", () => {
    expect(deriveViewerName({ displayName: "홍길동", email: "a@b.com" })).toBe("홍길동");
  });
  it("falls back to the email local-part when displayName is null", () => {
    expect(deriveViewerName({ displayName: null, email: "alice@example.com" })).toBe("alice");
  });
  it("returns null when nothing usable (defensive)", () => {
    expect(deriveViewerName({ displayName: null, email: "" })).toBe(null);
  });
});
