import { describe, it, expect } from "vitest";
import {
  loginSchema,
  signupSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  updateNameSchema,
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
      signupSchema.safeParse({ name: "홍길동", email: "a@b.com", password: "Passw0rd!" }).success,
    ).toBe(true);
  });
  it("trims and rejects an empty name", () => {
    expect(
      signupSchema.safeParse({ name: "   ", email: "a@b.com", password: "Passw0rd!" }).success,
    ).toBe(false);
  });
  it("rejects a password under 8 chars", () => {
    expect(
      signupSchema.safeParse({ name: "홍길동", email: "a@b.com", password: "Pw0rd!" }).success,
    ).toBe(false);
  });
  it("rejects a password without a letter", () => {
    expect(
      signupSchema.safeParse({ name: "홍길동", email: "a@b.com", password: "12345678!" }).success,
    ).toBe(false);
  });
  it("rejects a password without a number", () => {
    expect(
      signupSchema.safeParse({ name: "홍길동", email: "a@b.com", password: "Password!" }).success,
    ).toBe(false);
  });
  it("rejects a password without a special character", () => {
    expect(
      signupSchema.safeParse({ name: "홍길동", email: "a@b.com", password: "Password1" }).success,
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
  it("accepts matching passwords that meet the composition rules", () => {
    expect(
      resetPasswordSchema.safeParse({ newPassword: "Passw0rd!", confirmPassword: "Passw0rd!" })
        .success,
    ).toBe(true);
  });
  it("rejects a password under 8 chars", () => {
    expect(
      resetPasswordSchema.safeParse({ newPassword: "Pw0rd!", confirmPassword: "Pw0rd!" }).success,
    ).toBe(false);
  });
  it("rejects a password missing letter, number, or special char", () => {
    expect(
      resetPasswordSchema.safeParse({ newPassword: "12345678", confirmPassword: "12345678" })
        .success,
    ).toBe(false);
  });
  it("flags mismatched passwords on confirmPassword", () => {
    const r = resetPasswordSchema.safeParse({
      newPassword: "Passw0rd!",
      confirmPassword: "Drowss4p!",
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.some((i) => i.path[0] === "confirmPassword")).toBe(true);
    }
  });
});

describe("updateNameSchema", () => {
  it("accepts a non-empty name", () => {
    expect(updateNameSchema.safeParse({ name: "홍길동" }).success).toBe(true);
  });
  it("trims and rejects a blank name", () => {
    expect(updateNameSchema.safeParse({ name: "   " }).success).toBe(false);
  });
  it("rejects a name over 50 chars", () => {
    expect(updateNameSchema.safeParse({ name: "가".repeat(51) }).success).toBe(false);
  });
});
