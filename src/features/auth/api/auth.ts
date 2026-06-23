import { http } from "@/shared/api/http";
import type {
  ChangePasswordInput,
  ForgotPasswordInput,
  LoginInput,
  ResetPasswordInput,
  SignupInput,
} from "../model/schema";

export function login(input: LoginInput): Promise<void> {
  return http<void>("/api/auth/login", { method: "POST", body: JSON.stringify(input) });
}

export function signup(input: SignupInput): Promise<void> {
  return http<void>("/api/auth/signup", { method: "POST", body: JSON.stringify(input) });
}

export function logout(): Promise<void> {
  return http<void>("/api/auth/logout", { method: "POST" });
}

export function changePassword(input: ChangePasswordInput): Promise<void> {
  return http<void>("/api/auth/password", { method: "POST", body: JSON.stringify(input) });
}

export function requestPasswordReset(input: ForgotPasswordInput): Promise<void> {
  return http<void>("/api/auth/forgot-password", { method: "POST", body: JSON.stringify(input) });
}

export function resetPassword(input: ResetPasswordInput): Promise<void> {
  return http<void>("/api/auth/reset-password", { method: "POST", body: JSON.stringify(input) });
}
