import { http } from "@/shared/api/http";
import type { AdminUser } from "../model/types";

export function getUsers(): Promise<AdminUser[]> {
  return http<AdminUser[]>("/api/admin/users");
}
