import { http } from "@/shared/api/http";
import type { Role } from "@/shared/auth/roles";

export function updateUserRole(id: string, role: Role): Promise<void> {
  return http<void>(`/api/admin/users/${id}`, { method: "PATCH", body: JSON.stringify({ role }) });
}
