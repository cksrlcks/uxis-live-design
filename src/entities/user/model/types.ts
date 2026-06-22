import type { Role } from "@/shared/auth/roles";

// The admin users table renders name + email + role + 가입일.
export type AdminUser = {
  id: string;
  name: string | null;
  email: string;
  role: Role;
  createdAt: string;
};
