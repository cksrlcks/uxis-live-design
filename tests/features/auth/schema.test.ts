import { describe, it, expect } from "vitest";
import {
  loginSchema,
  signupSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from "@/features/auth/model/schema";

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

describe("forgotPasswordSchema", () => {
  it("accepts a valid email", () => {
    expect(forgotPasswordSchema.safeParse({ email: "a@b.com" }).success).toBe(true);
  });
  it("rejects a malformed email", () => {
    expect(forgotPasswordSchema.safeParse({ email: "nope" }).success).toBe(false);
  });
});

describe("resetPasswordSchema", () => {
  it("accepts matching passwords of 8+ chars", () => {
    expect(
      resetPasswordSchema.safeParse({ newPassword: "12345678", confirmPassword: "12345678" })
        .success,
    ).toBe(true);
  });
  it("rejects a password under 8 chars", () => {
    expect(
      resetPasswordSchema.safeParse({ newPassword: "1234567", confirmPassword: "1234567" }).success,
    ).toBe(false);
  });
  it("flags mismatched passwords on confirmPassword", () => {
    const r = resetPasswordSchema.safeParse({
      newPassword: "12345678",
      confirmPassword: "87654321",
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.some((i) => i.path[0] === "confirmPassword")).toBe(true);
    }
  });
});
