import { describe, it, expect } from "vitest";
import { signupErrorCode } from "@/features/auth/api/signup-error";

describe("signupErrorCode", () => {
  it("maps user_already_exists code to EMAIL_TAKEN", () => {
    expect(signupErrorCode({ code: "user_already_exists" })).toBe("EMAIL_TAKEN");
  });
  it("maps an 'already registered' message to EMAIL_TAKEN", () => {
    expect(signupErrorCode({ message: "User already registered" })).toBe("EMAIL_TAKEN");
  });
  it("falls back to SIGNUP_FAILED for anything else", () => {
    expect(signupErrorCode({ code: "weak_password", message: "boom" })).toBe("SIGNUP_FAILED");
    expect(signupErrorCode({})).toBe("SIGNUP_FAILED");
  });
});
