import { http } from "@/shared/api/http";
import type { ChangePasswordInput, LoginInput, SignupInput } from "../model/schema";

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
