import { http } from "@/shared/api/http";

export function updateUserAnalyze(id: string, allowAnalyze: boolean): Promise<void> {
  return http<void>(`/api/admin/users/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ allowAnalyze }),
  });
}
