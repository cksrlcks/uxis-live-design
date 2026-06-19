import { describe, it, expect } from "vitest";
import { createChatInputSchema, chatBodySchema, MAX_CHAT_BODY } from "@/entities/chat-message";

describe("chatBodySchema", () => {
  it("trims and accepts 1..MAX", () => {
    expect(chatBodySchema.parse("  hi  ")).toBe("hi");
    expect(chatBodySchema.parse("a".repeat(MAX_CHAT_BODY))).toHaveLength(MAX_CHAT_BODY);
  });
  it("rejects empty / whitespace-only / too long", () => {
    expect(chatBodySchema.safeParse("   ").success).toBe(false);
    expect(chatBodySchema.safeParse("").success).toBe(false);
    expect(chatBodySchema.safeParse("a".repeat(MAX_CHAT_BODY + 1)).success).toBe(false);
  });
});

describe("createChatInputSchema", () => {
  it("accepts a valid payload", () => {
    expect(
      createChatInputSchema.parse({ body: "hi", authorName: "n", authorColor: "#fff" }),
    ).toEqual({ body: "hi", authorName: "n", authorColor: "#fff" });
  });
  it("rejects missing/over-length author fields", () => {
    expect(
      createChatInputSchema.safeParse({ body: "hi", authorName: "", authorColor: "#fff" }).success,
    ).toBe(false);
    expect(
      createChatInputSchema.safeParse({
        body: "hi",
        authorName: "a".repeat(81),
        authorColor: "#fff",
      }).success,
    ).toBe(false);
  });
});
