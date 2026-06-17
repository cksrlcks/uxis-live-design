import { describe, it, expect } from "vitest";
import { MAX_CHAT_BODY, validateChatBody } from "@/legacy/lib/meeting/chat";

describe("validateChatBody", () => {
  it("trims and returns a valid body", () => {
    expect(validateChatBody("  hello  ")).toBe("hello");
  });
  it("rejects non-strings", () => {
    expect(validateChatBody(123)).toBeNull();
    expect(validateChatBody(null)).toBeNull();
    expect(validateChatBody(undefined)).toBeNull();
    expect(validateChatBody({})).toBeNull();
  });
  it("rejects empty / whitespace-only", () => {
    expect(validateChatBody("")).toBeNull();
    expect(validateChatBody("   ")).toBeNull();
  });
  it("accepts a body exactly at the limit", () => {
    expect(validateChatBody("a".repeat(MAX_CHAT_BODY))).toBe("a".repeat(MAX_CHAT_BODY));
  });
  it("rejects a body over the limit (after trim)", () => {
    expect(validateChatBody("a".repeat(MAX_CHAT_BODY + 1))).toBeNull();
  });
});
