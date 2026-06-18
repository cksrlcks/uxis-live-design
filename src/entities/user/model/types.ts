import type { Role } from "@/shared/auth/roles";

// The admin users table renders email + role only.
export type AdminUser = {
  id: string;
  email: string;
  role: Role;
};
