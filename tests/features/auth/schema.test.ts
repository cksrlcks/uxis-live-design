import { describe, it, expect } from "vitest";
import { loginSchema, signupSchema } from "@/features/auth/model/schema";

describe("loginSchema", () => {
  it("accepts a valid email + password", () => {
    expect(loginSchema.safeParse({ email: "a@b.com", password: "x" }).success).toBe(true);
  });
  it("rejects a malformed email", () => {
    expect(loginSchema.safeParse({ email: "nope", password: "x" }).success).toBe(false);
  });
  it("rejects an empty password", () => {
    expect(loginSchema.safeParse({ email: "a@b.com", password: "" }).success).toBe(false);
  });
});

describe("signupSchema", () => {
  it("accepts a valid payload", () => {
    expect(
      signupSchema.safeParse({ name: "홍길동", email: "a@b.com", password: "12345678" }).success,
    ).toBe(true);
  });
  it("trims and rejects an empty name", () => {
    expect(
      signupSchema.safeParse({ name: "   ", email: "a@b.com", password: "12345678" }).success,
    ).toBe(false);
  });
  it("rejects a password under 8 chars", () => {
    expect(
      signupSchema.safeParse({ name: "홍길동", email: "a@b.com", password: "1234567" }).success,
    ).toBe(false);
  });
});
