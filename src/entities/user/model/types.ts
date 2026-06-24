import type { Role } from "@/shared/auth/roles";

// 가입수단 — auth.identities.provider 원문. 알려진 값은 좁히고, 미지 provider도
// 원문 그대로 보존(향후 Apple/Kakao 등 추가 시 깨지지 않게).
export type AuthProvider = "email" | "google" | (string & {});

// The admin users table renders name + email + 가입수단 + 가입일.
export type AdminUser = {
  id: string;
  name: string | null;
  email: string;
  role: Role;
  providers: AuthProvider[];
  createdAt: string;
};
